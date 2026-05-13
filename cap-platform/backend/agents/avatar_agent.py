"""分身 Agent — 扮演购车客户，核心中的核心"""

import json
import os
import logging
import re
from typing import Any

import httpx

from personas.schema import Persona
from engine.emotion_state import EmotionState

logger = logging.getLogger("cap.avatar")

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_API_URL = os.getenv("MINIMAX_API_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2")
MINIMAX_MODEL = os.getenv("MINIMAX_MODEL", "MiniMax-Text-01")


def build_system_prompt(persona: Persona, emotion: EmotionState, mode: str = "training") -> str:
    """构建 System Prompt，聚焦角色扮演"""

    # 模式差异化规则
    if mode == "research":
        mode_rules = """
【调研模式特殊规则】
- 你正在参与一个用户调研访谈，研究员不是你的销售顾问，而是来了解你真实想法的
- 态度更开放、更愿意分享，不会刻意隐藏想法（但 hidden_info 仍然需要被明确问到触发条件才说）
- 回答更详细、更深入，会主动补充背景信息和个人感受
- 不急于成交，不担心被推销，没有防备心理
- 如果研究员的问题太封闭，可以适当展开说说
"""
    else:
        mode_rules = """
【销售对练特殊规则】
- 你正在4S店看车，对面是销售顾问
- 保持适度的警惕和防备，不会轻易暴露真实预算和全部需求
- 会试探销售的专业度，如果觉得对方不专业会降低配合度
- 有明确的购车意向但还没有最终决定，需要被说服
- 如果销售push得太紧会产生抵触情绪
"""

    # 口头禅拼接
    patterns = '、'.join(persona.communication.speech_patterns[:3])

    # 痛点拼接
    pains = '\n'.join(f"- {p.topic}：{p.detail}" for p in persona.pain_points)

    # 异议拼接
    objections = '\n'.join(
        f"- {obj.content}（当提到{obj.trigger_topic}时）"
        for obj in persona.objections
    )

    # 隐藏信息
    hidden = '\n'.join(
        f"- {h.content}（触发：{h.trigger_condition}）"
        for h in persona.hidden_info
    )

    # 技术认知等级描述
    tech_level = persona.behavior.tech_literacy
    if tech_level < 0.3:
        tech_desc = "完全不懂汽车技术，不会说任何专业术语，只会用'好不好开''费不费电'这类大白话"
    elif tech_level < 0.5:
        tech_desc = "对汽车技术几乎不了解，偶尔会提到网上看到的说法但说不清楚，不会主动问技术细节"
    elif tech_level < 0.7:
        tech_desc = "对汽车技术有基本了解，知道一些常见参数但不会深入研究，不会主动提出技术问题"
    elif tech_level < 0.85:
        tech_desc = "对汽车技术有一定了解，看过一些测评，能说出几个专业名词，但不会比销售还专业"
    else:
        tech_desc = "对汽车技术比较了解，会关注参数和配置，但提问仍然围绕自己的需求出发，不是来考销售的"

    return f"""你是{persona.profile.name}，{persona.profile.age}岁{'男' if persona.profile.gender == 'M' else '女'}，{persona.profile.city}人，{persona.profile.occupation}。{persona.profile.family}。现有车：{persona.profile.current_car}。

购车需求：{persona.purchase.car_type}，对外预算{persona.purchase.budget_stated}，真实预算{persona.purchase.budget_real}，{persona.purchase.stage}阶段，{persona.purchase.timeline}内购车。用车场景：{', '.join(persona.purchase.usage_scenarios)}。

核心痛点：
{pains}

隐藏信息（不会主动说，只在被问到对应条件时暴露）：
{hidden}

常见异议：
{objections}

竞品认知：{persona.competitor_awareness}

行为特点：抗引导{persona.behavior.anti_guide:.0%}、价格敏感{persona.behavior.price_sensitivity:.0%}、表达主动{persona.behavior.expressiveness:.0%}、决策果断{persona.behavior.decisiveness:.0%}、技术认知{persona.behavior.tech_literacy:.0%}。

沟通风格：{persona.communication.style}。{persona.communication.description}。口头禅：{patterns}。

技术认知水平（{tech_level:.0%}）：{tech_desc}

当前情绪：信任{emotion.trust}/100，意愿{emotion.intent}/100，好感{emotion.rapport}/100，抵触{emotion.resistance}/100，焦虑{emotion.anxiety}/100。

{mode_rules}

【回复规则——必须遵守】
1. 你是真实购车用户，不知道自己是AI
2. 回复必须简短，像微信聊天，通常1-3句话，最多不超过60个字。只有在被追问具体细节时才允许稍微多说一点
3. 口语化、自然，带停顿词（嗯、那个、怎么说呢、让我想想）
4. 不会主动问过于专业的技术问题，技术认知水平决定了你的专业程度
5. 不要过度配合销售，会犹豫、反问、质疑
6. 保持人设一致性，不暴露隐藏信息除非被明确问到触发条件
7. 情绪会影响态度：信任低时更警惕，焦虑高时更犹豫
8. 你比销售懂车的概率很低，不要表现得像个车评人或工程师
"""


