"""LLM 解读聚类结果 → 生成典型分身 JSON

Step 4: 把每个聚类的成员特征汇总，喂给 LLM，让它"用人话"描述这个客群并生成典型分身。
"""

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

logger = logging.getLogger("cap.factory.synth")

API_KEY = os.getenv("MINIMAX_API_KEY", "").strip()
API_URL = os.getenv("MINIMAX_API_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2").strip()
MODEL = os.getenv("MINIMAX_MODEL", "MiniMax-Text-01").strip()


_SYNTH_SYSTEM = """你是一位资深用户画像分析师。你的任务是基于一个客群聚类的统计数据，合成一个能代表该客群的"典型客户分身"。

输出必须是严格的 JSON 对象（不要 markdown 代码块、不要解释），结构如下：

{
  "profile": {
    "name": "中文姓名（起一个常见但不刻板的名字，不要叫张建国/张宇这种太常见的）",
    "age": 数字,
    "gender": "M" 或 "F",
    "city": "代表性城市",
    "occupation": "代表性职业（10-25字）",
    "family": "家庭情况描述",
    "current_car": "现有车辆描述"
  },
  "purchase": {
    "budget_stated": "对外预算",
    "budget_real": "心理真实预算",
    "car_type": "意向车型类型",
    "stage": "典型购车阶段",
    "timeline": "典型购车时间线",
    "usage_scenarios": ["3-5个典型用车场景"]
  },
  "pain_points": [
    {"topic": "痛点主题（4-8字）", "intensity": 0.5-0.95, "detail": "该聚类共性痛点"}
  ],
  "hidden_info": [
    {"content": "该聚类典型隐藏诉求", "trigger_condition": "触发场景"}
  ],
  "objections": [
    {"content": "精炼异议短语（8字以内）", "trigger_topic": "触发话题", "resistance": 0.4-0.85}
  ],
  "competitor_awareness": "该聚类典型竞品认知（30-80字）",
  "behavior": {
    "anti_guide": 0-1, "price_sensitivity": 0-1, "expressiveness": 0-1,
    "decisiveness": 0-1, "tech_literacy": 0-1
  },
  "communication": {
    "style": "典型沟通风格",
    "description": "30-60字描述",
    "speech_patterns": ["3-5条短小口头禅（2-6字）"]
  },
  "tags": ["4-5个标签，体现该聚类的核心特征"]
}

【关键纪律】
1. 所有字段必须输出，JSON 必须有效
2. 不要编造数据，所有内容必须基于提供的聚类统计
3. 年龄、性别、城市、职业要体现该聚类的共性倾向
4. speech_patterns 尽量从真实客户话语里挑选"""


def _summarize_cluster(records: list[dict], features_list: list[dict]) -> str:
    """汇总一个聚类的统计特征"""
    from collections import Counter

    n = len(records)
    lines = [f"聚类内客户数: {n}"]

    # 基础统计
    ages = []
    genders = Counter()
    cities = Counter()
    for r in records:
        age = r.get("年龄阶段") or r.get("年龄")
        if age:
            ages.append(str(age))
        g = r.get("性别")
        if g:
            genders[g] += 1
        c = r.get("常住地城市")
        if c:
            cities[c] += 1

    if ages:
        lines.append(f"年龄分布: {', '.join(ages[:10])}")
    if genders:
        lines.append(f"性别分布: {dict(genders)}")
    if cities:
        lines.append(f"主要城市: {dict(cities.most_common(5))}")

    # 特征统计
    decision_styles = Counter()
    motivations = Counter()
    powertrains = Counter()
    price_sens = Counter()
    objections = Counter()
    concerns_all = []

    for f in features_list:
        decision_styles[f.get("decision_style", "未知")] += 1
        motivations[f.get("purchase_motivation", "未知")] += 1
        powertrains[f.get("powertrain_preference", "未知")] += 1
        price_sens[f.get("price_sensitivity", "未知")] += 1
        objections[f.get("objection_type", "未知")] += 1
        concerns = f.get("core_concerns", [])
        if isinstance(concerns, list):
            concerns_all.extend(concerns)

    lines.append(f"\n决策风格分布: {dict(decision_styles)}")
    lines.append(f"购车动机分布: {dict(motivations)}")
    lines.append(f"动力类型偏好: {dict(powertrains)}")
    lines.append(f"价格敏感度分布: {dict(price_sens)}")
    lines.append(f"异议类型分布: {dict(objections)}")

    # 关注点词频
    concern_counts = Counter(concerns_all)
    lines.append(f"高频关注点: {dict(concern_counts.most_common(8))}")

    # 收集真实原话（从对话文本中）
    quotes = []
    for r in records[:10]:
        for key in ["外呼通话录音小结", "试驾小结"]:
            val = r.get(key)
            if val and len(str(val)) > 10:
                quotes.append(str(val)[:100])
                break
        if len(quotes) >= 5:
            break
    if quotes:
        lines.append(f"\n真实客户原话样本:")
        for q in quotes:
            lines.append(f"  - {q}")

    return "\n".join(lines)


def _clean_json(text: str) -> dict:
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


async def synthesize_cluster(
    cluster_id: int,
    cluster_title: str,
    records: list[dict],
    features_list: list[dict],
    attempt: int = 1,
) -> dict[str, Any]:
    """为一个聚类生成典型分身"""
    summary = _summarize_cluster(records, features_list)

    user_prompt = f"""请基于以下客群聚类统计数据，生成一个典型客户分身的 JSON。

聚类编号: {cluster_id}
聚类名称: {cluster_title}

{summary}

请仔细分析这个聚类的共性特征，合成一个能代表该客群的典型虚拟分身 JSON。"""

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": _SYNTH_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.6,
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(
            API_URL,
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    raw = data["choices"][0]["message"]["content"]
    try:
        persona = _clean_json(raw)
    except json.JSONDecodeError:
        if attempt < 2:
            await __import__("asyncio").sleep(2)
            return await synthesize_cluster(cluster_id, cluster_title, records, features_list, attempt + 1)
        raise

    # 填充统计元数据
    persona["_cluster_title"] = cluster_title
    persona["_cluster_stats"] = {
        "unique_customers": len(records),
        "top_concerns": [],
    }

    logger.info(f"聚类 {cluster_id} ({cluster_title}) 典型分身生成完成: {persona.get('profile', {}).get('name', '?')}")
    return persona
