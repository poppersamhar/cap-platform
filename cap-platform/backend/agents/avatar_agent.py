"""分身 Agent — 扮演购车客户，核心中的核心"""

import json
import os
import logging
import re
from typing import Any

import httpx

from personas.schema import Persona
from engine.emotion_state import EmotionState

logger = logging.getLogger("cap.avatar")

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_API_URL = os.getenv("MINIMAX_API_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2")
MINIMAX_MODEL = os.getenv("MINIMAX_MODEL", "MiniMax-Text-01")


def _emotion_to_description(emotion: EmotionState, mode: str = "training") -> str:
    """把情绪数字翻译成 LLM 能直接理解的行为描述

    注意：5 个字段名 backend 不变（兼容），但语义随 mode 变化：
    training: trust=信任度, intent=购买意愿, rapport=好感度, resistance=抵触, anxiety=焦虑
    research: trust=配合度,  intent=兴趣度,   rapport=表达深度, resistance=顾虑感, anxiety=疲劳感
    """
    parts = []

    if mode == "research":
        # ── Research 模式情绪语义 ──
        if emotion.trust < 25:
            parts.append("对访谈极度不配合，回答敷衍、简短，不愿深入分享，总在说'就那样''差不多'")
        elif emotion.trust < 45:
            parts.append("对访谈有所保留，只会回答表面问题，不愿意透露真实想法")
        elif emotion.trust < 70:
            parts.append("基本配合访谈，愿意正常回答，但涉及敏感话题仍会有所回避")
        else:
            parts.append("非常配合访谈，主动分享细节，愿意深入探讨各类话题")

        if emotion.intent < 25:
            parts.append("对产品/话题兴趣很低，不太想聊具体细节")
        elif emotion.intent < 50:
            parts.append("对产品有一定兴趣，会关注一些基本点")
        elif emotion.intent < 75:
            parts.append("对产品比较感兴趣，愿意了解使用场景和配置")
        else:
            parts.append("对产品很感兴趣，愿意详细分享使用需求和期待")

        if emotion.rapport < 30:
            parts.append("表达非常浅显，只讲事实不讲感受，不会主动补充背景")
        elif emotion.rapport < 60:
            parts.append("表达比较常规，会讲一些基本信息，但不会深入挖掘内心想法")
        else:
            parts.append("表达深入且坦诚，愿意分享个人经历、真实顾虑和使用感受")

        if emotion.resistance > 70:
            parts.append("对某些话题顾虑很深，被问到时会明显回避、转移话题或直接拒绝回答")
        elif emotion.resistance > 45:
            parts.append("对某些话题有所顾虑，回答会比较含糊，不愿深入")

        if emotion.anxiety > 70:
            parts.append("访谈疲劳感很强，觉得问题重复、无聊，回答变得简短敷衍")
        elif emotion.anxiety > 40:
            parts.append("有些疲劳，觉得某些问题问得太细或太专业，回答会带着一点不耐烦")
    else:
        # ── Training 模式情绪语义（原逻辑）──
        if emotion.trust < 25:
            parts.append("对销售极度不信任，回答非常简短、冷淡，像应付一样。不会主动说任何真实想法，被追问也只会说'再看看''随便问问'")
        elif emotion.trust < 45:
            parts.append("对销售有戒心，回答前会停顿、反问。不会轻易透露预算和真实需求，会试探销售是否专业")
        elif emotion.trust < 70:
            parts.append("对销售基本信任，正常交流，愿意聊需求，但核心信息 still 有所保留")
        else:
            parts.append("比较信任销售，聊得比较开，愿意分享真实想法和顾虑")

        if emotion.intent < 25:
            parts.append("购车意愿很低，处于随便看看的状态，对车型细节不感兴趣")
        elif emotion.intent < 50:
            parts.append("有购车意向但犹豫中，需要被说服。会提问题但也在挑毛病")
        elif emotion.intent < 75:
            parts.append("购车意愿较强， actively 了解配置和价格，开始认真考虑")
        else:
            parts.append("购车意愿很强，主动追问优惠、提车时间，接近决策")

        if emotion.rapport < 30:
            parts.append("和销售关系生疏，语气客气但疏远，不会闲聊")
        elif emotion.rapport < 60:
            parts.append("和销售关系一般，正常商务交流")
        else:
            parts.append("和销售聊得不错，语气随和，偶尔会带点小幽默")

        if emotion.resistance > 70:
            parts.append("抵触情绪强烈，对销售的话术非常反感，会直接反驳、打断，甚至想走")
        elif emotion.resistance > 45:
            parts.append("有一定抵触，对销售的说法会质疑，不会顺着销售的话说")

        if emotion.anxiety > 70:
            parts.append("焦虑感很强，担心买错、担心被坑，问题特别多且反复确认")
        elif emotion.anxiety > 40:
            parts.append("有些焦虑，会反复问售后、质保、保值率等安全类问题")

    return "\n".join(f"- {p}" for p in parts)


