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
    # 保留额外元数据字段（如 _source, _cluster_title 等）
    extra = {k: v for k, v in d.items() if k.startswith("_")}
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
        **extra,
    )


def _load_json(path: Path) -> list[dict]:
    if not path.exists():
        logger.warning(f"未找到 {path}，跳过")
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ── 工厂分身持久化 ──

FACTORY_PATH = DATA_DIR / "typical_personas_factory.json"


def load_factory_personas() -> list[Persona]:
    """加载工厂生成的分身"""
    raw = _load_json(FACTORY_PATH)
    personas = []
    for d in raw:
        try:
            personas.append(_dict_to_persona(d))
        except Exception as e:
            logger.exception(f"加载工厂分身失败 {d.get('id')}: {e}")
    return personas


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

    typicals_4x = _load_json(DATA_DIR / "typical_personas_4x.json")
    for d in typicals_4x:
        try:
            personas.append(_dict_to_persona(d))
        except Exception as e:
            logger.exception(f"加载4X典型分身失败 {d.get('id')}: {e}")

    factory_personas = load_factory_personas()
    for p in factory_personas:
        if not any(ep.id == p.id for ep in personas):
            personas.append(p)

    logger.info(
        f"已加载 {len(personas)} 个 Persona"
        f"（个体 {len(individuals)} + 典型 {len(typicals)} + 4X典型 {len(typicals_4x)}"
        f" + 工厂 {len(factory_personas)}）"
    )
    return personas


ALL_PERSONAS: list[Persona] = _load_all_personas()


def get_persona(persona_id: str) -> Persona | None:
    for p in ALL_PERSONAS:
        if p.id == persona_id:
            return p
    return None


def _persona_to_dict(p: Persona) -> dict:
    """将 Persona Pydantic 模型转回 JSON 字典（保留 extra metadata）"""
    base = {
        "id": p.id,
        "profile": p.profile.model_dump(),
        "purchase": p.purchase.model_dump(),
        "pain_points": [pp.model_dump() for pp in p.pain_points],
        "hidden_info": [hi.model_dump() for hi in p.hidden_info],
        "objections": [obj.model_dump() for obj in p.objections],
        "behavior": p.behavior.model_dump(),
        "communication": {
            "style": p.communication.style,
            "description": p.communication.description,
            "speech_patterns": p.communication.speech_patterns,
        },
        "competitor_awareness": p.competitor_awareness,
        "tags": p.tags,
    }
    # 保留 extra 字段（_source, _cluster_title 等）
    for key in p.model_extra or {}:
        if key.startswith("_"):
            base[key] = getattr(p, key)
    return base


def update_persona(persona_id: str, data: dict) -> Persona:
    """更新典型分身并持久化到 JSON

    仅支持 typical_ 前缀的分身（可配置角色）。
    4X 典型分身（_source == '4x'）不支持编辑。
    更新内存列表并写回 typical_personas.json。
    """
    if not persona_id.startswith("typical_"):
        raise ValueError("只有典型分身(typical_)支持编辑")

    # 1. 用新数据构建 Persona 模型（做校验）
    updated = _dict_to_persona(data)
    if updated.id != persona_id:
        raise ValueError(f"ID 不匹配: {updated.id} != {persona_id}")

    # 2. 检查是否为 4X 分身
    existing = get_persona(persona_id)
    if existing and getattr(existing, "_source", None) == "4x":
        raise ValueError("4X 典型分身不支持编辑")

    # 3. 更新内存列表
    for i, p in enumerate(ALL_PERSONAS):
        if p.id == persona_id:
            ALL_PERSONAS[i] = updated
            break
    else:
        raise ValueError(f"未找到分身: {persona_id}")

    # 4. 持久化到 JSON
    save_typical_personas()
    logger.info(f"典型分身已更新并持久化: {persona_id}")
    return updated


def save_typical_personas() -> None:
    """将当前内存中的所有典型分身写回 typical_personas.json（不含 4X/工厂 分身）"""
    typicals = [
        p for p in ALL_PERSONAS
        if p.id.startswith("typical_")
        and getattr(p, "_source", None) not in ("4x", "factory")
    ]
    out = [_persona_to_dict(p) for p in typicals]
    path = DATA_DIR / "typical_personas.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    logger.info(f"已保存 {len(typicals)} 个典型分身到 {path}")


