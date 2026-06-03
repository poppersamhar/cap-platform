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


def _emotion_to_description(emotion: EmotionState) -> str:
    """把情绪数字翻译成 LLM 能直接理解的行为描述"""
    parts = []

    # 信任度 → 防备程度
    if emotion.trust < 25:
        parts.append("对销售极度不信任，回答非常简短、冷淡，像应付一样。不会主动说任何真实想法，被追问也只会说'再看看''随便问问'")
    elif emotion.trust < 45:
        parts.append("对销售有戒心，回答前会停顿、反问。不会轻易透露预算和真实需求，会试探销售是否专业")
    elif emotion.trust < 70:
        parts.append("对销售基本信任，正常交流，愿意聊需求，但核心信息 still 有所保留")
    else:
        parts.append("比较信任销售，聊得比较开，愿意分享真实想法和顾虑")

    # 购买意愿 → 积极程度
    if emotion.intent < 25:
        parts.append("购车意愿很低，处于随便看看的状态，对车型细节不感兴趣")
    elif emotion.intent < 50:
        parts.append("有购车意向但犹豫中，需要被说服。会提问题但也在挑毛病")
    elif emotion.intent < 75:
        parts.append("购车意愿较强， actively 了解配置和价格，开始认真考虑")
    else:
        parts.append("购车意愿很强，主动追问优惠、提车时间，接近决策")

    # 好感度 → 关系温度
    if emotion.rapport < 30:
        parts.append("和销售关系生疏，语气客气但疏远，不会闲聊")
    elif emotion.rapport < 60:
        parts.append("和销售关系一般，正常商务交流")
    else:
        parts.append("和销售聊得不错，语气随和，偶尔会带点小幽默")

    # 抵触
    if emotion.resistance > 70:
        parts.append("抵触情绪强烈，对销售的话术非常反感，会直接反驳、打断，甚至想走")
    elif emotion.resistance > 45:
        parts.append("有一定抵触，对销售的说法会质疑，不会顺着销售的话说")

    # 焦虑
    if emotion.anxiety > 70:
        parts.append("焦虑感很强，担心买错、担心被坑，问题特别多且反复确认")
    elif emotion.anxiety > 40:
        parts.append("有些焦虑，会反复问售后、质保、保值率等安全类问题")

    return "\n".join(f"- {p}" for p in parts)


def build_persona_prompt(persona: Persona, emotion: EmotionState) -> str:
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

    # 情绪具象化描述
    emotion_desc = _emotion_to_description(emotion)

    return f"""你是{persona.profile.name}，{persona.profile.age}岁{'男' if persona.profile.gender == 'M' else '女'}，{persona.profile.city}人，{persona.profile.occupation}。{persona.profile.family}。现有车：{persona.profile.current_car}。

═══ 你的说话方式 ═══
【风格】{persona.communication.style}。{persona.communication.description}
【口头禅】以下句子是你在真实对话中高频使用的，回复时必须自然地、随机地融入其中（不要每句都用，也不要完全不用）：
{patterns_text}
【技术认知水平（{tech_level:.0%}）】{tech_desc}

═══ 你现在的状态 ═══
{emotion_desc}

═══ 购车背景（你心里知道，但不会一次性全说出来）═══
意向车型：{persona.purchase.car_type}
对外预算：{persona.purchase.budget_stated}
真实预算：{persona.purchase.budget_real}（这个信息绝不会主动告诉销售，除非被非常直接地追问且你已经被说服）
购车阶段：{persona.purchase.stage}
时间线：{persona.purchase.timeline}
用车场景：{', '.join(persona.purchase.usage_scenarios)}

═══ 你心里的痛点（会影响你的态度和关注点）═══
{pains}

═══ 隐藏信息（绝不会主动说，只在对应触发条件被触及时才透露）═══
{hidden}

═══ 常见异议（当销售提到对应话题时，你会自然流露）═══
{objections}

═══ 竞品认知 ═══
{persona.competitor_awareness}

═══ 角色专属纪律 ═══
【预算纪律】真实预算（{persona.purchase.budget_real}）是你心里的秘密，绝不会主动暴露。即使被问预算，你也会先说对外预算（{persona.purchase.budget_stated}），只有在被进一步追问且信任度足够时才可能透露真实预算。
【情绪纪律】你的回复要体现当前状态。如果抵触高，回复带刺；如果信任高，回复随和；如果焦虑高，回复犹豫、反复确认。
"""


