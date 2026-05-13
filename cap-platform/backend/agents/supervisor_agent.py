"""督导 Agent — 旁观对话，输出评分"""

import json
import os
import logging
from typing import Any

import httpx

from personas.schema import Persona

logger = logging.getLogger("cap.supervisor")

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_API_URL = os.getenv("MINIMAX_API_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2")
MINIMAX_MODEL = os.getenv("MINIMAX_MODEL", "MiniMax-Text-01")


SUPERVISOR_SYSTEM_PROMPT = """你是一位资深汽车销售培训督导，拥有20年培训经验。

你的任务是：观察销售顾问与客户的完整对话，从专业角度进行结构化评估。

评估维度（每个0-100分）：
1. insight — 客户洞察：是否准确识别客户需求、痛点、决策动机
2. adaptation — 需求适配：是否根据客户特征调整沟通策略
3. matching — 方案匹配：推荐的产品/方案是否匹配客户需求
4. objection — 异议处理：面对客户异议时的应对是否专业有效
5. trust_building — 信任建立：是否通过专业性和真诚建立了客户信任

输出必须严格为以下 JSON 格式：
{
  "round_scores": {
    "insight": 0-100,
    "adaptation": 0-100,
    "matching": 0-100,
    "objection": 0-100,
    "trust_building": 0-100
  },
  "highlights": [
    {"round": 轮次, "text": "亮点描述"}
  ],
  "failures": [
    {"round": 轮次, "text": "失分点描述", "suggestion": "改进建议"}
  ],
  "persona_consistency": 0.0-1.0
}"""


async def evaluate(persona: Persona, history: list[dict[str, str]]) -> dict[str, Any]:
    """评估销售顾问的表现"""
    if not MINIMAX_API_KEY:
        logger.error("MINIMAX_API_KEY not set")
        raise RuntimeError("MINIMAX_API_KEY not configured")

    # 构建评估请求
    persona_text = persona.to_prompt_text()
    history_text = "\n".join(
        f"{'销售顾问' if h['role'] == 'user' else '客户'}：{h['content']}"
        for h in history
    )

    user_prompt = f"""【客户画像】
{persona_text}

【对话记录】
{history_text}

请根据上述对话，对销售顾问的表现进行评估。输出严格的 JSON 格式。"""

    messages = [
        {"role": "system", "content": SUPERVISOR_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    payload = {
        "model": MINIMAX_MODEL,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 2048,
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

    content = data["choices"][0]["message"]["content"]
    return _parse_evaluation(content)


def _parse_evaluation(content: str) -> dict[str, Any]:
    """解析评估结果 JSON"""
    try:
        parsed = json.loads(content)
        return {
            "round_scores": parsed.get("round_scores", {}),
            "highlights": parsed.get("highlights", []),
            "failures": parsed.get("failures", []),
            "persona_consistency": parsed.get("persona_consistency", 0.0),
        }
    except json.JSONDecodeError:
        pass

    if "```json" in content:
        try:
            json_str = content.split("```json")[1].split("```")[0].strip()
            parsed = json.loads(json_str)
            return {
                "round_scores": parsed.get("round_scores", {}),
                "highlights": parsed.get("highlights", []),
                "failures": parsed.get("failures", []),
                "persona_consistency": parsed.get("persona_consistency", 0.0),
            }
        except (IndexError, json.JSONDecodeError):
            pass

    logger.warning("Failed to parse evaluation JSON, returning defaults")
    return {
        "round_scores": {
            "insight": 50,
            "adaptation": 50,
            "matching": 50,
            "objection": 50,
            "trust_building": 50,
        },
        "highlights": [],
        "failures": [],
        "persona_consistency": 0.5,
    }
