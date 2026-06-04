"""检索逻辑 — 把对话上下文转成检索 query，获取相关知识片段"""

import logging
from typing import Any

from . import store

logger = logging.getLogger("cap.knowledge")


def _build_query_from_context(history: list[dict[str, str]], user_message: str) -> str:
    """从对话历史构建检索 query

    策略：取最近 2 轮对话 + 当前用户消息，提取关键主题词
    """
    # 取最近 2 轮（4 条消息）
    recent = history[-4:] if len(history) >= 4 else history

    parts = []
    for h in recent:
        role_label = "销售" if h["role"] == "user" else "客户"
        parts.append(f"{role_label}：{h['content']}")

    parts.append(f"销售（当前）：{user_message}")
    return "\n".join(parts)


def retrieve_for_avatar(
    history: list[dict[str, str]],
    user_message: str,
    top_k: int = 3,
    persona_id: str | None = None,
) -> list[dict[str, Any]]:
    """为 Avatar Agent 检索相关知识

    同时检索全局知识库 + 该 persona 的专属知识库（如果是典型用户），
    合并去重后返回。

    Returns:
        知识片段列表，每项包含 text, source
    """
    query = _build_query_from_context(history, user_message)

    # 简化 query：如果太长，只取用户消息
    if len(query) > 500:
        query = user_message[-200:]

    # 1. 检索全局知识库
    all_results: list[dict[str, Any]] = store.search(query, top_k=top_k)

    # 2. 检索典型用户专属知识库
    if persona_id and persona_id.startswith("typical_"):
        collection_name = f"persona_{persona_id}_docs"
        try:
            personal_results = store.search(query, top_k=top_k, collection_name=collection_name)
            # 合并并去重（按 text 内容）
            seen_texts = {r["text"] for r in all_results}
            for r in personal_results:
                if r["text"] not in seen_texts:
                    all_results.append(r)
                    seen_texts.add(r["text"])
            logger.info(
                f"Retrieved {len(personal_results)} personal + {len(all_results) - len(personal_results)} "
                f"global chunks for persona {persona_id}"
            )
        except Exception as e:
            logger.warning(f"Personal knowledge retrieval failed for {persona_id}: {e}")

    logger.debug(f"Retrieved {len(all_results)} knowledge chunks for query: {query[:60]}...")
    return all_results


def format_knowledge_prompt(results: list[dict[str, Any]]) -> str:
    """将检索结果格式化为 Prompt 片段"""
    if not results:
        return ""

    lines = ["═══ 培训知识参考（你会自然地引用这些内容来测试销售）═══"]
    for i, r in enumerate(results, 1):
        text = r["text"].replace("\n", " ")
        # 截断过长内容
        if len(text) > 300:
            text = text[:300] + "..."
        lines.append(f"[{i}] {text}")

    lines.append(
        "\n【使用纪律】"
        "\n- 你可以根据以上资料中提到的典型客户问题，自然地选择 1-2 个在对话中提出"
        "\n- 不要一次性问太多，每轮最多 1-2 个"
        "\n- 不要机械复述原文，要融入你的角色风格（口头禅、情绪状态）"
        "\n- 如果资料里提到某个产品卖点，你可以反过来问销售'这个和其他品牌比怎么样'"
    )
    return "\n".join(lines)
