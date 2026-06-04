"""文档入库 — 解析 + 切分 + 向量化存储"""

import logging

from . import parser, store

logger = logging.getLogger("cap.knowledge")


def ingest_document(file_bytes: bytes, filename: str, collection_name: str = "training_docs") -> dict:
    """单文档入库流程

    Args:
        collection_name: 目标集合名，默认全局 training_docs；
                         典型用户专属文档使用 persona_{id}_docs

    Returns:
        {"filename": str, "chunks": int, "status": str}
    """
    logger.info(f"Ingesting document: {filename} into collection: {collection_name}")

    # 1. 解析文本
    raw_text = parser.parse_document(file_bytes, filename)
    if not raw_text or len(raw_text.strip()) < 50:
        return {"filename": filename, "chunks": 0, "status": "too_short_or_empty"}

    # 2. 切分
    chunks = parser.chunk_text(raw_text, chunk_size=300, overlap=50)
    if not chunks:
        return {"filename": filename, "chunks": 0, "status": "no_chunks"}

    # 3. 入库
    store.add_chunks(chunks, source=filename, collection_name=collection_name)

    return {"filename": filename, "chunks": len(chunks), "status": "success"}
