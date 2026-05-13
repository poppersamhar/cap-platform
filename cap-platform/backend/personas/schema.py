"""Persona Pydantic Schema — 客户数字分身数据模型"""

from pydantic import BaseModel, Field
from typing import Literal


class PersonaProfile(BaseModel):
    name: str
    age: int = Field(ge=18, le=80)
    gender: Literal["M", "F"]
    city: str
    occupation: str
    family: str
    current_car: str


class PurchaseProfile(BaseModel):
    budget_stated: str
    budget_real: str
    car_type: str
    stage: str
    timeline: str
    usage_scenarios: list[str]


class PainPoint(BaseModel):
    topic: str
    intensity: float = Field(ge=0, le=1)
    detail: str


class HiddenInfo(BaseModel):
    content: str
    trigger_condition: str


class Objection(BaseModel):
    content: str
    trigger_topic: str
    resistance: float = Field(ge=0, le=1)


class BehaviorParams(BaseModel):
    anti_guide: float = Field(ge=0, le=1, description="抗引导强度")
    price_sensitivity: float = Field(ge=0, le=1, description="价格敏感度")
    expressiveness: float = Field(ge=0, le=1, description="表达主动性")
    decisiveness: float = Field(ge=0, le=1, description="决策果断度")
    tech_literacy: float = Field(ge=0, le=1, description="技术认知")


class CommunicationStyle(BaseModel):
    style: str
    description: str
    speech_patterns: list[str]


class Persona(BaseModel):
    id: str
    profile: PersonaProfile
    purchase: PurchaseProfile
    pain_points: list[PainPoint]
    hidden_info: list[HiddenInfo]
    objections: list[Objection]
    competitor_awareness: str
    behavior: BehaviorParams
    communication: CommunicationStyle
    tags: list[str] = []

    def to_prompt_text(self) -> str:
        """将 Persona 转为 System Prompt 中可注入的文本格式"""
        lines = [
            f"【基础信息】",
            f"姓名：{self.profile.name}，{self.profile.age}岁，{'男' if self.profile.gender == 'M' else '女'}",
            f"城市：{self.profile.city}，职业：{self.profile.occupation}",
            f"家庭：{self.profile.family}，现有车辆：{self.profile.current_car}",
            "",
            f"【购车画像】",
            f"意向车型：{self.purchase.car_type}",
            f"预算（对外）：{self.purchase.budget_stated}",
            f"真实预算：{self.purchase.budget_real}",
            f"决策阶段：{self.purchase.stage}",
            f"购车时间线：{self.purchase.timeline}",
            f"用车场景：{', '.join(self.purchase.usage_scenarios)}",
            "",
            f"【核心痛点】",
        ]
        for p in self.pain_points:
            lines.append(f"- {p.topic}（强度{p.intensity:.0%}）：{p.detail}")

        lines.extend([
            "",
            f"【隐藏信息】（不会主动透露，只在特定条件下暴露）",
        ])
        for h in self.hidden_info:
            lines.append(f"- {h.content}（触发条件：{h.trigger_condition}）")

        lines.extend([
            "",
            f"【常见异议】",
        ])
        for o in self.objections:
            lines.append(f"- {o.content}（触发话题：{o.trigger_topic}，抵抗强度{o.resistance:.0%}）")

        lines.extend([
            "",
            f"【竞品认知】{self.competitor_awareness}",
            "",
            f"【行为参数】",
            f"抗引导强度：{self.behavior.anti_guide:.0%}",
            f"价格敏感度：{self.behavior.price_sensitivity:.0%}",
            f"表达主动性：{self.behavior.expressiveness:.0%}",
            f"决策果断度：{self.behavior.decisiveness:.0%}",
            f"技术认知：{self.behavior.tech_literacy:.0%}",
            "",
            f"【沟通风格】",
            f"风格：{self.communication.style}",
            f"描述：{self.communication.description}",
            f"口头禅：{', '.join(self.communication.speech_patterns)}",
        ])

        return "\n".join(lines)