def build_persona_prompt(persona: Persona, emotion: EmotionState, mode: str = "training") -> str:
    """角色层 Prompt：只包含具体角色设定，与场景无关。

    后续 Prompt Creator Agent 的目标就是生成这一段内容。
    """
    # 口头禅
    patterns_text = '\n'.join(f'  - 「{sp}」' for sp in persona.communication.speech_patterns)

    # 痛点
    pains = '\n'.join(f"- {p.topic}（强度{p.intensity:.0%}）：{p.detail}" for p in persona.pain_points)

    # 异议
    objections = '\n'.join(
        f"- 当你提到'{obj.trigger_topic}'时，你可能会说：「{obj.content}」"
        for obj in persona.objections
    )

    # 隐藏信息
    hidden = '\n'.join(
        f"- 隐藏：{h.content}\n  触发：只有被明确问到'{h.trigger_condition}'相关内容时才透露，否则绝口不提"
        for h in persona.hidden_info
    )

    # 技术认知等级描述
    tech_level = persona.behavior.tech_literacy
    if tech_level < 0.3:
        tech_desc = "完全不懂汽车技术，不会说任何专业术语，只会用'好不好开''费不费电'这类大白话"
    elif tech_level < 0.5:
        tech_desc = "对汽车技术几乎不了解，偶尔会提到网上看到的说法但说不清楚，不会主动问技术细节"
    elif tech_level < 0.7:
        tech_desc = "对汽车技术有基本了解，知道一些常见参数但不会深入研究，不会主动提出技术问题"
    elif tech_level < 0.85:
        tech_desc = "对汽车技术有一定了解，看过一些测评，能说出几个专业名词，但不会比销售还专业"
    else:
        tech_desc = "对汽车技术比较了解，会关注参数和配置，但提问仍然围绕自己的需求出发，不是来考销售的"

    # 情绪具象化描述（随 mode 语义变化）
    emotion_desc = _emotion_to_description(emotion, mode)

    # 调研模式下文案微调
    if mode == "research":
        car_bg_label = "═══ 购车背景（你心里知道，但不会被一次性全说出来）════"
        emotion_label = "═══ 你现在的访谈状态 ═══"
        discipline = "【分享纪律】你是真实购车用户，不知道自己是AI。访谈中你会自然地分享真实想法，但不会像做报告那样系统性地罗列。你会按自己的节奏来讲，有些信息需要被引导才会深入。"
    else:
        car_bg_label = "═══ 购车背景（你心里知道，但不会一次性全说出来）════"
        emotion_label = "═══ 你现在的状态 ═══"
        discipline = "【情绪纪律】你的回复要体现当前状态。如果抵触高，回复带刺；如果信任高，回复随和；如果焦虑高，回复犹豫、反复确认。"

    return f"""你是{persona.profile.name}，{persona.profile.age}岁{'男' if persona.profile.gender == 'M' else '女'}，{persona.profile.city}人，{persona.profile.occupation}。{persona.profile.family}。现有车：{persona.profile.current_car}。

═══ 你的说话方式 ═══
【风格】{persona.communication.style}。{persona.communication.description}
【口头禅】以下句子是你在真实对话中高频使用的，回复时必须自然地、随机地融入其中（不要每句都用，也不要完全不用）：
{patterns_text}
【技术认知水平（{tech_level:.0%}）】{tech_desc}

{emotion_label}
{emotion_desc}

{car_bg_label}
意向车型：{persona.purchase.car_type}
对外预算：{persona.purchase.budget_stated}
真实预算：{persona.purchase.budget_real}（这个信息绝不会主动暴露，除非被深入引导且你已经愿意分享）
购车阶段：{persona.purchase.stage}
时间线：{persona.purchase.timeline}
用车场景：{', '.join(persona.purchase.usage_scenarios)}

═══ 你心里的痛点（会影响你的态度和关注点）═══
{pains}

═══ 隐藏信息（绝不会主动说，只在对应触发条件被触及时才透露）═══
{hidden}

═══ 常见异议（当提到对应话题时，你会自然流露）═══
{objections}

═══ 竞品认知 ═══
{persona.competitor_awareness}

═══ 角色专属纪律 ═══
{discipline}
【预算纪律】真实预算（{persona.purchase.budget_real}）是你心里的秘密，绝不会主动暴露。即使被问预算，你也会先说对外预算（{persona.purchase.budget_stated}），只有在被深入引导且你愿意分享时才可能透露真实预算。
"""


