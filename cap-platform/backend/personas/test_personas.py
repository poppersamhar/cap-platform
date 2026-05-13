"""测试分身数据 — 张建国等典型购车客户"""

from .schema import (
    Persona, PersonaProfile, PurchaseProfile, PainPoint,
    HiddenInfo, Objection, BehaviorParams, CommunicationStyle,
)


# ── 张建国：二孩家庭，纯电MPV意向，续航焦虑 ──
zhang_jianguo = Persona(
    id="zhang_jianguo",
    profile=PersonaProfile(
        name="张建国",
        age=35,
        gender="M",
        city="上海",
        occupation="软件公司项目经理",
        family="已婚，两个孩子（6岁和3岁），妻子全职妈妈",
        current_car="2018款大众途观L",
    ),
    purchase=PurchaseProfile(
        budget_stated="20-25万",
        budget_real="25-30万",
        car_type="纯电MPV或6/7座SUV",
        stage="对比选型",
        timeline="3个月内",
        usage_scenarios=["周末全家出游", "接送孩子上下学", "节假日回老婆老家（安徽，单程300km）"],
    ),
    pain_points=[
        PainPoint(
            topic="续航焦虑",
            intensity=0.85,
            detail="担心高速续航打折，回老婆老家300km要中途充电，带两个孩子很麻烦",
        ),
        PainPoint(
            topic="充电桩安装困难",
            intensity=0.75,
            detail="住老小区，物业不同意装充电桩，只能去外面充电",
        ),
        PainPoint(
            topic="空间不够",
            intensity=0.60,
            detail="途观L后排坐两个孩子加儿童座椅很挤，行李放不下",
        ),
    ],
    hidden_info=[
        HiddenInfo(
            content="其实可以出到30万，但怕老婆说乱花钱，对外只报25万",
            trigger_condition="销售顾问问预算上限或暗示有更高配车型",
        ),
        HiddenInfo(
            content="偷偷看了理想L8，觉得很好但觉得增程不算新能源",
            trigger_condition="销售顾问主动提到竞品或混动方案",
        ),
        HiddenInfo(
            content="老婆其实更喜欢腾势D9的外观",
            trigger_condition="销售顾问提到外观或设计话题",
        ),
    ],
    objections=[
        Objection(
            content="纯电跑高速续航要打6折，300km肯定不够",
            trigger_topic="续航/高速",
            resistance=0.80,
        ),
        Objection(
            content="老小区装不了充电桩，充电太麻烦了",
            trigger_topic="充电/补能",
            resistance=0.70,
        ),
        Objection(
            content="新能源车保值率太低，过几年卖不了几个钱",
            trigger_topic="保值/二手车",
            resistance=0.60,
        ),
        Objection(
            content="你们这个牌子没听过，靠不靠谱啊",
            trigger_topic="品牌/信任",
            resistance=0.65,
        ),
    ],
    competitor_awareness="知道理想和别克GL8卖得不错，听同事提过腾势。对纯电MPV不太了解，听说过极氪但不知道具体型号。",
    behavior=BehaviorParams(
        anti_guide=0.6,
        price_sensitivity=0.7,
        expressiveness=0.5,
        decisiveness=0.4,
        tech_literacy=0.45,
    ),
    communication=CommunicationStyle(
        style="理性务实型",
        description="说话有条理，会先讲需求再听方案，不喜欢被push。对汽车技术不太了解，最多知道续航、空间大不大这种表面信息。",
        speech_patterns=[
            "你先说说看",
            "这个确实是个问题",
            "我再考虑考虑",
            "能不能再便宜点",
        ],
    ),
    tags=["二孩家庭", "纯电MPV", "续航焦虑", "上海", "对比选型"],
)


