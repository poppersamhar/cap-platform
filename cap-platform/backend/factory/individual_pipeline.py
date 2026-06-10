"""Individual Persona Factory Pipeline — 工程化个体分身生成

从原始用户数据到高质量个体分身的完整流水线：
1. 解析 Excel → 标准化记录列表（复用典型客群解析层）
2. 数据丰富度评分 → 筛掉低质量客户
3. LLM 特征预抽取 → 10维结构化特征
4. MMR 多样性选择 → 选出既丰富又互异的 Top N
5. 两步法 LLM 深度提取 → 先总结 → 再输出 JSON
6. Schema 校验 + 自动修复
7. 保存原始对话溯源文件
8. 输出带完整元数据的个体分身

返回：Persona JSON 列表 + 原始对话文件
"""

import asyncio
import io
import json
import logging
import os
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import httpx
import numpy as np
import pandas as pd
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

from factory.pipeline import parse_excel_records, _try_decrypt

logger = logging.getLogger("cap.factory.individual")

# 加载环境变量
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

API_KEY = os.getenv("MINIMAX_API_KEY", "").strip()
API_URL = os.getenv("MINIMAX_API_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2").strip()
MODEL = os.getenv("MINIMAX_MODEL", "MiniMax-Text-01").strip()

# ── 数据丰富度评分 ──


def score_data_quality(records: list[dict]) -> float:
    """计算单个客户的数据丰富度评分 0-1

    维度：
    - 对话字数 (30%): ASR + 试驾录音总字数
    - 有试驾录音 (30%): 是否有试驾文本
    - 有关注点标签 (20%): 是否有结构化标签
    - 记录条数 (20%): 该客户有几条记录
    """
    if not records:
        return 0.0

    # 对话字数
    total_chars = 0
    for rec in records:
        for key in ["ASR文本", "试驾录音原文本", "外呼通话录音文本", "试驾录音原文本"]:
            val = rec.get(key)
            if val and str(val).lower() not in ("nan", "none", "null", ""):
                total_chars += len(str(val))

    # 有试驾录音
    has_drive = any(
        rec.get("试驾录音原文本") and str(rec.get("试驾录音原文本")).strip()
        for rec in records
    )

    # 有关注点标签
    has_concerns = any(
        rec.get("客户关注点标签") and str(rec.get("客户关注点标签")).strip()
        for rec in records
    )

    score = 0.0
    # 对话字数分 (0-0.3)
    score += min(total_chars / 5000, 1.0) * 0.3
    # 试驾录音分 (0-0.3)
    score += (1.0 if has_drive else 0.0) * 0.3
    # 关注点标签分 (0-0.2)
    score += (1.0 if has_concerns else 0.0) * 0.2
    # 记录条数分 (0-0.2)
    score += min(len(records) / 5, 1.0) * 0.2

    return round(score, 2)


# ── 对话解析工具（复用 100条数据脚本逻辑）──


def parse_dialog_json(raw) -> list[dict]:
    """ASR/试驾文本字段是 JSON 字符串，解析成对话列表"""
    if not raw:
        return []
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
        items = []
        for d in data:
            if "additions" in d:
                role = d.get("additions", {}).get("role", "?")
                text = d.get("text", "")
            else:
                role = d.get("role", "?")
                text = d.get("text", "")
            if text and text.strip():
                items.append({"role": role, "text": text.strip()})
        return items
    except (json.JSONDecodeError, TypeError, AttributeError):
        return []


def build_dialog_text(dialog: list[dict], max_chars: int = 12000) -> str:
    """拼接对话文本，优先保留客户发言"""
    lines = []
    total = 0
    for d in dialog:
        if d["role"] == "客户":
            line = f"[客户] {d['text']}"
            if total + len(line) > max_chars:
                break
            lines.append(line)
            total += len(line)
    # 填充顾问发言
    customer_lines = set(lines)
    interleaved = []
    for d in dialog:
        line = f"[{d['role']}] {d['text']}"
        if d["role"] == "客户":
            if line in customer_lines:
                interleaved.append(line)
        else:
            if total + len(line) <= max_chars:
                interleaved.append(line)
                total += len(line)
    return "\n".join(interleaved) if interleaved else "\n".join(lines)