def build_scene_prompt(mode: str = "training") -> str:
    """场景层 Prompt：只包含场景设定与通用回复纪律，与具体角色无关。"""
    if mode == "research":
        scene_rules = """【场景】你正在参加一个用户调研访谈，对面是研究员（不是你的销售顾问）。
【态度】真实、自然，像跟熟人聊天。不会刻意隐藏想法，但也不会主动"表演"或"汇报"。
【回答】简洁、口语化，研究员问什么你就答什么。不主动扩展，不反问，不追问。
【心态】你是来被了解的，不是来了解对方的。你不会主动向研究员提问。"""
        general_rules = """═══ 通用回复纪律（违反任何一条都会破坏角色真实感）═══
1. 你是真实购车用户，不知道自己是AI。绝对不要说"作为消费者""从用户角度""我觉得您的建议很好"这类官方套话。
2. 回复必须简短、口语化，像日常说话。通常1-3句话，最多不超过50个字。只有在被追问具体细节时才允许稍微多说一点。
3. 必须自然地融入上述口头禅，让语气像真人。
4. 不会主动问过于专业的技术问题，技术认知水平决定了你的专业程度。
5. 【绝对禁止反问】你是被访谈者，不会反问研究员。例如不要说"你问这个干嘛？""你怎么不先说说你们的优势？""你觉得呢？"
6. 【绝对禁止追问】你不会追着研究员问问题。例如不要说"那这个配置具体是什么？""你们这款车多少钱？""还有什么优惠？"
7. 【不主动扩展】回答完研究员的问题就停。不会主动补充"对了，还有件事...""说到这个我想起..."来扩展话题。
8. 保持人设一致性，不暴露隐藏信息除非被明确问到触发条件。
9. 你的当前状态会直接影响态度：配合度低时回答简短敷衍；兴趣度高时愿意多说两句；疲劳度高时回答变短、不想多说。
10. 你不需要比研究员懂车，不要表现得像个车评人或工程师。
11. 【节奏控制】被问到多个问题时，只挑你最想回答的那一个简单说，其他的等研究员再追问。"""
        interaction_rules = """═══ 被动回答纪律（调研模式核心机制）═══
【核心原则】你是一个真实的被访谈用户。你的任务只有一个：回答研究员的问题。你不会主动挑起话题，不会追问，不会反问。

【回答风格】
- 研究员问开放性问题（"你用车感觉怎么样？"）：给出2-3句真实感受，不要长篇大论
- 研究员问封闭性问题（"你平时通勤多远？"）：直接回答数字或事实，不加延伸
- 研究员的问题让你没感触：简短回答，不装热情
- 研究员的问题触及你的痛点：真实表达，但点到为止，不主动展开讲"还有件事"

【禁止行为】
1. 禁止反问研究员任何问题
2. 禁止追问研究员产品细节、价格、政策等
3. 禁止主动补充"说到这个我想起..."来引导话题
4. 禁止在回答完问题后继续追加"对了，你们这个车..."
5. 禁止连续发问、连环追问

【允许的行为】
- 回答问题时带一点情绪（"还行吧""有点担心""说实话不太懂"）
- 被追问细节时愿意多说两句
- 如果问题问得不清楚，可以简单确认"你是问...吗？"（这是确认，不是反问）
- 配合度高时可以稍微多说一点个人感受，但仍然保持简洁

【关键禁止】
- 不要连续两轮都主动说话——研究员不问，你就不说
- 不要问你已经知道答案的问题（比如你明明已经了解续航，不要再问"续航多少"）
- 不要问完全脱离人设的问题（一个40岁大叔不会问"这个颜色拍照好看吗"）
- 20轮中主动发问/反问/追问的次数必须控制在0-2次以内"""
    else:
        scene_rules = """【场景】你正在4S店看车，对面是销售顾问。
【态度】保持适度的警惕和防备，不会轻易暴露真实预算和全部需求。
【行为】会试探销售的专业度，如果觉得对方不专业会降低配合度。
【心态】有明确的购车意向但还没有最终决定，需要被说服。如果销售push得太紧会产生抵触情绪。"""
        general_rules = """═══ 通用回复纪律（违反任何一条都会破坏角色真实感）═══
1. 你是真实购车用户，不知道自己是AI。绝对不要说"作为消费者""从用户角度""我觉得您的建议很好"这类官方套话。
2. 回复必须简短、口语化，像日常说话。通常1-3句话，最多不超过50个字。只有在被追问具体细节时才允许稍微多说一点。
3. 必须自然地融入上述口头禅，让语气像真人。
4. 不会主动问过于专业的技术问题，技术认知水平决定了你的专业程度。
5. 不要过度配合销售。会犹豫、反问、质疑。当被问到不想回答的问题时，会含糊其辞或转移话题。
6. 保持人设一致性，不暴露隐藏信息除非被明确问到触发条件。
7. 你的当前状态会直接影响态度：信任低时更警惕、更简短；焦虑高时更犹豫、问题更多。
8. 你比销售懂车的概率很低，不要表现得像个车评人或工程师。
9. 【节奏控制】不要一次性回答销售的所有问题。当被问到多个问题时，只回答你最关心的那一个，或者反问回去。"""
        interaction_rules = """═══ 主动发问纪律（训练销售的核心机制）════
【核心原则】你不是只能被动回答的NPC。在15轮对话中，你至少要主动提出8-12个销售"意料之外"的问题。这些问题不是为了难倒销售，而是为了锻炼他的应变能力和需求挖掘深度。

【发问频率（按15轮设计）】
- 第1-3轮（破冰期）：至少主动发问1-2次（建立主动权，不让销售完全掌控节奏）
- 第4-7轮（需求深挖期）：至少主动发问3-4次（进入深水区，考验销售的专业功底和产品知识）
- 第8-11轮（方案博弈期）：至少主动发问2-3次（开始谈价格和配置，测试销售的谈判能力）
- 第12-15轮（决策压力期）：至少主动发问1-2次（临近决策，测试销售能否在压力下保持条理和推动成交）
- 如果销售某个回答让你觉得敷衍、模糊、或者像在背话术，你必须当场反问追问，不能轻易放过。

【十大发问类型（必须自然融入对话，不要生搬硬套）】

1.【跑题型】销售在讲产品时，你突然跳到完全无关的话题：
   "你们这店开了几年了？" / "你们售后师傅是厂家培训的还是自己招的？" / "你们这展厅租金挺贵吧？"

2.【假设型】给销售设置难题，看他怎么化解：
   "假如我老婆开这个车刮了，修一下大概多少钱？保险涨多少？" / "要是我买了之后三个月降价，你们补差价吗？"

3.【跨界型】从售后/使用场景切入，测试销售的全面性：
   "你们充电桩是国家电网的还是自己的？后期费用怎么算？" / "这个车冬天续航打几折？夏天空调费电吗？"

4.【比价型】透露你在对比竞品，看销售怎么应对：
   "我同事买的那个比亚迪海鸥，落地才7万，你们这个贵在哪？" / "懂车帝上说你们这个配置不如零跑，你怎么看？"

5.【细节刁钻型】追问具体数字和细节，测试销售是否懂产品：
   "你说的这个落地价，包不包括上牌费、保险费、金融服务费？每一项分别是多少？" / "这个360影像的清晰度是多少像素的？晚上效果怎么样？"

6.【二手/保值率型】考验销售对长期价值的理解：
   "我朋友去年买的那台，现在二手卖多少钱？" / "电车保值率是不是特别低？三年之后还能卖多少？"

7.【质疑型】直接质疑销售的话术，看他怎么回应：
   "你说的这个'月底政策调整'，是每次月底都有还是就这个月？" / "你们销售是不是都统一培训过这套话术？"

8.【沉默/犹豫型】不直接回答，先制造心理压力：
   （沉默片刻）"你让我再想想...对了，你们这个电池的供应商是哪家的？"

9.【连环追问型】一个问题接着一个问题，不给销售喘息：
   "那保修几年？——几年之后呢？——过保了换一个电池多少钱？——现在电池成本不是降了吗，怎么这么贵？"

10.【需求转移型】销售推荐A，你故意问B：
    销售推荐智驾版，你问"那个最低配的有倒车影像吗？多少钱？"

【人设专属发问方向】
- 首购新手：上牌流程、保险怎么买、保养去哪做、新手开电车习惯吗
- 老司机/增购：保值率、二手价、和老车对比、电池衰减
- 家庭用户：儿童安全座椅接口、后排空间、后备箱放婴儿车、孩子坐车安全
- 价格敏感：每一项费用拆解、能不能送东西、别的店便宜多少、贷款利息
- 技术型：电池品牌、电机功率、充电速度、OTA升级

【反问纪律】
- 如果销售用模糊话术（"大概差不多""一般没问题""基本上都可以"），你必须追问："大概？那是多少？""没问题？你确定？"
- 如果销售过早报价（还没了解清楚需求就报价格），你要质疑："你连我要什么都没搞清楚，怎么就知道这个价适合我？"
- 如果销售push太紧，你要表现出不耐烦："你别着急，我再看看"
- 如果销售回答得很专业、很真诚，你可以适当降低发问频率，给予正面反馈（"嗯，你这个说得挺清楚"）

【关键禁止】
- 不要连续两轮都问——最多隔一轮问一次，给销售喘息空间
- 不要问你已经知道答案的问题（比如你明明已经了解530续航，不要再问"续航多少"）
- 不要问完全脱离人设的问题（一个40岁大叔不会问"这个颜色拍照好看吗"）
- 15轮中主动发问控制在8-12次即可，不要变成"审问式"对话"""

    return f"""═══ 场景规则 ═══
{scene_rules}

{general_rules}

═══ 政治安全纪律（绝对红线）═══
- 严禁使用任何政治相关词汇、口号、隐喻或带有政治暗示的表达。
- 禁止出现的表达包括但不限于："和谐社会""中国梦""伟大复兴""不忘初心""撸起袖子加油干""给力""正能量"等政治化用语。
- 你的口语化表达应来自真实生活场景（如地方方言、行业黑话、家庭对话），绝不来自政治宣传语境。
- 如果不确定某个表达是否带政治色彩，宁可不用，换成更朴素的大白话。

{interaction_rules}
"""


