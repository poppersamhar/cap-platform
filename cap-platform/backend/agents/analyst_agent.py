"""Analyst Agent — 生成最终分析报告"""

import json
import os
import logging

import httpx

logger = logging.getLogger("cap.analyst")

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_API_URL = os.getenv("MINIMAX_API_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2")
MINIMAX_MODEL = os.getenv("MINIMAX_MODEL", "MiniMax-Text-01")


def _build_training_prompt(history: list[dict], evaluation: dict | None) -> str:
    """构建销售对练分析 Prompt"""
    dialog = "\n".join(
        f"{'销售' if m['role'] == 'user' else '客户'}：{m['content']}"
        for m in history
    )

    eval_text = ""
    if evaluation:
        eval_text = f"""
督导评分：
- 客户洞察：{evaluation.get('round_scores', [{}])[0].get('insight', 'N/A')}
- 需求适配：{evaluation.get('round_scores', [{}])[0].get('adaptation', 'N/A')}
- 方案匹配：{evaluation.get('round_scores', [{}])[0].get('matching', 'N/A')}
- 异议处理：{evaluation.get('round_scores', [{}])[0].get('objection', 'N/A')}
- 信任建立：{evaluation.get('round_scores', [{}])[0].get('trust_building', 'N/A')}
- 人设一致性：{evaluation.get('persona_consistency', 'N/A')}
"""

    return f"""你是一位资深汽车销售培训导师。请根据以下销售对练记录，生成一份结构化的分析报告。

对话记录：
{dialog}

{eval_text}

请输出 JSON 格式的报告，包含以下字段：
{{
  "overall_score": 0-100 的综合评分,
  "grade": "A/B/C/D 等级",
  "dimension_scores": {{
    "insight": 客户洞察分数,
    "adaptation": 需求适配分数,
    "matching": 方案匹配分数,
    "objection": 异议处理分数,
    "trust_building": 信任建立分数
  }},
  "highlights": [
    {{"round": 轮次, "text": "具体亮点描述"}}
  ],
  "failures": [
    {{"round": 轮次, "text": "具体问题", "suggestion": "改进建议"}}
  ],
  "improvement_suggestions": ["改进建议1", "改进建议2"],
  "recommended_next_scenario": "建议下一步练习的场景"
}}

分析维度：
1. 开场是否自然，有没有建立 rapport
2. 需求挖掘是否深入，有没有使用 SPIN 技巧
3. 方案呈现是否针对客户需求
4. 异议处理是否有效，有没有转移或对抗
5. 收尾是否有明确的 next step
6. 整体节奏把控和情绪感知能力

只输出 JSON，不要任何其他文字。"""


def _build_research_prompt(history: list[dict], persona: dict) -> str:
    """构建调研访谈分析 Prompt"""
    dialog = "\n".join(
        f"{'研究员' if m['role'] == 'user' else '受访者'}：{m['content']}"
        for m in history
    )

    return f"""你是一位用户研究专家。请根据以下用户调研访谈记录，生成一份结构化的洞察报告。

受访者画像：
- 姓名：{persona.get('profile', {}).get('name', '未知')}
- 年龄：{persona.get('profile', {}).get('age', '未知')}
- 城市：{persona.get('profile', {}).get('city', '未知')}
- 职业：{persona.get('profile', {}).get('occupation', '未知')}
- 购车需求：{persona.get('purchase', {}).get('car_type', '未知')}
- 预算：{persona.get('purchase', {}).get('budget_stated', '未知')}
- 购车阶段：{persona.get('purchase', {}).get('stage', '未知')}

对话记录：
{dialog}

请输出 JSON 格式的报告，包含以下字段：
{{
  "needs_ranking": [
    {{"need": "需求描述", "importance": 1-10}}
  ],
  "pain_points_analysis": "痛点分析总结",
  "config_acceptance": "对车型配置的接受度分析",
  "price_sensitivity": "价格敏感度分析",
  "competitor_preference": "竞品偏好分析",
  "conclusions": "核心结论",
  "recommendations": ["建议1", "建议2", "建议3"]
}}

分析维度：
1. 用户的真实需求优先级排序
2. 核心痛点和阻碍因素
3. 对产品/方案的接受度
4. 价格敏感度和预算弹性
5. 竞品认知和偏好
6. 购车决策的关键影响因素

只输出 JSON，不要任何其他文字。"""


def _parse_json(text: str) -> dict:
    """从回复中提取 JSON"""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning(f"JSON parse failed: {e}, text: {text[:200]}")
        return {}


async def generate_report(
    mode: str,
    history: list[dict],
    evaluation: dict | None,
    persona: dict | None,
) -> dict:
    """调用 MiniMax API 生成分析报告"""
    if not MINIMAX_API_KEY:
        logger.error("MINIMAX_API_KEY not set")
        raise RuntimeError("MINIMAX_API_KEY not configured")

    if mode == "training":
        system_prompt = _build_training_prompt(history, evaluation)
    else:
        system_prompt = _build_research_prompt(history, persona or {})

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "请生成报告"},
    ]

    payload = {
        "model": MINIMAX_MODEL,
        "messages": messages,
        "temperature": 0.5,
        "max_tokens": 1024,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
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

    reply = data["choices"][0]["message"]["content"].strip()
    report = _parse_json(reply)

    if not report:
        logger.warning("Analyst agent returned empty report, using fallback")
        report = _fallback_report(mode, history, evaluation)

    return report


def _fallback_report(mode: str, history: list[dict], evaluation: dict | None) -> dict:
    """备用报告"""
    if mode == "training":
        return {
            "overall_score": 60,
            "grade": "C",
            "dimension_scores": {
                "insight": 60,
                "adaptation": 60,
                "matching": 60,
                "objection": 60,
                "trust_building": 60,
            },
            "highlights": [],
            "failures": [],
            "improvement_suggestions": ["继续练习，提升对话技巧"],
            "recommended_next_scenario": "建议继续练习",
        }
    else:
        return {
            "needs_ranking": [],
            "pain_points_analysis": "调研记录已保存",
            "config_acceptance": "待分析",
            "price_sensitivity": "待分析",
            "competitor_preference": "待分析",
            "conclusions": "调研完成",
            "recommendations": ["查看详细对话记录"],
        }