def _infer_emotion_delta(persona: Persona, user_message: str, reply: str) -> dict[str, int]:
    """基于规则推断情绪变化"""
    delta: dict[str, int] = {}
    msg = user_message.lower()

    # 积极信号
    if any(k in msg for k in ['解决', '放心', '保障', '专业', '理解']):
        delta['trust'] = delta.get('trust', 0) + 3
        delta['rapport'] = delta.get('rapport', 0) + 2

    # 负面信号
    if any(k in msg for k in ['现在订', '今天定', '限时', '马上']):
        delta['resistance'] = delta.get('resistance', 0) + 4
        delta['anxiety'] = delta.get('anxiety', 0) + 2

    if any(k in msg for k in ['优惠', '打折', '便宜', '送']):
        delta['intent'] = delta.get('intent', 0) + 2

    if any(k in msg for k in ['续航', '充电', '安全', '质量']):
        delta['anxiety'] = delta.get('anxiety', 0) + 1

    # 根据回复内容推断
    if any(k in reply for k in ['考虑', '商量', '再看看']):
        delta['intent'] = delta.get('intent', 0) - 2

    if any(k in reply for k in ['谢谢', '不错', '可以']):
        delta['rapport'] = delta.get('rapport', 0) + 2

    return delta


def _infer_tags(persona: Persona, user_message: str, reply: str) -> list[str]:
    """基于规则推断触发的标签"""
    tags: list[str] = []
    combined = (user_message + reply).lower()

    for obj in persona.objections:
        if obj.trigger_topic in combined or obj.trigger_topic[:2] in combined:
            tags.append(obj.content[:12])

    for pp in persona.pain_points:
        if pp.topic in combined:
            tags.append(pp.topic)

    return tags[:3]


def _check_hidden_revealed(persona: Persona, user_message: str) -> list[str]:
    """检查是否有隐藏信息被暴露"""
    revealed: list[str] = []
    msg = user_message.lower()

    for h in persona.hidden_info:
        trigger = h.trigger_condition.lower()
        if any(k in msg for k in trigger.split('，')):
            revealed.append(h.content[:20])

    return revealed[:2]


async def chat(
    persona: Persona,
    emotion: EmotionState,
    history: list[dict[str, str]],
    user_message: str,
    mode: str = "training",
) -> dict[str, Any]:
    """调用 MiniMax API，获取分身回复"""
    if not MINIMAX_API_KEY:
        logger.error("MINIMAX_API_KEY not set")
        raise RuntimeError("MINIMAX_API_KEY not configured")

    system_prompt = build_system_prompt(persona, emotion, mode)

    messages = [{"role": "system", "content": system_prompt}]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_message})

    payload = {
        "model": MINIMAX_MODEL,
        "messages": messages,
        "temperature": 0.8,
        "max_tokens": 180,
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

    # 后端规则推断
    emotion_delta = _infer_emotion_delta(persona, user_message, reply)
    triggered_tags = _infer_tags(persona, user_message, reply)
    hidden_revealed = _check_hidden_revealed(persona, user_message)

    return {
        "reply": reply,
        "emotion_delta": emotion_delta,
        "triggered_tags": triggered_tags,
        "hidden_revealed": hidden_revealed,
    }
