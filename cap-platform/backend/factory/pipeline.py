"""Persona Factory Pipeline — 从真实用户 Excel 自动生成典型分身

四步工程化流程：
1. 解析 Excel → 记录列表
2. LLM 逐条抽取结构化特征 (llm_extractor)
3. 特征编码 + K-Means 聚类，Silhouette Score 选最优 K (cluster_engine)
4. 每类汇总统计 + LLM 合成典型分身 JSON (synthesizer)

返回：可保存的典型分身列表（带 _source: "factory" 标记）
"""

import asyncio
import io
import json
import logging
import re
from collections import Counter

import pandas as pd

from . import llm_extractor
from . import cluster_engine
from . import synthesizer

logger = logging.getLogger("cap.factory")


# ── 1. Excel 解析 ──

def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """将各种可能的列名归一化为标准键"""
    col_map = {
        # 客户ID
        "id": ["id", "客户id", "客户ID", "用户ID", "用户id", "customer_id", "编号"],
        # 基础信息
        "性别": ["性别", "gender", "sex"],
        "年龄": ["年龄", "age", "岁数", "年龄阶段"],
        "婚姻": ["婚姻", "婚姻状况", "marriage", "婚否", " marital_status"],
        "学历": ["学历", "education", "受教育程度"],
        "职业": ["职业", "occupation", "工作", "职位", "岗位"],
        "所在行业": ["所在行业", "行业", "industry"],
        "家庭年收入": ["家庭年收入", "年收入", "income", "家庭收入", "收入"],
        "常住地城市": ["常住地城市", "城市", "city", "常住城市", "居住城市"],
        "常住地省份": ["常住地省份", "省份", "province"],
        # 车辆信息
        "试驾品牌": ["试驾品牌", "品牌", "brand", "意向品牌"],
        "试驾车系": ["试驾车系", "车系", "series", "意向车系"],
        "意向车系名称": ["意向车系名称", "意向车型", "目标车型"],
        "用车场景": ["用车场景", "场景", "usage_scenario", "使用场景"],
        "意向等级": ["意向等级", "意向度", "intention_level"],
        "客户阶段": ["客户阶段", "阶段", "customer_stage"],
        "增换购属性": ["增换购属性", "增换购", "purchase_type", "购车类型", "购车属性", "购车性质"],
        "旧车品牌": ["旧车品牌", "现有车辆", "current_car", "旧车", "现有车"],
        "旧车使用年限": ["旧车使用年限", "用车年限", "current_car_age"],
        "购车人": ["购车人", "buyer"],
        # 动机与关注
        "购车一级动机": ["购车一级动机", "一级动机", "primary_motivation"],
        "购车二级动机": ["购车二级动机", "二级动机", "secondary_motivation", "购车动机"],
        "产品关注因素": ["产品关注因素", "关注因素", "关注要点", "concerns", "关注"],
        "客户关注点标签": ["客户关注点标签", "关注点", "concern_tags", "关注点标签"],
        "购车需求标签": ["购车需求标签", "需求标签", "demand_tags"],
        # 对话与小结
        "ASR文本": ["asr文本", "asr", "通话文本", "对话文本", "对话记录", "dialogue", "conversation"],
        "试驾录音原文本": ["试驾录音原文本", "试驾文本", "试驾记录", "drive_text", "test_drive_text"],
        "试驾小结": ["试驾小结", "试驾总结", "drive_summary"],
        "通话小结": ["通话小结", "通话总结", "call_summary"],
        "最近暂败一级原因": ["最近暂败一级原因", "暂败原因", "failure_reason"],
        "最近暂败二级原因": ["最近暂败二级原因", "暂败二级原因"],
        "初次了解信息渠道": ["初次了解信息渠道", "信息渠道", "info_channel"],
        "购车前对比品牌": ["购车前对比品牌", "对比品牌", "compared_brands"],
        # 预算
        "对外预算": ["对外预算", "stated_budget", "预算"],
        "真实预算": ["真实预算", "real_budget", "心理预算"],
        "预算": ["预算", "budget"],
    }

    lower_cols = {str(c).strip().lower(): c for c in df.columns}
    normalized = {}
    for standard, aliases in col_map.items():
        for alias in aliases:
            if alias.lower() in lower_cols:
                normalized[standard] = lower_cols[alias.lower()]
                break

    rename_map = {v: k for k, v in normalized.items()}
    df = df.rename(columns=rename_map)
    return df


