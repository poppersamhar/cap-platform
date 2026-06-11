"""Extractor Agent — 从客户数据（Excel/文本）中提取结构化 Persona

支持两种输入：
1. Excel 文件：包含客户基础信息表 + 对话记录表
2. 纯文本：销售-客户对话记录
"""

import json
import os
import logging
from typing import Any

import httpx

logger = logging.getLogger("cap.extractor")

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_API_URL = os.getenv("MINIMAX_API_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2")
MINIMAX_MODEL = os.getenv("MINIMAX_MODEL", "MiniMax-Text-01")


_EXTRACTOR_SYSTEM_PROMPT = """你是一位资深的用户画像分析师，专门从客户数据中提取客户数字分身（Persona）的结构化信息。

## 你的任务
从提供的客户数据中，深度分析客户的行为模式、语言习惯、购车需求和心理状态，输出严格符合以下 Schema 的 JSON。

## 输入数据格式
输入可能包含两部分：
1. 【客户基础信息】—— 结构化的客户资料（姓名、年龄、城市、职业、预算、车型偏好等）
2. 【销售对话记录】—— 销售与客户的真实对话文本

你需要综合两部分信息，提取出一个完整的 Persona。

## 提取维度与规则

### 1. profile（基础信息）
- name: 客户姓名（优先使用基础信息中的，如未提供则根据性别和年龄起一个典型中文名）
- age: 年龄（18-80之间）
- gender: "M" 或 "F"
- city: 城市
- occupation: 职业（如"个体经营小老板""制造业技术工人"等）
- family: 家庭情况（一句话描述）
- current_car: 现有车辆（"无车（首次购车）"或具体车型）

### 2. purchase（购车画像）
- budget_stated: 对外声称的预算
- budget_real: 真实心理预算（从对话中推断出的实际可接受范围，通常比对外预算高或低一些）
- car_type: 意向车型描述（如"纯电动紧凑型轿车""新能源SUV"）
- stage: 购车阶段（如"看车对比阶段""意向明确阶段"）
- timeline: 购车时间线（如"希望3月前提车""不急，半年内"）
- usage_scenarios: 用车场景列表（如["日常通勤","周末出游"]）

### 3. pain_points（核心痛点）
从对话和基础信息中识别客户的担忧和顾虑，每个痛点包含：
- topic: 痛点主题（5-10字概括）
- intensity: 强度 0.0-1.0
- detail: 详细描述
提取 2-5 个痛点。

### 4. hidden_info（隐藏信息）
识别客户"不主动说"的敏感信息：
- content: 隐藏内容
- trigger_condition: 触发条件（什么样的提问会让客户透露）
提取 1-3 个。

### 5. objections（常见异议）
识别客户对销售话术的抵触反应——即客户明确表达的不满、顾虑或反对意见：
- content: 异议内容（用精炼短语总结客户的反对意见，8字以内，不要复制对话原文）
  ✅ 正确示例："优惠不够"、"担心续航"、"品牌没听过"、"配置太低"
  ❌ 错误示例："那个现金优惠能再多给点吗？人家不是都有优惠吗？"（这是对话原文，不是精炼异议）
- trigger_topic: 触发话题（是什么销售行为引发了这个异议）
- resistance: 抵触强度 0.0-1.0
提取 2-5 个。

### 6. competitor_awareness（竞品认知）
一句话总结客户对竞品的了解和态度。

### 7. behavior（行为参数）
基于数据和对话表现，给 0-1 的评分：
- anti_guide: 抗拒被引导的程度
- price_sensitivity: 价格敏感度
- expressiveness: 表达欲
- decisiveness: 决策果断度
- tech_literacy: 技术理解力

### 8. communication（沟通风格）
- style: 风格标签（如"直接干脆""犹豫谨慎""随和健谈"）
- description: 风格描述（20-50字）
- speech_patterns: 口头禅列表（3-8 条）
  口头禅定义：客户在对话中反复出现的**短小习惯性表达**，通常是2-6个字的词语或短语，能体现个人语言特色。
  ✅ 正确示例："说实话"、"那个"、"您懂的"、"我先看看"、"有点贵"、"还行吧"
  ❌ 错误示例："你好，斑马，打开座椅通风"、"这斑马不理人，没事的话我先走了"（这是完整句子，不是口头禅）
  注意：口头禅必须是客户真实说过的，但不能是完整的长句。

### 9. tags（标签）
3-6 个关键词标签，概括客户类型。

## 输出格式
必须且只能输出一个合法的 JSON 对象，不要任何解释、markdown 代码块标记或额外文字。

Schema:
{
  "profile": {"name":"","age":30,"gender":"M","city":"","occupation":"","family":"","current_car":""},
  "purchase": {"budget_stated":"","budget_real":"","car_type":"","stage":"","timeline":"","usage_scenarios":[]},
  "pain_points": [{"topic":"","intensity":0.5,"detail":""}],
  "hidden_info": [{"content":"","trigger_condition":""}],
  "objections": [{"content":"","trigger_topic":"","resistance":0.5}],
  "competitor_awareness": "",
  "behavior": {"anti_guide":0.5,"price_sensitivity":0.5,"expressiveness":0.5,"decisiveness":0.5,"tech_literacy":0.5},
  "communication": {"style":"","description":"","speech_patterns":[]},
  "tags": []
}

## 纪律
- 基础信息优先使用结构化数据，对话用于验证和补充
- 口头禅必须是客户真实说过的话，不能编造
- intensity 和 resistance 的评分要有依据
- 如果某个字段无法推断，使用最合理的默认值"""


