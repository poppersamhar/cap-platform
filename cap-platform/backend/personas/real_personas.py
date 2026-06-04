"""真实客户分身数据 — 从 LLM 生成的 JSON 文件动态加载

数据来源：
  - data/individual_personas.json: 9 个个体分身（基于真实客户多轮对话提炼）
  - data/typical_personas.json:    3 个典型分身（按聚类合成）

生成流程：
  1. backend/scripts/01_split_dataset.py  — 切分构造集/保真集
  2. backend/scripts/02_generate_individual_personas.py — LLM 生成个体分身
  3. backend/scripts/03_generate_typical_personas.py    — LLM 生成典型分身
"""

import json
import logging
from pathlib import Path

from .schema import (
    BehaviorParams, CommunicationStyle, HiddenInfo,
    Objection, PainPoint, Persona, PersonaProfile, PurchaseProfile,
)

logger = logging.getLogger("personas.real")

DATA_DIR = Path(__file__).parent.parent / "data"


def _dict_to_persona(d: dict) -> Persona:
    """把 JSON 字典转成 Persona Pydantic 模型，保留 LLM 生成的字段"""
    profile = PersonaProfile(**d["profile"])
    purchase = PurchaseProfile(**d["purchase"])
    pain_points = [PainPoint(**p) for p in d.get("pain_points", [])]
    hidden_info = [HiddenInfo(**h) for h in d.get("hidden_info", [])]
    objections = [Objection(**o) for o in d.get("objections", [])]
    behavior = BehaviorParams(**d["behavior"])
    communication = CommunicationStyle(
        style=d["communication"]["style"],
        description=d["communication"]["description"],
        speech_patterns=d["communication"].get("speech_patterns", []),
    )
    return Persona(
        id=d["id"],
        profile=profile,
        purchase=purchase,
        pain_points=pain_points,
        hidden_info=hidden_info,
        objections=objections,
        competitor_awareness=d.get("competitor_awareness", ""),
        behavior=behavior,
        communication=communication,
        tags=d.get("tags", []),
    )


def _load_json(path: Path) -> list[dict]:
    if not path.exists():
        logger.warning(f"未找到 {path}，跳过")
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _load_all_personas() -> list[Persona]:
    personas: list[Persona] = []

    individuals = _load_json(DATA_DIR / "individual_personas.json")
    for d in individuals:
        try:
            personas.append(_dict_to_persona(d))
        except Exception as e:
            logger.exception(f"加载个体分身失败 {d.get('id')}: {e}")

    typicals = _load_json(DATA_DIR / "typical_personas.json")
    for d in typicals:
        try:
            personas.append(_dict_to_persona(d))
        except Exception as e:
            logger.exception(f"加载典型分身失败 {d.get('id')}: {e}")

    logger.info(f"已加载 {len(personas)} 个 Persona（个体 {len(individuals)} + 典型 {len(typicals)}）")
    return personas


ALL_PERSONAS: list[Persona] = _load_all_personas()


def get_persona(persona_id: str) -> Persona | None:
    for p in ALL_PERSONAS:
        if p.id == persona_id:
            return p
    return None