def _parse_value(val):
    """解析单元格值，处理 nan 等"""
    if pd.isna(val):
        return None
    if isinstance(val, (int, float)):
        return val
    if isinstance(val, pd.Timestamp):
        return val.strftime("%Y-%m-%d %H:%M:%S")
    s = str(val).strip()
    if s.lower() in ("nan", "none", "null", ""):
        return None
    return s


def _try_decrypt(file_bytes: bytes) -> bytes:
    """尝试用 msoffcrypto 解密加密的 Excel 文件"""
    import msoffcrypto

    known_passwords = ["", "minipoc0609", "demo0518&100"]
    for pwd in known_passwords:
        try:
            f = io.BytesIO(file_bytes)
            office_file = msoffcrypto.OfficeFile(f)
            out = io.BytesIO()
            office_file.load_key(password=pwd)
            office_file.decrypt(out)
            logger.info(f"Excel 解密成功 (password='{pwd}')")
            return out.getvalue()
        except Exception:
            continue
    # 都失败则原样返回
    return file_bytes


def parse_excel_records(file_bytes: bytes) -> list[dict]:
    """将 Excel 字节解析为标准化记录列表（支持加密文件自动解密）"""
    decrypted = _try_decrypt(file_bytes)

    try:
        xls = pd.ExcelFile(io.BytesIO(decrypted), engine="openpyxl")
    except Exception as e:
        raise ValueError(f"无法解析 Excel 文件: {e}")

    all_records = []
    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name)
        if df.empty or len(df) < 1:
            continue
        df = _normalize_columns(df)
        if "id" not in df.columns:
            first_col = df.columns[0]
            df = df.rename(columns={first_col: "id"})

        for _, row in df.iterrows():
            rec = {"_sheet": sheet_name}
            for col in df.columns:
                rec[col] = _parse_value(row.get(col))
            all_records.append(rec)

    if not all_records:
        raise ValueError("Excel 文件中没有找到有效记录")

    logger.info(f"Parsed {len(all_records)} records from Excel")
    return all_records


# ── 2. 主流水线 ──

async def run_pipeline(file_bytes: bytes) -> list[dict]:
    """运行完整流水线：Excel → LLM 特征抽取 → K-Means 聚类 → LLM 合成典型分身

    返回：list[dict] 生成的典型分身 JSON 列表（已带 _source: "factory" 标记）
    """
    # 1. 解析 Excel
    records = parse_excel_records(file_bytes)
    if len(records) < 5:
        raise ValueError(f"记录数太少（{len(records)} 条），至少需要 5 条才能生成典型分身")

    logger.info(f"=== Step 1: LLM 特征抽取（{len(records)} 条记录）===")
    features_list = await llm_extractor.extract_features_all(records, concurrency=5)
    logger.info(f"特征抽取完成: {len(features_list)} 条")

    # 2. 聚类
    logger.info("=== Step 2: 特征编码 + K-Means 聚类 ===")
    clusters = cluster_engine.assign_clusters_with_features(records, features_list)
    logger.info(f"聚类完成: {len(clusters)} 个簇")
    for cid, data in clusters.items():
        logger.info(f"  簇 {cid}: {len(data['records'])} 条记录")

    if not clusters:
        raise ValueError("聚类失败，无法生成典型分身")

    # 3. 逐簇合成典型分身
    logger.info("=== Step 3: LLM 合成典型分身 ===")

    async def _synth_one(cid: int, data: dict) -> dict:
        title = f"聚类 {cid + 1}"
        try:
            persona = await synthesizer.synthesize_cluster(
                cluster_id=cid,
                cluster_title=title,
                records=data["records"],
                features_list=data["features"],
            )
        except Exception as e:
            logger.error(f"簇 {cid} 合成失败: {e}")
            raise
        # 标记为工厂产物
        persona["_source"] = "factory"
        persona["_kind"] = "typical"
        persona["id"] = f"typical_factory_{cid}_{int(asyncio.get_event_loop().time()) % 10000}"
        return persona

    tasks = [_synth_one(cid, data) for cid, data in clusters.items()]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    personas = []
    for res in results:
        if isinstance(res, Exception):
            logger.error(f"生成典型分身失败: {res}")
            continue
        personas.append(res)

    if not personas:
        raise ValueError("所有典型分身生成均失败")

    logger.info(f"Pipeline complete. Generated {len(personas)} typical personas.")
    return personas
