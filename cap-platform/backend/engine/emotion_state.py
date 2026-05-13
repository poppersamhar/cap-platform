"""情绪状态机 — 维护客户 5 维情绪状态"""

from typing import Literal

SpecialState = Literal["customer_leaving", "decision_phase", "confrontation"] | None


class EmotionState:
    """客户情绪状态：信任度/购买意愿/好感度/抵触情绪/焦虑感"""

    def __init__(
        self,
        trust: int = 30,
        intent: int = 20,
        rapport: int = 40,
        resistance: int = 30,
        anxiety: int = 50,
    ):
        self.trust = self._clamp(trust)
        self.intent = self._clamp(intent)
        self.rapport = self._clamp(rapport)
        self.resistance = self._clamp(resistance)
        self.anxiety = self._clamp(anxiety)

    @staticmethod
    def _clamp(v: int) -> int:
        return max(0, min(100, v))

    def update(self, delta: dict[str, int]) -> None:
        """更新情绪状态，单轮变化限制在 [-15, +15]"""
        for key, value in delta.items():
            if not hasattr(self, key):
                continue
            # clamp 单轮变化幅度
            clamped = max(-15, min(15, value))
            current = getattr(self, key)
            setattr(self, key, self._clamp(current + clamped))

    def to_dict(self) -> dict[str, int]:
        return {
            "trust": self.trust,
            "intent": self.intent,
            "rapport": self.rapport,
            "resistance": self.resistance,
            "anxiety": self.anxiety,
        }

    def check_triggers(self) -> SpecialState:
        """检查是否触发特殊状态"""
        if self.trust <= 20:
            return "customer_leaving"
        if self.intent >= 80:
            return "decision_phase"
        if self.resistance >= 70:
            return "confrontation"
        return None

    @classmethod
    def from_dict(cls, d: dict) -> "EmotionState":
        return cls(
            trust=d.get("trust", 30),
            intent=d.get("intent", 20),
            rapport=d.get("rapport", 40),
            resistance=d.get("resistance", 30),
            anxiety=d.get("anxiety", 50),
        )