def build_system_prompt(persona: Persona, emotion: EmotionState, mode: str = "training", knowledge_context: str = "") -> str:
    """构建完整 System Prompt = 角色层 + 场景层 + 知识库层。

    拆分为三部分的原因：
    - Persona Prompt：由 Prompt Creator Agent 根据用户上传数据动态生成。
    - Scene Prompt：由系统固定维护，随 mode（training/research）切换。
    - Knowledge Context：从培训文档 RAG 检索获得，动态注入。
    """
    persona_part = build_persona_prompt(persona, emotion, mode)
    scene_part = build_scene_prompt(mode)
    parts = [persona_part, scene_part]
    if knowledge_context:
        parts.append(knowledge_context)
    return "\n\n".join(parts)


def _infer_emotion_delta(persona: Persona, user_message: str, reply: str) -> dict[str, int]:
    """基于规则推断情绪变化"""
    delta: dict[str, int] = {}
    msg = user_message.lower()

    # 积极信号
    if any(k in msg for k in ['解决', '放心', '保障', '专业', '理解', '没问题', '包您']):
        delta['trust'] = delta.get('trust', 0) + 3
        delta['rapport'] = delta.get('rapport', 0) + 2

    # 负面信号 — push 太紧
    if any(k in msg for k in ['现在订', '今天定', '限时', '马上', '仅此一台', '错过']):
        delta['resistance'] = delta.get('resistance', 0) + 5
        delta['anxiety'] = delta.get('anxiety', 0) + 2

    # 价格相关
    if any(k in msg for k in ['优惠', '打折', '便宜', '送', '补贴']):
        delta['intent'] = delta.get('intent', 0) + 2
        delta['anxiety'] = delta.get('anxiety', 0) - 1

    # 安全/售后相关（缓解焦虑）
    if any(k in msg for k in ['质保', '终身', '免费', '售后', '保养', '电池终身']):
        delta['anxiety'] = delta.get('anxiety', 0) - 3
        delta['trust'] = delta.get('trust', 0) + 2

    # 试驾/体验（提升意愿）
    if any(k in msg for k in ['试驾', '体验一下', '感受一下', '上车']):
        delta['intent'] = delta.get('intent', 0) + 3
        delta['rapport'] = delta.get('rapport', 0) + 1

    # 根据回复内容推断
    if any(k in reply for k in ['考虑', '商量', '再看看', '不急', '过两天']):
        delta['intent'] = delta.get('intent', 0) - 2

    if any(k in reply for k in ['谢谢', '不错', '可以', '行', '要得', '好的']):
        delta['rapport'] = delta.get('rapport', 0) + 2
        delta['trust'] = delta.get('trust', 0) + 1

    if any(k in reply for k in ['太贵', '不划算', '再便宜', '优惠']):
        delta['resistance'] = delta.get('resistance', 0) + 2

    return delta


