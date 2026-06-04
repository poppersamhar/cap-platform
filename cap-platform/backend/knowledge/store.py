"""向量存储 — ChromaDB 封装"""

import os
import hashlib
import logging
from typing import Any

import chromadb
from chromadb.config import Settings

logger = logging.getLogger("cap.knowledge")

# ChromaDB 持久化路径
CHROMA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "chroma")
os.makedirs(CHROMA_DIR, exist_ok=True)

# 单例客户端
_chroma_client: chromadb.Client | None = None


def _get_client() -> chromadb.Client:
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=CHROMA_DIR,
            settings=Settings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_collection(name: str = "training_docs") -> chromadb.Collection:
    """获取或创建集合"""
    client = _get_client()
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(
    chunks: list[str],
    source: str,
    collection_name: str = "training_docs",
) -> None:
    """将文本块入库

    Args:
        chunks: 文本片段列表
        source: 来源文档名（用于追溯）
        collection_name: 集合名
    """
    if not chunks:
        return

    coll = get_collection(collection_name)
    ids = []
    metadatas = []

    for i, text in enumerate(chunks):
        # 用内容哈希做 ID，去重
        doc_id = hashlib.md5(f"{source}:{i}:{text}".encode()).hexdigest()
        ids.append(doc_id)
        metadatas.append({"source": source, "chunk_index": i})

    # 过滤已存在的 ID
    existing = coll.get(ids=ids)["ids"]  # type: ignore
    existing_set = set(existing)
    new_ids = [id_ for id_ in ids if id_ not in existing_set]
    new_docs = [chunks[i] for i, id_ in enumerate(ids) if id_ not in existing_set]
    new_metas = [metadatas[i] for i, id_ in enumerate(ids) if id_ not in existing_set]

    if not new_docs:
        logger.info(f"All chunks from '{source}' already exist, skipping")
        return

    coll.add(
        ids=new_ids,
        documents=new_docs,
        metadatas=new_metas,
    )
    logger.info(f"Added {len(new_docs)} new chunks from '{source}'")


def search(
    query: str,
    top_k: int = 3,
    collection_name: str = "training_docs",
) -> list[dict[str, Any]]:
    """向量检索

    使用 ChromaDB 内置的 embedding（默认 all-MiniLM-L6-v2），
    但为了中文效果，我们在 retriever.py 层做自定义 embedding。
    这里只负责存储和 ID 管理。
    """
    coll = get_collection(collection_name)

    # 检查集合是否为空
    count = coll.count()
    if count == 0:
        return []

    # 用 ChromaDB 自带 embedding 做初步检索（后续可替换为 BGE）
    results = coll.query(
        query_texts=[query],
        n_results=min(top_k, count),
        include=["documents", "metadatas", "distances"],
    )

    items = []
    for i in range(len(results["ids"][0])):  # type: ignore
        items.append({
            "id": results["ids"][0][i],  # type: ignore
            "text": results["documents"][0][i],  # type: ignore
            "source": results["metadatas"][0][i].get("source", ""),  # type: ignore
            "distance": results["distances"][0][i] if results.get("distances") else None,  # type: ignore
        })
    return items


def list_sources(collection_name: str = "training_docs") -> list[str]:
    """列出已入库的所有文档来源"""
    coll = get_collection(collection_name)
    count = coll.count()
    if count == 0:
        return []

    results = coll.get(include=["metadatas"])
    sources = set()
    for meta in results["metadatas"]:  # type: ignore
        if meta:
            sources.add(meta.get("source", "unknown"))
    return sorted(sources)


def delete_source(source: str, collection_name: str = "training_docs") -> int:
    """删除某个来源的所有文档"""
    coll = get_collection(collection_name)
    # ChromaDB 不支持按 metadata 过滤删除，先查出 ID 再删
    results = coll.get(where={"source": source}, include=[])
    ids = results["ids"]  # type: ignore
    if ids:
        coll.delete(ids=ids)
        logger.info(f"Deleted {len(ids)} chunks from source '{source}'")
    return len(ids)