def collect_customer_quotes(records: list[dict]) -> list[str]:
    """从对话中提取客户的代表性短句"""
    quotes = []
    for rec in records:
        for key in ["ASR文本", "试驾录音原文本", "外呼通话录音文本", "试驾录音原文本"]:
            val = rec.get(key)
            if not val:
                continue
            dialog = parse_dialog_json(val)
            for d in dialog:
                if d["role"] == "客户":
                    text = d["text"].strip()
                    # 按停顿符切分
                    for sentence in re.split(r'[。！？；,，]', text):
                        sentence = sentence.strip()
                        if 5 <= len(sentence) <= 60:
                            quotes.append(sentence)
    # 去重
    seen = set()
    unique = []
    for q in quotes:
        if q not in seen:
            seen.add(q)
            unique.append(q)
    return unique[:50]


# ── LLM 特征预抽取 ──

_FEATURE_EXTRACT_SYSTEM = """你是一位资深汽车行业用户研究专家。请从以下客户数据中提取10维结构化特征标签。

输出严格 JSON（不要 markdown、不要解释）：
{
  "core_concerns": ["关注点1", "关注点2", "关注点3"],
  "decision_style": "理性对比型|感性冲动型|犹豫纠结型|务实直接型",
  "purchase_motivation": "家庭需求驱动|个人升级驱动|商用驱动|通勤刚需驱动|社交面子驱动",
  "powertrain_preference": "纯电|插混|燃油|不限",
  "brand_affinity": "国产品牌偏好|合资品牌偏好|不限",
  "price_sensitivity": "高|中|低",
  "objection_type": "续航焦虑|价格抵触|品牌信任|配置不满|服务担忧|无明确异议",
  "age_group": "25岁以下|25-30岁|30-35岁|35-40岁|40-45岁|45岁以上",
  "family_structure": "单身|已婚无孩|已婚有孩|三代同住",
  "budget_range": "10万以下|10-15万|15-20万|20-25万|25-30万|30万以上"
}

规则：
1. core_concerns: 从对话中提取 TOP3 关注点
2. 无法判断的维度用"未知"
3. 所有字段必须存在"""


def _build_feature_prompt(records: list[dict]) -> str:
    """为单客户构建特征抽取 prompt"""
    parts = ["═══ 客户数据 ═══"]
    r = records[0]
    for key in ["年龄阶段", "性别", "婚姻状况", "常住地城市", "购车性质", "预算范围", "关注点", "顾虑点"]:
        val = r.get(key)
        if val and str(val).lower() not in ("nan", "none", "null", ""):
            parts.append(f"{key}: {val}")

    # 合并对话文本
    all_texts = []
    for rec in records:
        for key in ["外呼通话录音文本", "试驾录音原文本", "ASR文本", "试驾录音原文本"]:
            val = rec.get(key)
            if val and str(val).lower() not in ("nan", "none", "null", ""):
                text = str(val)
                if len(text) > 2000:
                    text = text[:2000] + "..."
                all_texts.append(text)

    if all_texts:
        parts.append(f"\n【对话文本】\n{'\n---\n'.join(all_texts[:3])}")

    return "\n".join(parts)


def _clean_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start:end + 1]
    return json.loads(text)


async def _extract_features_single(records: list[dict], attempt: int = 1) -> dict[str, Any]:
    """对单客户调用 LLM 抽取特征"""
    user_prompt = _build_feature_prompt(records)

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": _FEATURE_EXTRACT_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 1024,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            API_URL,
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    raw = data["choices"][0]["message"]["content"]
    try:
        features = _clean_json(raw)
    except json.JSONDecodeError:
        if attempt < 2:
            await asyncio.sleep(1)
            return await _extract_features_single(records, attempt + 1)
        raise

    defaults = {
        "core_concerns": ["未知"],
        "decision_style": "未知",
        "purchase_motivation": "未知",
        "powertrain_preference": "未知",
        "brand_affinity": "未知",
        "price_sensitivity": "中",
        "objection_type": "无明确异议",
        "age_group": "未知",
        "family_structure": "未知",
        "budget_range": "未知",
    }
    for k, v in defaults.items():
        features.setdefault(k, v)
    return features


