"""问卷调研 Agent

让 AI 分身基于自身画像和原始对话数据，独立回答结构化问卷。
"""

import json
import logging
import os
import time

import httpx

from personas.schema import Persona

logger = logging.getLogger("cap.survey")

api_key = os.getenv("MINIMAX_API_KEY", "")
api_url = os.getenv("MINIMAX_API_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2")
model = os.getenv("MINIMAX_MODEL", "MiniMax-Text-01")


def _build_persona_context(persona: Persona) -> str:
    """构建分身画像上下文"""
    profile = persona.profile
    purchase = persona.purchase
    comm = persona.communication

    lines = [
        f"【基本信息】{profile.name}，{profile.age}岁，{profile.gender == 'M' and '男' or '女'}，{profile.city}，{profile.occupation}，{profile.family}",
        f"【当前用车】{profile.current_car}",
        f"【购车预算】{purchase.budget_stated}（真实心理价位：{purchase.budget_real}）",
        f"【意向车型】{purchase.car_type}",
        f"【购车阶段】{purchase.stage}",
        f"【时间预期】{purchase.timeline}",
        f"【用车场景】{', '.join(purchase.usage_scenarios)}",
        f"【沟通风格】{comm.style} — {comm.description}",
    ]

    if persona.pain_points:
        lines.append("【核心痛点】")
        for pp in persona.pain_points:
            lines.append(f"  - {pp.topic}（强度{pp.intensity}/10）：{pp.detail}")

    if persona.hidden_info:
        lines.append("【隐藏信息】")
        for hi in persona.hidden_info:
            lines.append(f"  - {hi.content}")

    if persona.objections:
        lines.append("【常见异议】")
        for obj in persona.objections:
            lines.append(f"  - {obj.content}")

    if persona.competitor_awareness:
        lines.append(f"【竞品认知】{persona.competitor_awareness}")

    if persona.tags:
        lines.append(f"【标签】{', '.join(persona.tags)}")

    return "\n".join(lines)


def _build_source_quotes_prompt(source_quotes: list[dict]) -> str:
    """构建原始对话风格参考 prompt（复用 avatar_agent 逻辑）"""
    if not source_quotes:
        return ""

    patterns_text = "\n".join(f"  - {q['text']}" for q in source_quotes[:8])
    return f"""
【口头禅参考】以下是你偶尔会说的表达，熟悉一下即可，不需要刻意使用：
{patterns_text}

【口头禅纪律】正常说话，不要刻意使用口头禅。如果某个口头禅在当前语境下说出来很自然，可以带一句；如果说不顺口，完全不用。训练目标是让销售学会应对真实客户，你不需要表演。
"""


async def answer_question(
    persona: Persona,
    question: str,
    category: str,
    question_index: int,
    total_questions: int,
    source_quotes: list[dict] | None = None,
    previous_qa: list[dict] | None = None,
) -> dict:
    """让单个 persona 回答单个问卷问题

    Args:
        persona: 分身画像
        question: 问题文本
        category: 问题分类
        question_index: 当前问题序号（从0开始）
        total_questions: 总问题数
        source_quotes: 原始对话风格引用
        previous_qa: 之前问题的回答（保持上下文一致性）

    Returns:
        persona 的回答文本
    """
    if not api_key:
        logger.warning("MINIMAX_API_KEY not set, returning mock answer")
        return {
            "answer": f"[模拟回答] 作为{persona.profile.name}，我认为这个问题很重要。",
            "usage": {},
        }

    persona_ctx = _build_persona_context(persona)
    style_prompt = _build_source_quotes_prompt(source_quotes or [])

    # 构建历史 QA 上下文（保持回答一致性）
    history_ctx = ""
    if previous_qa:
        history_ctx = "\n\n【已回答的问题】\n"
        for qa in previous_qa:
            history_ctx += f"Q: {qa['question']}\nA: {qa['answer'][:200]}...\n\n"

    system_prompt = f"""你是一位真实的购车用户，正在填写一份汽车调研问卷。请完全代入以下人物画像来回答问题。

{persona_ctx}

{style_prompt}

【回答纪律】
1. 必须严格基于自身画像回答，不要编造与画像矛盾的内容
2. 回答要自然、口语化，像真实用户在填写问卷，不要太正式或太书面
3. 不要过多的语气词、重复词和方言，正常讲话即可，能表达出意思就行
4. 回答要简练、直击要点，每个问题 50-150 字即可，不要展开太多
5. 如果画像中没有相关信息，可以基于画像合理推断，但要说明是推测
6. 保持与之前回答的一致性
7. 禁止复述或改写历史对话中的具体内容来回答当前问题

当前是第 {question_index + 1} / {total_questions} 题。
"""

    user_prompt = f"【问卷问题】{question}\n\n请以上述人物的身份回答这个问题："

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                api_url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt + history_ctx},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1024,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()

            # 记录 token 使用
            usage = data.get("usage", {})
            return {
                "answer": content,
                "usage": usage,
            }
    except Exception as e:
        logger.exception(f"Survey answer failed for {persona.profile.name} q{question_index}")
        return {
            "answer": f"[回答生成失败] {str(e)[:100]}",
            "usage": {},
        }


async def run_survey_for_persona(
    persona: Persona,
    questions: list[dict],
    source_quotes: list[dict] | None = None,
    on_progress: callable | None = None,
) -> dict:
    """为一个 persona 执行完整问卷

    Args:
        on_progress: 可选回调，每完成一题调用一次 on_progress(completed_count)

    Returns:
        {
            "persona_id": str,
            "persona_name": str,
            "answers": [{"question_id", "question", "answer", "category"}, ...],
            "generated_at": timestamp,
            "token_usage": {...},
        }
    """
    answers = []
    total_prompt_tokens = 0
    total_completion_tokens = 0
    total_tokens = 0

    for idx, q in enumerate(questions):
        previous_qa = [{"question": a["question"], "answer": a["answer"]} for a in answers]
        result = await answer_question(
            persona=persona,
            question=q["question"],
            category=q["category"],
            question_index=idx,
            total_questions=len(questions),
            source_quotes=source_quotes,
            previous_qa=previous_qa,
        )

        answers.append({
            "question_id": q["id"],
            "question": q["question"],
            "answer": result["answer"],
            "category": q["category"],
        })

        usage = result.get("usage", {})
        total_prompt_tokens += usage.get("prompt_tokens", 0)
        total_completion_tokens += usage.get("completion_tokens", 0)
        total_tokens += usage.get("total_tokens", 0)

        if on_progress:
            try:
                on_progress(idx + 1)
            except Exception:
                pass

    return {
        "persona_id": persona.id,
        "persona_name": persona.profile.name,
        "answers": answers,
        "generated_at": time.time(),
        "token_usage": {
            "prompt_tokens": total_prompt_tokens,
            "completion_tokens": total_completion_tokens,
            "total_tokens": total_tokens,
        },
    }