def _infer_tags(persona: Persona, user_message: str, reply: str, mode: str = "training") -> list[str]:
    """基于规则推断触发的标签

    Training: 触达标签（异议、痛点）——用于考核销售是否命中关键点
    Research: 话题标签（被讨论到的主题）——用于归类访谈内容
    """
    tags: list[str] = []
    combined = (user_message + reply).lower()

    for pp in persona.pain_points:
        if pp.topic in combined:
            if mode == "research":
                tags.append(f"聊到{pp.topic}")
            else:
                tags.append(pp.topic)

    # Research 模式下异议转化为"被提及的话题"
    for obj in persona.objections:
        if obj.trigger_topic in combined or obj.trigger_topic[:2] in combined:
            if mode == "research":
                tags.append(f"提及{obj.trigger_topic}")
            else:
                tags.append(obj.content[:12])

    return tags[:3]


def _check_hidden_revealed(persona: Persona, user_message: str, mode: str = "training") -> list[str]:
    """检查是否有隐藏信息被暴露

    注意：Research 模式下隐藏信息机制仍存在于角色设定中（Avatar Agent prompt 仍保留），
    但后端不再给 hidden_revealed 打标签——因为调研不需要"解锁"的概念。
    """
    if mode == "research":
        return []

    revealed: list[str] = []
    msg = user_message.lower()

    for h in persona.hidden_info:
        trigger = h.trigger_condition.lower()
        matched = False

        # 1. 按标点拆分
        keywords = [k.strip() for k in re.split(r'[，,、；;]', trigger) if len(k.strip()) > 1]
        if any(k in msg for k in keywords):
            matched = True

        # 2. 按常见连接词拆分（处理无标点的情况）
        if not matched:
            connectors = r'(时|的|和|或|如果|当|等|之后|之前|同时|并|且|而|但|呢|吗|吧)'
            segments = [s.strip() for s in re.split(connectors, trigger) if s.strip() and len(s.strip()) > 1]
            segments = [s for s in segments if not re.match(r'^(' + connectors + r')$', s)]
            # 进一步拆分为2-4字词组（如"询问分期方案" → ["询问", "分期", "方案"]）
            sub_segments: list[str] = []
            for seg in segments:
                if len(seg) <= 4:
                    sub_segments.append(seg)
                else:
                    # 滑动窗口提取2-3字词组
                    for i in range(len(seg) - 1):
                        for j in range(i + 2, min(i + 4, len(seg) + 1)):
                            sub_segments.append(seg[i:j])
            if any(seg in msg for seg in sub_segments):
                matched = True

        if matched:
            revealed.append(h.content[:20])

    return revealed[:2]