def _clean_json_output(raw: str) -> str:
    """清理 LLM 返回的 JSON，去除 markdown 代码块等噪音"""
    raw = raw.strip()
    if raw.startswith("```"):
        lines = raw.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        raw = "\n".join(lines)
    return raw.strip()


async def extract_persona(data_text: str) -> dict[str, Any]:
    """从客户数据文本提取 Persona JSON

    data_text 格式示例：
    === 客户基础信息 ===
    姓名: 张三
    年龄: 35
    ...

    === 销售对话记录 ===
    销售：您好...
    客户：嗯...
    """
    if not MINIMAX_API_KEY:
        raise RuntimeError("MINIMAX_API_KEY not configured")

    cleaned = data_text.strip()
    if len(cleaned) > 20000:
        cleaned = cleaned[:20000]
        logger.warning("Data text truncated to 20000 chars")

    messages = [
        {"role": "system", "content": _EXTRACTOR_SYSTEM_PROMPT},
        {"role": "user", "content": f"以下是一位客户的数据，请提取客户数字分身信息：\n\n{cleaned}"},
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

    raw_content = data["choices"][0]["message"]["content"]
    clean_content = _clean_json_output(raw_content)

    usage = data.get("usage", {})

    try:
        persona_data = json.loads(clean_content)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse extractor output as JSON: {e}\nRaw: {raw_content[:500]}")
        raise RuntimeError(f"Extractor returned invalid JSON: {e}")

    # 基础校验
    required_roots = ["profile", "purchase", "pain_points", "hidden_info", "objections",
                      "competitor_awareness", "behavior", "communication", "tags"]
    for key in required_roots:
        if key not in persona_data:
            persona_data[key] = {} if key in ("profile", "purchase", "behavior", "communication") else []

    # 后处理：过滤质量不合格的口头禅和异议
    _post_process_persona(persona_data)

    import uuid
    persona_data["id"] = f"indiv_{uuid.uuid4().hex[:8]}"

    persona_data["_usage"] = {
        "prompt_tokens": usage.get("prompt_tokens", 0),
        "completion_tokens": usage.get("completion_tokens", 0),
        "total_tokens": usage.get("total_tokens", 0),
        "cache_read_input_tokens": usage.get("cache_read_input_tokens", 0),
        "cache_creation_input_tokens": usage.get("cache_creation_input_tokens", 0),
    }

    logger.info(f"Extractor success: id={persona_data['id']}, name={persona_data.get('profile', {}).get('name', 'unknown')}")
    return persona_data


def _post_process_persona(persona_data: dict[str, Any]) -> None:
    """后处理：过滤模型误提取的口头禅和异议"""
    import re

    # 1. 过滤口头禅——太长或像完整句子的去掉
    comm = persona_data.get("communication", {})
    patterns = comm.get("speech_patterns", [])
    filtered_patterns = []
    for p in patterns:
        p = p.strip()
        # 去掉书名号包裹
        if p.startswith("「") and p.endswith("」"):
            p = p[1:-1]
        if p.startswith("'") and p.endswith("'"):
            p = p[1:-1]
        if p.startswith('"') and p.endswith('"'):
            p = p[1:-1]
        # 过滤条件：超过10个字、包含逗号/句号/问号/感叹号、或明显是完整句子
        if len(p) > 10:
            continue
        if re.search(r'[，。！？；]', p):
            continue
        if len(p) >= 2:
            filtered_patterns.append(p)
    comm["speech_patterns"] = filtered_patterns[:8]

    # 2. 过滤异议——太长或明显是原文复制的去掉
    objections = persona_data.get("objections", [])
    filtered_objections = []
    for obj in objections:
        content = obj.get("content", "")
        # 去掉书名号包裹
        if content.startswith("「") and content.endswith("」"):
            content = content[1:-1]
        if content.startswith("'") and content.endswith("'"):
            content = content[1:-1]
        if content.startswith('"') and content.endswith('"'):
            content = content[1:-1]
        # 过滤条件：超过15个字、包含多个标点符号（像完整句子）
        if len(content) > 15:
            continue
        if content.count("，") + content.count("。") + content.count("？") + content.count("！") >= 2:
            continue
        if len(content) >= 2:
            obj["content"] = content
            filtered_objections.append(obj)
    persona_data["objections"] = filtered_objections[:5]