async def extract_features_all(customer_records: dict[str, list[dict]], concurrency: int = 5) -> dict[str, dict]:
    """对所有客户并行抽取特征"""
    semaphore = asyncio.Semaphore(concurrency)
    customer_ids = list(customer_records.keys())

    async def _task(cid: str) -> tuple[str, dict]:
        async with semaphore:
            try:
                feats = await _extract_features_single(customer_records[cid])
                logger.info(f"[特征抽取] {cid[:12]}... 完成")
                return cid, feats
            except Exception as e:
                logger.error(f"[特征抽取] {cid[:12]}... 失败: {e}")
                return cid, {
                    "core_concerns": ["未知"], "decision_style": "未知",
                    "purchase_motivation": "未知", "powertrain_preference": "未知",
                    "brand_affinity": "未知", "price_sensitivity": "中",
                    "objection_type": "无明确异议", "age_group": "未知",
                    "family_structure": "未知", "budget_range": "未知",
                }

    tasks = [_task(cid) for cid in customer_ids]
    results = await asyncio.gather(*tasks)
    return {cid: feats for cid, feats in results}


# ── MMR 多样性选择 ──


def _feature_to_vector(features: dict) -> np.ndarray:
    """将特征转为简单向量用于相似度计算"""
    # 使用关键词集合的 Jaccard 距离近似
    keywords = set()
    keywords.update(features.get("core_concerns", []))
    keywords.add(features.get("decision_style", ""))
    keywords.add(features.get("purchase_motivation", ""))
    keywords.add(features.get("powertrain_preference", ""))
    keywords.add(features.get("brand_affinity", ""))
    keywords.add(features.get("price_sensitivity", ""))
    keywords.add(features.get("objection_type", ""))
    keywords.add(features.get("age_group", ""))
    keywords.add(features.get("family_structure", ""))
    keywords.add(features.get("budget_range", ""))
    return keywords