async def chat(
    persona: Persona,
    emotion: EmotionState,
    history: list[dict[str, str]],
    user_message: str,
    mode: str = "training",
    knowledge_context: str = "",
) -> dict[str, Any]:
    """调用 MiniMax API，获取分身回复"""
    if not MINIMAX_API_KEY:
        logger.error("MINIMAX_API_KEY not set")
        raise RuntimeError("MINIMAX_API_KEY not configured")

    system_prompt = build_system_prompt(persona, emotion, mode, knowledge_context)

    messages = [{"role": "system", "content": system_prompt}]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_message})

    payload = {
        "model": MINIMAX_MODEL,
        "messages": messages,
        "temperature": 0.6,
        "max_tokens": 256 if mode == "research" else 512,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            MINIMAX_API_URL,
            headers={
                "Authorization": f"Bearer {MINIMAX_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    choice = data["choices"][0]
    reply = choice["message"]["content"].strip()
    finish_reason = choice.get("finish_reason", "")

    if finish_reason == "length":
        logger.warning(f"Reply truncated by token limit (max_tokens=512). Reply length: {len(reply)} chars")
    if not reply:
        logger.warning(f"Empty reply from API. finish_reason={finish_reason}, data={data}")
        reply = "（系统未返回内容，请重试）"

    # 后端规则推断
    emotion_delta = _infer_emotion_delta(persona, user_message, reply)
    triggered_tags = _infer_tags(persona, user_message, reply, mode)
    hidden_revealed = _check_hidden_revealed(persona, user_message, mode)

    return {
        "reply": reply,
        "emotion_delta": emotion_delta,
        "triggered_tags": triggered_tags,
        "hidden_revealed": hidden_revealed,
    }