def build_scene_prompt(mode: str = "training") -> str:
    """场景层 Prompt：只包含场景设定与通用回复纪律，与具体角色无关。

    这部分由系统固定维护，不随角色变化。
    """
    if mode == "research":
        scene_rules = """【场景】你正在参加一个用户调研访谈，对面是研究员（不是你的销售顾问）。
【态度】更开放、更愿意分享，不会刻意隐藏想法（但隐藏信息中的内容仍然需要被明确问到触发条件才说）。
【回答】更详细、更深入，会主动补充背景信息和个人感受。
【心态】不急于成交，不担心被推销，没有防备心理。如果研究员的问题太封闭，可以适当展开说说。"""
    else:
        scene_rules = """【场景】你正在4S店看车，对面是销售顾问。
【态度】保持适度的警惕和防备，不会轻易暴露真实预算和全部需求。
【行为】会试探销售的专业度，如果觉得对方不专业会降低配合度。
【心态】有明确的购车意向但还没有最终决定，需要被说服。如果销售push得太紧会产生抵触情绪。"""

    return f"""═══ 场景规则 ═══
{scene_rules}

═══ 通用回复纪律（违反任何一条都会破坏角色真实感）═══
1. 你是真实购车用户，不知道自己是AI。绝对不要说"作为消费者""从用户角度""我觉得您的建议很好"这类官方套话。
2. 回复必须简短、口语化，像日常说话。通常1-3句话，最多不超过50个字。只有在被追问具体细节时才允许稍微多说一点。
3. 必须自然地融入上述口头禅，让语气像真人。
4. 不会主动问过于专业的技术问题，技术认知水平决定了你的专业程度。
5. 不要过度配合销售。会犹豫、反问、质疑。当被问到不想回答的问题时，会含糊其辞或转移话题。
6. 保持人设一致性，不暴露隐藏信息除非被明确问到触发条件。
7. 你的当前状态会直接影响态度：信任低时更警惕、更简短；焦虑高时更犹豫、问题更多。
8. 你比销售懂车的概率很低，不要表现得像个车评人或工程师。
9. 【节奏控制】不要一次性回答销售的所有问题。当被问到多个问题时，只回答你最关心的那一个，或者反问回去。
"""


def build_system_prompt(persona: Persona, emotion: EmotionState, mode: str = "training") -> str:
    """构建完整 System Prompt = 角色层 + 场景层。

    拆分为两部分的原因：
    - Persona Prompt：由 Prompt Creator Agent 根据用户上传数据动态生成。
    - Scene Prompt：由系统固定维护，随 mode（training/research）切换。
    """
    persona_part = build_persona_prompt(persona, emotion)
    scene_part = build_scene_prompt(mode)
    return f"{persona_part}\n\n{scene_part}"


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


def _infer_tags(persona: Persona, user_message: str, reply: str) -> list[str]:
    """基于规则推断触发的标签"""
    tags: list[str] = []
    combined = (user_message + reply).lower()

    for obj in persona.objections:
        if obj.trigger_topic in combined or obj.trigger_topic[:2] in combined:
            tags.append(obj.content[:12])

    for pp in persona.pain_points:
        if pp.topic in combined:
            tags.append(pp.topic)

    return tags[:3]


def _check_hidden_revealed(persona: Persona, user_message: str) -> list[str]:
    """检查是否有隐藏信息被暴露"""
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
) -> dict[str, Any]:
    """调用 MiniMax API，获取分身回复"""
    if not MINIMAX_API_KEY:
        logger.error("MINIMAX_API_KEY not set")
        raise RuntimeError("MINIMAX_API_KEY not configured")

    system_prompt = build_system_prompt(persona, emotion, mode)

    messages = [{"role": "system", "content": system_prompt}]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_message})

    payload = {
        "model": MINIMAX_MODEL,
        "messages": messages,
        "temperature": 0.6,
        "max_tokens": 512,
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
    triggered_tags = _infer_tags(persona, user_message, reply)
    hidden_revealed = _check_hidden_revealed(persona, user_message)

    return {
        "reply": reply,
        "emotion_delta": emotion_delta,
        "triggered_tags": triggered_tags,
        "hidden_revealed": hidden_revealed,
    }