# ── 工厂分身持久化 ──


def add_factory_personas(persona_dicts: list[dict]) -> list[Persona]:
    """将工厂生成的分身追加到系统（内存+文件），返回实际添加的列表

    自动处理 ID 冲突：如果 ID 已存在，追加时间戳后缀。
    """
    import time

    existing_ids = {p.id for p in ALL_PERSONAS}
    added: list[Persona] = []

    for d in persona_dicts:
        # 确保标记为 factory
        d["_source"] = "factory"
        if "_kind" not in d:
            d["_kind"] = "typical"

        # 处理 ID 冲突
        original_id = d["id"]
        if original_id in existing_ids:
            suffix = str(int(time.time()))[-6:]
            d["id"] = f"{original_id}_{suffix}"
            logger.warning(f"工厂分身 ID 冲突，重命名: {original_id} -> {d['id']}")

        # 校验并转换
        try:
            persona = _dict_to_persona(d)
        except Exception as e:
            logger.error(f"工厂分身校验失败 {d.get('id')}: {e}")
            continue

        ALL_PERSONAS.append(persona)
        existing_ids.add(persona.id)
        added.append(persona)

    # 持久化到独立文件
    _persist_factory_personas()

    logger.info(f"已添加 {len(added)} 个工厂分身到系统")
    return added


def _persist_factory_personas() -> None:
    """将内存中的所有工厂分身写回文件"""
    factory_personas = [
        _persona_to_dict(p)
        for p in ALL_PERSONAS
        if getattr(p, "_source", None) == "factory"
    ]
    with open(FACTORY_PATH, "w", encoding="utf-8") as f:
        json.dump(factory_personas, f, ensure_ascii=False, indent=2)
    logger.info(f"已保存 {len(factory_personas)} 个工厂分身到 {FACTORY_PATH}")


# ── 工厂分身 CRUD ──


def update_factory_persona(persona_id: str, data: dict) -> Persona:
    """更新工厂分身并持久化

    仅支持 _source == 'factory' 的分身。
    """
    existing = get_persona(persona_id)
    if not existing:
        raise ValueError(f"未找到分身: {persona_id}")
    if getattr(existing, "_source", None) != "factory":
        raise ValueError("只有工厂分身(factory)支持此接口编辑")

    # 确保 data 保留 _source 标记
    if "_source" not in data:
        data["_source"] = "factory"

    updated = _dict_to_persona(data)
    if updated.id != persona_id:
        raise ValueError(f"ID 不匹配: {updated.id} != {persona_id}")

    for i, p in enumerate(ALL_PERSONAS):
        if p.id == persona_id:
            ALL_PERSONAS[i] = updated
            break
    else:
        raise ValueError(f"未找到分身: {persona_id}")

    _persist_factory_personas()
    logger.info(f"工厂分身已更新并持久化: {persona_id}")
    return updated


def delete_factory_persona(persona_id: str) -> None:
    """删除工厂分身"""
    existing = get_persona(persona_id)
    if not existing:
        raise ValueError(f"未找到分身: {persona_id}")
    if getattr(existing, "_source", None) != "factory":
        raise ValueError("只有工厂分身(factory)支持删除")

    ALL_PERSONAS[:] = [p for p in ALL_PERSONAS if p.id != persona_id]
    _persist_factory_personas()
    logger.info(f"工厂分身已删除: {persona_id}")


def get_factory_personas() -> list[Persona]:
    """返回所有工厂分身"""
    return [p for p in ALL_PERSONAS if getattr(p, "_source", None) == "factory"]


# 启动时加载工厂分身
_FACTORY_LOADED = False

def _ensure_factory_loaded() -> None:
    global _FACTORY_LOADED
    if _FACTORY_LOADED:
        return
    factory_personas = load_factory_personas()
    for p in factory_personas:
        if not any(ep.id == p.id for ep in ALL_PERSONAS):
            ALL_PERSONAS.append(p)
    _FACTORY_LOADED = True
    logger.info(f"启动时加载了 {len(factory_personas)} 个工厂分身")
