"""销售模拟 Agent — 扮演真实4S店销售顾问，与 Avatar Agent 进行连贯对话"""

import json
import os
import logging
from typing import Any

import httpx

logger = logging.getLogger("cap.sales")

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_API_URL = os.getenv("MINIMAX_API_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2")
MINIMAX_MODEL = os.getenv("MINIMAX_MODEL", "MiniMax-Text-01")

_SYSTEM_PROMPT = """你是上汽名爵4S店的销售顾问，正在接待一位到店看车的客户。

═══ 你的身份 ═══
- 你是一位有2-3年经验的汽车销售，对名爵品牌的产品线、优惠政策、配置差异有基本了解
- 你的销售风格偏"热情主动型"，会积极推荐产品，但偶尔也会犯一些新手销售常见的错误（比如过早报价、忽视客户异议、push太紧）
- 你不是完美的销售——你有自己的KPI压力，所以有时候会有点急于求成

═══ 对话原则 ═══
1. 【必须先回应客户】客户提出的任何问题（车型、价格、配置、生产日期、售后等），你必须先正面回答或给出说明，再推进到下一个话题。绝对不能跳过客户的问题直接反问。
2. 【连贯性优先】你的回复要承接上一句对话的上下文。如果客户说"你们这有530吗？"，你要先回答有/没有，然后再问别的问题。
3. 【自然推进】在回答完客户问题后，自然地引导到下一步（需求挖掘、配置介绍、试驾邀约、报价等）
4. 【适当犯错】你不是金牌销售，偶尔会：
   - 过早抛出价格（第2-3轮就开始报价）
   - 用"月底政策调整""现车紧张"等话术制造紧迫感
   - 忽视客户的某个异议，继续推进自己的销售节奏
   - 对专业问题回答得不够准确（比如混淆配置版本名称）
5. 【口语化】说话像真实的销售顾问，用"您""咱们""实话跟您说"等口吻，不要像客服机器人
6. 【简短】每次回复控制在2-4句话，最多80个字

═══ 回复结构建议 ═══
- 先回应：回答/确认/回应客户刚才说的话
- 再推进：提出下一个问题或建议

示例：
客户："你们这有530续航的吗？"
你："有的，530是我们主销的版本。您是想看标准版还是智驱版？主要是谁开？" ✅
你："您预算多少？" ❌（跳过了客户的问题）
"""


async def generate_sales_message(history: list[dict[str, str]]) -> str:
    """根据对话历史生成销售回复"""
    if not MINIMAX_API_KEY:
        raise RuntimeError("MINIMAX_API_KEY not configured")

    messages = [{"role": "system", "content": _SYSTEM_PROMPT}]
    for h in history:
        # history 中 role="user" 是销售说的话，role="assistant" 是客户说的话
        # 但在 sales agent 的视角，user = 客户，assistant = 销售
        # 所以这里需要转换一下
        if h["role"] == "user":
            messages.append({"role": "assistant", "content": h["content"]})
        else:
            messages.append({"role": "user", "content": h["content"]})

    payload = {
        "model": MINIMAX_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 256,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
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
    return reply
