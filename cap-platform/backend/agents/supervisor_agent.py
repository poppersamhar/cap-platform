"""Supervisor Agent — 实时督导评估（Training / Research 双模式）

Training 模式：资深汽车销售培训督导，逐轮诊断销售技巧缺陷
Research 模式：资深用户研究专家，逐轮诊断访谈深度与信息挖掘质量
"""

import asyncio
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

# 限制 Supervisor 并发数，避免同时大量请求打到 MiniMax API 导致 502/超时
_SUPERVISOR_SEMAPHORE = asyncio.Semaphore(3)
_MAX_RETRIES = 2
_BASE_RETRY_DELAY = 2.0


# ── Training Mode: 销售培训督导 ──
_TRAINING_SYSTEM_PROMPT = """你是一位资深汽车销售培训督导，拥有20年一线培训与门店辅导经验。

你的核心任务是：逐轮观察销售顾问与客户的对话，像现场旁听一样精准定位每一次"做对"和"做错"的时刻，并给出可立即落地的话术改进。

## 评估维度（每项 0-100 分）
1. needs_discovery — 需求挖掘：是否通过有效提问识别了客户的显性需求（预算、车型、时间）和隐性需求（家庭顾虑、面子、安全感）
2. trust_building — 信任建立：是否展现专业性、真诚度和同理心，让客户愿意继续沟通
3. objection_handling — 异议处理：面对价格、竞品、犹豫等抗拒时，是否先接纳情绪再给信息，而非硬推
4. solution_matching — 方案匹配：推荐的产品/方案是否精准对应已识别的需求，而非背标准话术
5. closing_awareness — 成交意识：是否识别购买信号，并自然推进下一步（试驾、报价、约时间），而非生硬逼单

## 诊断要求（必须执行）

### A. 跨轮次关联分析
不要孤立评价单轮。必须追踪：
- 客户在 X 轮提到的某个信号/顾虑，销售顾问在后续 Y 轮是否跟进、回避或转移了话题
- 如果客户透露了隐性需求（如"家里老人坐车不方便"），销售后续是否关联到了具体配置推荐
- 如果销售在第 N 轮犯了错，后续是否补救

### B. 对标 Persona 隐藏信息（Hidden Info）
客户的隐藏信息列表已提供。逐条检查销售顾问是否通过合适的问题触发了这些信息的暴露：
- 已触发：指出是在哪一轮通过什么问题触发的
- 未触发：指出这是一个 missed opportunity，并给出应该问什么

### C. 对标 Persona 核心痛点（Pain Points）
逐条检查销售顾问是否识别并回应了客户的核心痛点：
- 已识别：指出是哪一轮识别的，回应是否到位
- 未识别：指出遗漏，并给出更好的挖掘/回应方式

### D. 话术替换（Better Approach）
对于每个 failures 条目，必须给出：
- 当时的客户原话或情境
- 销售顾问实际说了什么（导致失分）
- 更好的回应话术（可直接背诵使用的版本，控制在 30 字以内）

## 输出格式
必须且只能输出合法 JSON，不要 Markdown 代码块、不要解释文字：

{
  "round_scores": {
    "needs_discovery": 0-100,
    "trust_building": 0-100,
    "objection_handling": 0-100,
    "solution_matching": 0-100,
    "closing_awareness": 0-100
  },
  "highlights": [
    {"round": 整数, "text": "具体亮点描述，说明做对了什么"}
  ],
  "failures": [
    {
      "round": 整数,
      "text": "失分点描述",
      "suggestion": "改进方向",
      "better_approach": "更好的话术：...（30字以内可直接用）"
    }
  ],
  "missed_opportunities": [
    {"item": "遗漏点描述", "should_ask": "当时应该问的话术"}
  ],
  "hidden_info_check": [
    {"content": "隐藏信息内容", "triggered": true/false, "round": null或整数, "note": "备注"}
  ],
  "pain_points_check": [
    {"topic": "痛点主题", "recognized": true/false, "round": null或整数, "response_quality": "good/fair/poor", "note": "备注"}
  ],
  "persona_consistency": 0.0-1.0,
  "coaching_summary": "本轮的整体教练点评，50字以内，口语化、直接、有鞭策感"
}"""