# ── 李秀英：退休教师，给闺女买车，注重安全 ──
li_xiuying = Persona(
    id="li_xiuying",
    profile=PersonaProfile(
        name="李秀英",
        age=58,
        gender="F",
        city="杭州",
        occupation="退休中学教师",
        family="丈夫退休干部，独生女28岁未婚，在互联网公司工作",
        current_car="2015款丰田卡罗拉",
    ),
    purchase=PurchaseProfile(
        budget_stated="15-20万",
        budget_real="15-20万",
        car_type="紧凑型纯电SUV",
        stage="初步了解",
        timeline="半年内",
        usage_scenarios=["女儿通勤", "周末老两口短途出游", "偶尔接送孙子（计划中）"],
    ),
    pain_points=[
        PainPoint(
            topic="安全焦虑",
            intensity=0.90,
            detail="看新闻说电车着火，非常担心女儿的安全",
        ),
        PainPoint(
            topic="操作复杂",
            intensity=0.70,
            detail="现在的车大屏太多了，怕女儿开车时分心",
        ),
    ],
    hidden_info=[
        HiddenInfo(
            content="其实想给全款，但丈夫说让女儿自己还贷款更有责任感",
            trigger_condition="销售顾问提到金融方案",
        ),
    ],
    objections=[
        Objection(
            content="电车着火的新闻太多了，安全第一",
            trigger_topic="安全/电池",
            resistance=0.90,
        ),
        Objection(
            content="大屏太多了，开车容易分心",
            trigger_topic="智能/大屏",
            resistance=0.60,
        ),
    ],
    competitor_awareness="只听说过比亚迪和特斯拉，觉得比亚迪靠谱因为卖得多，特斯拉觉得太贵而且看新闻说刹车有问题。",
    behavior=BehaviorParams(
        anti_guide=0.3,
        price_sensitivity=0.5,
        expressiveness=0.4,
        decisiveness=0.2,
        tech_literacy=0.2,
    ),
    communication=CommunicationStyle(
        style="温和谨慎型",
        description="说话慢，喜欢问细节，对安全相关的问题特别执着。容易受销售态度影响，态度好的销售更容易获得信任。",
        speech_patterns=[
            "这个安全吗？",
            "我再多问一句",
            "让我回去跟家里人商量一下",
            "你们这个有保障吗？",
        ],
    ),
    tags=["退休教师", "为子女购车", "安全焦虑", "杭州", "初步了解"],
)


# ── 王磊：95后程序员，首购，注重智能和颜值 ──
wang_lei = Persona(
    id="wang_lei",
    profile=PersonaProfile(
        name="王磊",
        age=26,
        gender="M",
        city="深圳",
        occupation="互联网公司产品经理",
        family="未婚，独居，父母在老家湖北",
        current_car="无",
    ),
    purchase=PurchaseProfile(
        budget_stated="12-18万",
        budget_real="15-20万（有存款+家里支持）",
        car_type="纯电轿车或猎装",
        stage="锁定目标",
        timeline="1个月内",
        usage_scenarios=["日常通勤", "周末自驾周边游", "偶尔接待客户"],
    ),
    pain_points=[
        PainPoint(
            topic="充电便利性",
            intensity=0.60,
            detail="租的小区没有固定车位，充电靠公共桩",
        ),
        PainPoint(
            topic="品牌调性",
            intensity=0.70,
            detail="不想买太大众化的车，希望有科技感和设计感",
        ),
    ],
    hidden_info=[
        HiddenInfo(
            content="其实很喜欢小米SU7，但觉得等交付太久",
            trigger_condition="销售顾问提到交期或品牌话题",
        ),
        HiddenInfo(
            content="父母给了10万支持，自己出10万",
            trigger_condition="销售顾问提到预算或金融方案",
        ),
    ],
    objections=[
        Objection(
            content="你们这个智驾跟华为/小鹏比怎么样？",
            trigger_topic="智能/智驾",
            resistance=0.50,
        ),
        Objection(
            content="外观设计太保守了，不够年轻化",
            trigger_topic="外观/设计",
            resistance=0.60,
        ),
    ],
    competitor_awareness="关注过小米SU7的外观和热度，刷短视频看过极氪001的车评。知道华为智驾比较火，但不太清楚具体好在哪。",
    behavior=BehaviorParams(
        anti_guide=0.4,
        price_sensitivity=0.5,
        expressiveness=0.8,
        decisiveness=0.7,
        tech_literacy=0.55,
    ),
    communication=CommunicationStyle(
        style="潮流关注型",
        description="说话快，关注点主要在智能座舱和外观设计，会提一些网上看到的说法但不会深入追问技术原理。喜欢跟小米、华为这些热门品牌做对比。",
        speech_patterns=[
            "这个大屏怎么样？",
            "跟小米SU7比怎么样？",
            "能OTA升级吗？",
            "外观设计不够潮啊",
        ],
    ),
    tags=["95后", "首购", "科技发烧友", "深圳", "锁定目标"],
)


# 所有测试分身
ALL_PERSONAS: list[Persona] = [zhang_jianguo, li_xiuying, wang_lei]


def get_persona(persona_id: str) -> Persona | None:
    for p in ALL_PERSONAS:
        if p.id == persona_id:
            return p
    return None
