"""Persona Factory — 从真实用户数据自动生成典型客户分身

四步流程：
1. llm_extractor:   LLM 逐条抽取结构化特征
2. cluster_engine:  特征编码 + K-Means 聚类（Silhouette Score 选最优 K）
3. synthesizer:     LLM 基于聚类统计合成典型分身 JSON
4. pipeline:        串联以上三步，提供统一入口
"""

from .pipeline import run_pipeline, parse_excel_records

__all__ = ["run_pipeline", "parse_excel_records"]