# ── Research Mode: 用户研究专家 ──
_RESEARCH_SYSTEM_PROMPT = """你是一位资深用户研究专家，拥有15年定性访谈经验，擅长汽车消费者深度访谈（IDI）与焦点小组（FGD）设计。

你的核心任务是：逐轮观察研究员与客户的对话，诊断访谈技巧、信息挖掘深度和洞察质量。

## 评估维度（每项 0-100 分）
1. question_quality — 提问质量：问题是否开放式、无引导性、层层递进；是否存在"是/否"封闭式提问泛滥、或预设立场式提问
2. information_completeness — 信息完整度：是否覆盖了客户画像的各维度（需求、场景、决策路径、竞品认知、情感动机）
3. hidden_needs_uncovered — 隐藏需求挖掘：是否通过探针问题（probing）触发了客户隐藏信息的暴露
4. emotional_insight — 情感洞察：是否捕捉到语言背后的情绪变化（犹豫、兴奋、防御、焦虑），并追问深层原因
5. bias_avoidance — 偏见规避：是否避免了确认偏误、社会期许偏差、诱导性总结；是否让客户感到被倾听而非被说服

## 诊断要求（必须执行）

### A. 跨轮次关联分析
- 客户在 X 轮提到的某个线索，研究员在后续 Y 轮是否深入追问，还是跳过了
- 如果客户给出了模糊回答（如"还可以吧"），研究员是否用 laddering（阶梯式追问）深挖到了真实态度
- 访谈是否存在"问题列表打卡式"流水账，而非根据回答动态调整

### B. 对标 Persona 隐藏信息（Hidden Info）
逐条检查研究员是否触发了客户隐藏信息的暴露。研究员的任务就是让隐藏信息浮出水面：
- 已触发：指出是哪一轮通过什么追问触发的
- 未触发：这是一个关键 missed opportunity，给出应使用的探针问题

### C. 对标 Persona 核心痛点（Pain Points）
逐条检查研究员是否识别到了客户的核心痛点，并挖掘了痛点的深层成因：
- 已识别：是否只停留在表面，还是挖到了"为什么痛"
- 未识别：指出遗漏，并给出更好的追问路径

### D. 追问话术替换（Better Approach）
对于每个 failures 条目，给出：
- 当时的客户原话或情境
- 研究员实际说了什么（导致信息流失）
- 更好的追问话术（更开放、更具体、更能激发真实表达）

## 输出格式
必须且只能输出合法 JSON，不要 Markdown 代码块、不要解释文字：

{
  "round_scores": {
    "question_quality": 0-100,
    "information_completeness": 0-100,
    "hidden_needs_uncovered": 0-100,
    "emotional_insight": 0-100,
    "bias_avoidance": 0-100
  },
  "highlights": [
    {"round": 整数, "text": "具体亮点描述"}
  ],
  "failures": [
    {
      "round": 整数,
      "text": "失分点描述",
      "suggestion": "改进方向",
      "better_approach": "更好的追问话术：..."
    }
  ],
  "missed_opportunities": [
    {"item": "遗漏点描述", "should_ask": "当时应该使用的探针问题"}
  ],
  "hidden_info_check": [
    {"content": "隐藏信息内容", "triggered": true/false, "round": null或整数, "note": "备注"}
  ],
  "pain_points_check": [
    {"topic": "痛点主题", "recognized": true/false, "round": null或整数, "depth": "surface/deep", "note": "备注"}
  ],
  "persona_consistency": 0.0-1.0,
  "coaching_summary": "本轮的整体访谈诊断，50字以内，直接指出最大问题"
}"""


