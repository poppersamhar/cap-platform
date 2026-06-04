"""知识库模块 — RAG for sales training documents"""

from .store import search, list_sources, delete_source, add_chunks
from .ingest import ingest_document
from .retriever import retrieve_for_avatar, format_knowledge_prompt

__all__ = [
    "search",
    "list_sources",
    "delete_source",
    "add_chunks",
    "ingest_document",
    "retrieve_for_avatar",
    "format_knowledge_prompt",
]