def _jaccard_sim(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union > 0 else 0.0


def mmr_diversity_select(
    candidates: list[tuple[str, float, dict]],
    top_k: int = 6,
    lambda_param: float = 0.5,
) -> list[tuple[str, float, dict, str]]:
    """MMR 多样性选择

    candidates: [(customer_id, quality_score, features), ...]
    返回: [(customer_id, quality_score, features, reason), ...]
    """
    if len(candidates) <= top_k:
        return [(cid, score, feats, "数据丰富") for cid, score, feats in candidates]

    # 按质量分排序
    candidates = sorted(candidates, key=lambda x: x[1], reverse=True)

    selected = []
    selected_ids = set()

    # 第一个选质量最高的
    first = candidates[0]
    selected.append((first[0], first[1], first[2], "数据最丰富"))
    selected_ids.add(first[0])

    # MMR 迭代选择
    while len(selected) < top_k:
        best_mmr_score = -1.0
        best_candidate = None

        for cid, quality, feats in candidates:
            if cid in selected_ids:
                continue

            # 与已选的最大相似度
            feat_set = _feature_to_vector(feats)
            max_sim = 0.0
            for _, _, s_feats, _ in selected:
                sim = _jaccard_sim(feat_set, _feature_to_vector(s_feats))
                max_sim = max(max_sim, sim)

            # MMR 得分
            mmr_score = lambda_param * quality - (1 - lambda_param) * max_sim

            if mmr_score > best_mmr_score:
                best_mmr_score = mmr_score
                best_candidate = (cid, quality, feats)

        if not best_candidate:
            break

        # 生成推荐理由
        cid, quality, feats = best_candidate
        feat_set = _feature_to_vector(feats)
        max_sim = 0.0
        most_similar = None
        for _, _, s_feats, _ in selected:
            sim = _jaccard_sim(feat_set, _feature_to_vector(s_feats))
            if sim > max_sim:
                max_sim = sim
                most_similar = s_feats

        if max_sim < 0.3:
            reason = "特征差异大，补充多样性"
        elif quality > 0.7:
            reason = "数据质量高"
        else:
            reason = "覆盖新特征维度"

        selected.append((cid, quality, feats, reason))
        selected_ids.add(cid)

    return selected


# ── 两步法 LLM 深度提取 ──

_INDIVIDUAL_SYSTEM_V1 = """你是一位资深用户画像分析师。请先用200字总结这位客户的核心特征，然后基于总结输出完整分身 JSON。

输出格式：先写总结段落，然后输出 JSON（不要 markdown 代码块）：

总结：...

JSON：
{
  "profile": {
    "name": "中文姓名",
    "age": 数字,
    "gender": "M" 或 "F",
    "city": "城市",
    "occupation": "职业（10-25字）",
    "family": "家庭情况（20-40字）",
    "current_car": "现有车辆（如有）"
  },
  "purchase": {
    "budget_stated": "对外预算",
    "budget_real": "心理真实预算",
    "car_type": "意向车型",
    "stage": "购车阶段",
    "timeline": "购车时间线",
    "usage_scenarios": ["3-5个场景"]
  },
  "pain_points": [
    {"topic": "4-8字", "intensity": 0.5-0.95, "detail": "基于对话的真实痛点"}
  ],
  "hidden_info": [
    {"content": "没说出口的想法", "trigger_condition": "触发场景"}
  ],
  "objections": [
    {"content": "8字以内", "trigger_topic": "触发话题", "resistance": 0.4-0.85}
  ],
  "competitor_awareness": "30-80字",
  "behavior": {
    "anti_guide": 0-1, "price_sensitivity": 0-1, "expressiveness": 0-1,
    "decisiveness": 0-1, "tech_literacy": 0-1
  },
  "communication": {
    "style": "沟通风格",
    "description": "30-60字",
    "speech_patterns": ["3-5条真实口头禅（2-6字）"]
  },
  "tags": ["4-5个标签"]
}

纪律：
1. 所有字段必须输出
2. speech_patterns 必须从真实对话中提取
3. 痛点、异议、隐藏信息必须基于真实对话
4. 不要编造数据"""


def _build_individual_prompt(records: list[dict], features: dict, idx: int) -> str:
    """构建个体分身生成 prompt"""
    r = records[0]

    parts = []
    parts.append(f"═══ 客户基础信息 ═══")
    for key in ["年龄阶段", "性别", "婚姻状况", "常住地城市", "购车性质", "意向等级", "购车计划", "预算范围", "用车场景", "关注点", "顾虑点"]:
        val = r.get(key)
        if val and str(val).lower() not in ("nan", "none", "null", ""):
            parts.append(f"{key}: {val}")

    parts.append(f"\n═══ LLM 预抽取特征 ═══")
    for k, v in features.items():
        parts.append(f"{k}: {v}")

    # 对话文本
    all_asr = []
    all_drive = []
    for rec in records:
        for key in ["ASR文本", "外呼通话录音文本"]:
            val = rec.get(key)
            if val and str(val).lower() not in ("nan", "none", "null", ""):
                dialog = parse_dialog_json(val)
                if dialog:
                    all_asr.extend(dialog)
                else:
                    all_asr.append({"role": "客户", "text": str(val)[:2000]})

        for key in ["试驾录音原文本"]:
            val = rec.get(key)
            if val and str(val).lower() not in ("nan", "none", "null", ""):
                dialog = parse_dialog_json(val)
                if dialog:
                    all_drive.extend(dialog)
                else:
                    all_drive.append({"role": "客户", "text": str(val)[:2000]})

    if all_asr:
        asr_text = build_dialog_text(all_asr, 8000)
        parts.append(f"\n【外呼通话对话】\n{asr_text}")

    if all_drive:
        drive_text = build_dialog_text(all_drive, 8000)
        parts.append(f"\n【试驾对话】\n{drive_text}")

    # 小结
    summaries = []
    for rec in records:
        for key in ["通话小结", "试驾小结", "外呼通话录音小结", "试驾小结"]:
            val = rec.get(key)
            if val and str(val).strip():
                summaries.append(str(val)[:400])
    if summaries:
        parts.append(f"\n【对话小结】\n" + "\n---\n".join(summaries[:4]))

    return "\n".join(parts)


def _extract_json_from_two_step(text: str) -> dict:
    """从两步法输出中提取 JSON"""
    text = text.strip()
    # 尝试找 "JSON：" 或 "JSON:" 后的内容
    for marker in ["JSON：", "JSON:", "json：", "json:"]:
        idx = text.find(marker)
        if idx >= 0:
            text = text[idx + len(marker):]
            break

    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3].strip()

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start:end + 1]

    return json.loads(text)