def _build_evaluation_prompt(persona: Persona, history: list[dict], mode: str) -> str:
    """构建包含完整上下文的评估 prompt"""

    # 格式化对话历史
    lines = []
    round_num = 0
    for h in history:
        role = h.get("role", "")
        content = h.get("content", "")
        if role == "user":
            round_num += 1
            lines.append(f"【第 {round_num} 轮 — 销售顾问】{content}")
        elif role == "assistant":
            lines.append(f"【第 {round_num} 轮 — 客户】{content}")
        else:
            lines.append(f"[{role}] {content}")

    history_text = "\n".join(lines)
    current_round = round_num

    # 提取 Persona 检查清单
    hidden_items = "\n".join(
        f"- {hi.content}（触发条件：{hi.trigger_condition}）"
        for hi in persona.hidden_info
    ) if persona.hidden_info else "无"

    pain_items = "\n".join(
        f"- {pp.topic}（强度 {pp.intensity:.0%}）：{pp.detail}"
        for pp in persona.pain_points
    ) if persona.pain_points else "无"

    return f"""【评估模式】{mode}
【当前轮次】{current_round}

【客户画像】
{persona.to_prompt_text()}

【待检查清单 — 隐藏信息】
{hidden_items}

【待检查清单 — 核心痛点】
{pain_items}

【完整对话记录】
{history_text}

请根据上述信息，对 {'销售顾问' if mode == 'training' else '研究员'} 的表现进行逐轮深度诊断。输出严格的 JSON 格式。"""


async def evaluate(persona: Persona, history: list[dict], mode: str = "training") -> dict[str, Any]:
    """评估表现（带并发限流 + 指数退避重试）

    Args:
        persona: 客户数字分身
        history: 对话历史
        mode: "training" 或 "research"
    """
    if not MINIMAX_API_KEY:
        logger.error("MINIMAX_API_KEY not set")
        raise RuntimeError("MINIMAX_API_KEY not configured")

    system_prompt = _TRAINING_SYSTEM_PROMPT if mode == "training" else _RESEARCH_SYSTEM_PROMPT
    user_prompt = _build_evaluation_prompt(persona, history, mode)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    payload = {
        "model": MINIMAX_MODEL,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 4096,
    }

    async with _SUPERVISOR_SEMAPHORE:
        last_err = None
        for attempt in range(_MAX_RETRIES + 1):
            try:
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
                usage = data.get("usage", {})
                result = _parse_evaluation(content, mode)
                result["_usage"] = {
                    "prompt_tokens": usage.get("prompt_tokens", 0),
                    "completion_tokens": usage.get("completion_tokens", 0),
                    "total_tokens": usage.get("total_tokens", 0),
                    "cache_read_input_tokens": usage.get("cache_read_input_tokens", 0),
                    "cache_creation_input_tokens": usage.get("cache_creation_input_tokens", 0),
                }
                return result
            except Exception as e:
                last_err = e
                if attempt < _MAX_RETRIES:
                    delay = _BASE_RETRY_DELAY * (2 ** attempt)
                    logger.warning(
                        f"Supervisor evaluate attempt {attempt + 1} failed ({e}), retrying in {delay}s..."
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Supervisor evaluate failed after {_MAX_RETRIES + 1} attempts: {e}")
        raise last_err


def _parse_evaluation(content: str, mode: str) -> dict[str, Any]:
    """解析评估结果 JSON，兼容 markdown 代码块"""
    raw = content.strip()

    # 去除 markdown 代码块
    if raw.startswith("```"):
        lines = raw.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines).strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Failed to parse evaluation JSON, attempting recovery")
        parsed = _fallback_parse(raw)

    # 统一默认值
    training_dims = ["needs_discovery", "trust_building", "objection_handling", "solution_matching", "closing_awareness"]
    research_dims = ["question_quality", "information_completeness", "hidden_needs_uncovered", "emotional_insight", "bias_avoidance"]
    dims = training_dims if mode == "training" else research_dims

    round_scores = parsed.get("round_scores", {})
    for d in dims:
        if d not in round_scores:
            round_scores[d] = 50

    return {
        "mode": mode,
        "round_scores": round_scores,
        "highlights": parsed.get("highlights", []),
        "failures": parsed.get("failures", []),
        "missed_opportunities": parsed.get("missed_opportunities", []),
        "hidden_info_check": parsed.get("hidden_info_check", []),
        "pain_points_check": parsed.get("pain_points_check", []),
        "persona_consistency": parsed.get("persona_consistency", 0.0),
        "coaching_summary": parsed.get("coaching_summary", ""),
    }


def _fallback_parse(raw: str) -> dict:
    """尝试从混乱输出中提取 JSON"""
    # 尝试找第一个 { 和最后一个 }
    try:
        start = raw.index("{")
        end = raw.rindex("}")
        return json.loads(raw[start:end + 1])
    except (ValueError, json.JSONDecodeError):
        pass

    logger.error(f"Completely failed to parse evaluation output: {raw[:500]}")
    return {}
