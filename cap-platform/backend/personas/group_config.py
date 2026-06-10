"""客群分组名称配置 — 支持自定义每个数据分组的显示标题

按 _source 字段分组（mg4 / 4x / factory / ...），支持运行时修改分组名称。
"""

import json
import logging
from pathlib import Path

logger = logging.getLogger("personas.groups")

DATA_DIR = Path(__file__).parent.parent / "data"
GROUP_CONFIG_PATH = DATA_DIR / "persona_groups.json"

# 默认分组名称（当配置文件不存在或某项缺失时回退）
DEFAULT_GROUP_NAMES: dict[str, str] = {
    "mg4": "MG4 车型典型客群",
    "4x": "MG 4X 车型典型客群",
    "factory": "数据工厂生成客群",
}


def _load_raw() -> dict:
    if not GROUP_CONFIG_PATH.exists():
        return {}
    try:
        with open(GROUP_CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"加载分组配置失败: {e}")
        return {}


def load_group_names() -> dict[str, str]:
    """加载所有分组名称（合并默认值）"""
    raw = _load_raw()
    merged = {**DEFAULT_GROUP_NAMES, **raw}
    return merged


def get_group_name(source: str) -> str:
    """获取某个分组的显示名称"""
    names = load_group_names()
    return names.get(source, f"{source} 客群")


def update_group_name(source: str, name: str) -> str:
    """更新某个分组的显示名称

    source 对应 persona 的 _source 字段值，如 'mg4'、'4x'、'factory'。
    """
    raw = _load_raw()
    raw[source] = name
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(GROUP_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False, indent=2)
    logger.info(f"分组 '{source}' 名称已更新为: {name}")
    return name


def delete_group_name(source: str) -> None:
    """删除某个分组的自定义名称（回退到默认）"""
    raw = _load_raw()
    if source in raw:
        del raw[source]
        with open(GROUP_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(raw, f, ensure_ascii=False, indent=2)
        logger.info(f"分组 '{source}' 自定义名称已删除")
