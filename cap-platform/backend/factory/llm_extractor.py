"""LLM 特征抽取 — 从原始用户数据中提取聚类用特征标签

Step 1: 对每条用户记录调用 LLM，抽取结构化特征。
产出: 每条记录 → dict of {feature_name: feature_value}
"""

import asyncio
import json
import logging
import os
from typing import Any

import httpx
from dotenv import load_dotenv

# 加载环境变量（模块级，确保直接调用时也能读取 .env）
_env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path)

logger = logging.getLogger("cap.factory.extractor")

API_KEY = os.getenv("MINIMAX_API_KEY", "").strip()
API_URL = os.getenv("MINIMAX_API_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2").strip()
MODEL = os.getenv("MINIMAX_MODEL", "MiniMax-Text-01").strip()

# ── 特征抽取 Prompt ──

_EXTRACTOR_SYSTEM = """你是一位资深汽车行业用户研究专家。你的任务是从一段客户数据中，提取一组标准化的特征标签，用于后续的客户分群聚类。

请严格按照以下维度提取特征，输出一个 JSON 对象（不要 markdown 代码块、不要解释）：

{
  "core_concerns": ["关注点1", "关注点2", "关注点3"],
  "decision_style": "理性对比型|感性冲动型|犹豫纠结型|务实直接型",
  "purchase_motivation": "家庭需求驱动|个人升级驱动|商用驱动|通勤刚需驱动|社交面子驱动",
  "powertrain_preference": "纯电|插混|燃油|不限",
  "brand_affinity": "国产品牌偏好|合资品牌偏好|不限",
  "price_sensitivity": "高|中|低",
  "objection_type": "续航焦虑|价格抵触|品牌信任|配置不满|服务担忧|无明确异议",
  "age_group": "25岁以下|25-30岁|30-35岁|35-40岁|40-45岁|45岁以上",
  "family_structure": "单身|已婚无孩|已婚有孩|三代同住",
  "budget_range": "10万以下|10-15万|15-20万|20-25万|25-30万|30万以上"
}

【抽取规则】
1. core_concerns: 从对话中提取客户反复提到的 TOP3 关注点，如"续航焦虑""空间不足""价格敏感"
2. decision_style: 根据对话中客户的提问方式、决策节奏判断
3. purchase_motivation: 购车的核心驱动力
4. powertrain_preference: 对纯电/混动/燃油的偏好倾向
5. brand_affinity: 对国产或合资品牌的倾向
6. price_sensitivity: 对价格的敏感程度
7. objection_type: 客户表达过的最大顾虑
8. age_group / family_structure / budget_range: 从结构化信息推断

如果某个维度无法判断，使用"未知"作为默认值。"""


def _build_user_prompt(record: dict) -> str:
    """把单条记录转成给 LLM 的 user prompt"""
    parts = []
    parts.append("═══ 客户数据 ═══")

    # 基础信息
    for key in ["年龄阶段", "性别", "婚姻状况", "常住地城市", "购车性质", "意向等级", "购车计划", "预算范围", "用车场景", "关注点", "顾虑点"]:
        val = record.get(key)
        if val and str(val).lower() not in ("nan", "none", "null", ""):
            parts.append(f"{key}: {val}")

    # 对话文本（如果有）
    for key in ["外呼通话录音文本", "外呼通话录音小结", "试驾录音原文本", "试驾小结", "客户关注点标签", "试驾购车需求标签"]:
        val = record.get(key)
        if val and str(val).lower() not in ("nan", "none", "null", ""):
            text = str(val)
            if len(text) > 2000:
                text = text[:2000] + "..."
            parts.append(f"\n【{key}】\n{text}")

    return "\n".join(parts)


def _clean_json(text: str) -> dict:
    """从 LLM 回复中提取 JSON"""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start:end + 1]
    return json.loads(text)


async def _extract_single(record: dict, attempt: int = 1) -> dict[str, Any]:
    """对单条记录调 LLM 抽取特征"""
    user_prompt = _build_user_prompt(record)

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": _EXTRACTOR_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 1024,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            API_URL,
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    raw = data["choices"][0]["message"]["content"]
    try:
        features = _clean_json(raw)
    except json.JSONDecodeError:
        if attempt < 2:
            await asyncio.sleep(1)
            return await _extract_single(record, attempt + 1)
        raise

    # 基础校验，填充默认值
    defaults = {
        "core_concerns": ["未知"],
        "decision_style": "未知",
        "purchase_motivation": "未知",
        "powertrain_preference": "未知",
        "brand_affinity": "未知",
        "price_sensitivity": "中",
        "objection_type": "无明确异议",
        "age_group": "未知",
        "family_structure": "未知",
        "budget_range": "未知",
    }
    for k, v in defaults.items():
        features.setdefault(k, v)

    return features


# ── 批量抽取（带并发控制）──

async def extract_features_all(records: list[dict], concurrency: int = 5) -> list[dict[str, Any]]:
    """对全部记录并行抽取特征，返回 [{features}, ...]"""
    semaphore = asyncio.Semaphore(concurrency)

    async def _task(idx: int, rec: dict) -> dict[str, Any]:
        async with semaphore:
            try:
                feats = await _extract_single(rec)
                logger.info(f"[特征抽取] {idx + 1}/{len(records)} 完成")
                return feats
            except Exception as e:
                logger.error(f"[特征抽取] {idx + 1}/{len(records)} 失败: {e}")
                return {
                    "core_concerns": ["未知"],
                    "decision_style": "未知",
                    "purchase_motivation": "未知",
                    "powertrain_preference": "未知",
                    "brand_affinity": "未知",
                    "price_sensitivity": "中",
                    "objection_type": "无明确异议",
                    "age_group": "未知",
                    "family_structure": "未知",
                    "budget_range": "未知",
                }

    tasks = [_task(i, rec) for i, rec in enumerate(records)]
    results = await asyncio.gather(*tasks)
    return results