async def synthesize_individual(
    customer_id: str,
    records: list[dict],
    features: dict,
    idx: int,
    attempt: int = 1,
) -> dict[str, Any]:
    """为单个客户生成分身"""
    user_prompt = _build_individual_prompt(records, features, idx)

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": _INDIVIDUAL_SYSTEM_V1},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.5,
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(
            API_URL,
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    raw = data["choices"][0]["message"]["content"]
    try:
        persona = _extract_json_from_two_step(raw)
    except (json.JSONDecodeError, ValueError):
        if attempt < 2:
            await asyncio.sleep(2)
            return await synthesize_individual(customer_id, records, features, idx, attempt + 1)
        raise

    return persona


# ── Schema 校验 + 自动修复 ──


def validate_and_fix_persona(persona: dict, customer_id: str) -> dict:
    """校验并自动修复生成的 Persona JSON"""
    fixes = []

    # 确保基本结构存在
    for key in ["profile", "purchase", "pain_points", "hidden_info", "objections", "behavior", "communication", "tags"]:
        if key not in persona:
            persona[key] = {}
            fixes.append(f"缺失 {key}，已添加空对象")

    profile = persona.setdefault("profile", {})
    for k, default in [("name", "未知"), ("age", 35), ("gender", "M"), ("city", "未知"), ("occupation", "未知"), ("family", "未知"), ("current_car", "无")]:
        if k not in profile or profile[k] is None:
            profile[k] = default
            fixes.append(f"profile.{k} 缺失，已设为 {default}")

    purchase = persona.setdefault("purchase", {})
    for k, default in [("budget_stated", "未知"), ("budget_real", "未知"), ("car_type", "未知"), ("stage", "未知"), ("timeline", "未知")]:
        if k not in purchase or purchase[k] is None:
            purchase[k] = default
    if "usage_scenarios" not in purchase or not isinstance(purchase["usage_scenarios"], list):
        purchase["usage_scenarios"] = ["日常通勤"]

    # 校验 pain_points
    if not isinstance(persona.get("pain_points"), list) or len(persona.get("pain_points", [])) < 2:
        fixes.append("pain_points 不足，已补充默认值")
        persona["pain_points"] = [
            {"topic": "价格敏感", "intensity": 0.6, "detail": "客户对价格较为关注"},
            {"topic": "配置顾虑", "intensity": 0.5, "detail": "客户对某些配置存在顾虑"},
        ]
    for pp in persona["pain_points"]:
        pp["intensity"] = max(0.0, min(1.0, pp.get("intensity", 0.5)))

    # 校验 objections
    if not isinstance(persona.get("objections"), list) or len(persona.get("objections", [])) < 2:
        persona["objections"] = [
            {"content": "价格偏高", "trigger_topic": "报价", "resistance": 0.5},
        ]
    for obj in persona["objections"]:
        obj["resistance"] = max(0.0, min(1.0, obj.get("resistance", 0.5)))

    # 校验 behavior
    behavior = persona.setdefault("behavior", {})
    for k in ["anti_guide", "price_sensitivity", "expressiveness", "decisiveness", "tech_literacy"]:
        val = behavior.get(k)
        if val is None or not isinstance(val, (int, float)):
            behavior[k] = 0.5
        else:
            behavior[k] = max(0.0, min(1.0, val))

    # 校验 communication
    comm = persona.setdefault("communication", {})
    for k, default in [("style", "普通型"), ("description", "沟通风格较为普通")]:
        if k not in comm or not comm[k]:
            comm[k] = default
    if "speech_patterns" not in comm or not isinstance(comm["speech_patterns"], list):
        comm["speech_patterns"] = ["嗯", "那个", "还行吧"]
    else:
        # 过滤过长口头禅
        comm["speech_patterns"] = [sp for sp in comm["speech_patterns"] if len(sp) <= 15][:8]

    # 确保 tags
    if "tags" not in persona or not isinstance(persona["tags"], list) or len(persona["tags"]) < 2:
        persona["tags"] = ["购车用户"]

    if fixes:
        logger.info(f"[校验修复] {customer_id[:12]}... 修复 {len(fixes)} 项: {fixes[:3]}")

    return persona


# ── 保存原始对话溯源文件 ──


def save_source_dialogues(
    persona_id: str,
    customer_id: str,
    records: list[dict],
    output_dir: Path,
) -> Path:
    """保存原始对话溯源文件"""
    dialogues = []
    summaries = []

    # ASR 对话
    all_asr = []
    for rec in records:
        for key in ["ASR文本", "外呼通话录音文本"]:
            val = rec.get(key)
            if val and str(val).lower() not in ("nan", "none", "null", ""):
                dialog = parse_dialog_json(val)
                if dialog:
                    all_asr.extend(dialog)

    if all_asr:
        dialogues.append({
            "type": "outbound_call",
            "title": "外呼通话录音",
            "source_field": "ASR文本",
            "transcript": build_dialog_text(all_asr, 20000),
            "turn_count": len(all_asr),
        })

    # 试驾对话
    all_drive = []
    for rec in records:
        for key in ["试驾录音原文本"]:
            val = rec.get(key)
            if val and str(val).lower() not in ("nan", "none", "null", ""):
                dialog = parse_dialog_json(val)
                if dialog:
                    all_drive.extend(dialog)

    if all_drive:
        dialogues.append({
            "type": "test_drive",
            "title": "试驾录音",
            "source_field": "试驾录音原文本",
            "transcript": build_dialog_text(all_drive, 20000),
            "turn_count": len(all_drive),
        })

    # 小结
    for rec in records:
        for key in ["通话小结", "试驾小结", "外呼通话录音小结"]:
            val = rec.get(key)
            if val and str(val).strip():
                summaries.append({
                    "type": "call_summary" if "通话" in key else "drive_summary",
                    "title": key,
                    "content": str(val).strip()[:500],
                })

    data = {
        "persona_id": persona_id,
        "source_customer_id": customer_id,
        "dialogues": dialogues,
        "summaries": summaries,
        "record_count": len(records),
    }

    output_path = output_dir / f"{persona_id}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return output_path


# ── 主流水线 ──


async def run_individual_pipeline(
    file_bytes: bytes,
    top_k: int = 6,
    output_dir: Path | None = None,
    source_dialogues_dir: Path | None = None,
) -> list[dict]:
    """运行完整个体分身生成流水线

    Args:
        file_bytes: Excel 文件字节
        top_k: 最终生成的个体分身数量
        output_dir: 输出目录（默认 backend/data/）
        source_dialogues_dir: 原始对话保存目录

    Returns:
        list[dict]: 生成的个体分身列表
    """
    if output_dir is None:
        output_dir = Path(__file__).parent.parent / "data"
    if source_dialogues_dir is None:
        source_dialogues_dir = output_dir / "source_dialogues"
    source_dialogues_dir.mkdir(parents=True, exist_ok=True)

    logger.info("=" * 50)
    logger.info("Individual Persona Pipeline 启动")
    logger.info("=" * 50)

    # Step 1: 解析 Excel
    logger.info("[Step 1/7] 解析 Excel...")
    records = parse_excel_records(file_bytes)
    logger.info(f"   共 {len(records)} 条记录")

    # 按客户ID分组
    customer_records: dict[str, list[dict]] = {}
    for rec in records:
        cid = str(rec.get("id", "")).strip()
        if cid:
            customer_records.setdefault(cid, []).append(rec)

    logger.info(f"   共 {len(customer_records)} 个客户")

    # Step 2: 数据丰富度评分
    logger.info("[Step 2/7] 数据丰富度评分...")
    quality_scores = {}
    for cid, recs in customer_records.items():
        quality_scores[cid] = score_data_quality(recs)

    # 筛掉低质量客户（分数 < 0.2）
    valid_customers = {cid: recs for cid, recs in customer_records.items() if quality_scores[cid] >= 0.2}
    logger.info(f"   有效客户: {len(valid_customers)} / {len(customer_records)} (阈值 0.2)")

    # Step 3: LLM 特征预抽取
    logger.info("[Step 3/7] LLM 特征预抽取...")
    features_map = await extract_features_all(valid_customers, concurrency=5)
    logger.info(f"   完成: {len(features_map)} 个客户")

    # Step 4: MMR 多样性选择
    logger.info("[Step 4/7] MMR 多样性选择...")
    candidates = [(cid, quality_scores[cid], features_map[cid]) for cid in valid_customers]
    selected = mmr_diversity_select(candidates, top_k=top_k)
    logger.info(f"   选中 {len(selected)} 个客户:")
    for cid, score, feats, reason in selected:
        logger.info(f"     {cid[:16]}... 质量={score:.2f} 原因={reason}")

    # Step 5: 两步法 LLM 深度提取
    logger.info("[Step 5/7] 两步法 LLM 深度提取...")
    semaphore = asyncio.Semaphore(3)

    async def _synth_task(idx: int, cid: str, feats: dict, reason: str) -> dict:
        async with semaphore:
            logger.info(f"   开始生成 #{idx + 1}: {cid[:16]}...")
            try:
                persona = await synthesize_individual(cid, valid_customers[cid], feats, idx + 1)
                logger.info(f"   ✓ #{idx + 1} 完成: {persona.get('profile', {}).get('name', '?')}")
                return persona
            except Exception as e:
                logger.error(f"   ✗ #{idx + 1} 失败: {e}")
                raise

    tasks = [_synth_task(i, cid, feats, reason) for i, (cid, _, feats, reason) in enumerate(selected)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    personas = []
    for i, res in enumerate(results):
        if isinstance(res, Exception):
            logger.error(f"   跳过失败项 #{i + 1}: {res}")
            continue
        personas.append(res)

    # Step 6: Schema 校验 + 自动修复
    logger.info("[Step 6/7] Schema 校验 + 自动修复...")
    final_personas = []
    for i, persona in enumerate(personas):
        cid = selected[i][0]
        persona = validate_and_fix_persona(persona, cid)
        persona["id"] = f"indiv_new_{i + 1:02d}_{cid[:8]}"
        persona["_source"] = "individual_pipeline"
        persona["_source_customer_id"] = cid
        persona["_has_source_dialogues"] = True
        persona["_data_quality_score"] = selected[i][1]
        persona["_selection_reason"] = selected[i][3]
        persona["_extracted_features"] = selected[i][2]
        final_personas.append(persona)
        logger.info(f"   ✓ {persona['id']}: {persona['profile']['name']}")

    # Step 7: 保存原始对话溯源文件
    logger.info("[Step 7/7] 保存原始对话溯源...")
    for persona in final_personas:
        cid = persona["_source_customer_id"]
        save_source_dialogues(
            persona_id=persona["id"],
            customer_id=cid,
            records=valid_customers[cid],
            output_dir=source_dialogues_dir,
        )
        logger.info(f"   ✓ 已保存 {persona['id']} 的原始对话")

    logger.info(f"\n流水线完成！生成 {len(final_personas)} 个个体分身")
    return final_personas


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    if len(sys.argv) < 2:
        print("用法: python individual_pipeline.py <excel_path>")
        sys.exit(1)

    excel_path = Path(sys.argv[1])
    with open(excel_path, "rb") as f:
        file_bytes = f.read()

    personas = asyncio.run(run_individual_pipeline(file_bytes, top_k=6))
    print(f"\n生成完成，共 {len(personas)} 个分身")
    for p in personas:
        prof = p["profile"]
        print(f"  {p['id']}: {prof['name']} ({prof['age']}岁{prof['gender']}, {prof['city']})")
