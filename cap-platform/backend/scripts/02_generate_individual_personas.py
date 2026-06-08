"""个体分身生成脚本 — 用 LLM 深度提取，仅使用构造集

输入：data/construction_set.json
输出：data/individual_personas.json  （9 个个体分身的 JSON）

每个候选客户合并其全部构造集记录（结构化档案 + ASR 对话 + 试驾录音 + 标签），
调用 minimax-m2.7 一次，输出完整 Persona JSON。
"""

import asyncio
import json
import logging
import os
import re
import sys
from pathlib import Path

import httpx
import json_repair
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).parent.parent
DATA_DIR = BACKEND_DIR / "data"
load_dotenv(BACKEND_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("gen.individual")

API_KEY = os.getenv("MINIMAX_API_KEY", "")
API_URL = os.getenv("MINIMAX_API_URL", "")
MODEL = os.getenv("MINIMAX_MODEL", "")

if not (API_KEY and API_URL and MODEL):
    sys.exit("缺少 MINIMAX_API_KEY / MINIMAX_API_URL / MINIMAX_MODEL 环境变量")


# ── 语料拼接：限制每个客户输入的总字数，避免超出上下文 ──
MAX_ASR_CHARS = 12000   # 单客户 ASR 拼接上限
MAX_DRIVE_CHARS = 18000 # 单客户试驾文本拼接上限


def parse_dialog_json(raw) -> list[dict]:
    """ASR文本 / 试驾录音原文本 字段是 JSON 字符串，解析成对话列表"""
    if not raw or raw is None:
        return []
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
        items = []
        for d in data:
            # ASR 格式
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


def build_dialog_text(dialog: list[dict], max_chars: int) -> str:
    """拼接对话文本，限制字数。优先保留客户发言"""
    lines = []
    total = 0
    # 第一遍：保留所有客户发言
    for d in dialog:
        if d["role"] == "客户":
            line = f"[客户] {d['text']}"
            if total + len(line) > max_chars:
                break
            lines.append(line)
            total += len(line)
    # 第二遍：填充顾问发言（用于上下文）
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


def collect_concern_tags(records: list[dict]) -> list[str]:
    """从客户关注点标签 JSON 里提取真实客户话语片段"""
    quotes = []
    for rec in records:
        tags_raw = rec.get("客户关注点标签")
        if not tags_raw:
            continue
        try:
            data = json.loads(tags_raw) if isinstance(tags_raw, str) else tags_raw
            for item in data:
                qs = item.get("quote", [])
                if isinstance(qs, list):
                    for q in qs:
                        if isinstance(q, str) and q.startswith("客户:"):
                            quotes.append(q[3:].strip())
        except (json.JSONDecodeError, TypeError):
            continue
    # 去重保留前 30 条
    seen = set()
    unique = []
    for q in quotes:
        if q not in seen and len(q) >= 4:
            seen.add(q)
            unique.append(q)
        if len(unique) >= 30:
            break
    return unique


def collect_demand_labels(records: list[dict]) -> list[dict]:
    """从购车需求标签 JSON 里提取标签摘要"""
    labels = []
    for rec in records:
        tags_raw = rec.get("购车需求标签")
        if not tags_raw:
            continue
        try:
            data = json.loads(tags_raw) if isinstance(tags_raw, str) else tags_raw
            for item in data:
                label = item.get("label", "")
                items = item.get("items", [])
                for it in items:
                    reason = it.get("reason", "")
                    if reason:
                        labels.append({"label": label, "reason": reason[:120]})
        except (json.JSONDecodeError, TypeError):
            continue
    # 按 label 去重，每个 label 保留前 2 个
    grouped = {}
    for l in labels:
        grouped.setdefault(l["label"], []).append(l["reason"])
    summary = []
    for k, vs in grouped.items():
        summary.append({"label": k, "reasons": list(dict.fromkeys(vs))[:2]})
    return summary[:10]


def build_profile_block(records: list[dict]) -> str:
    """从结构化字段构建画像档案"""
    r = records[0]  # 同一个客户的字段都一样
    fields = [
        ("性别", r.get("性别")),
        ("年龄", r.get("年龄")),
        ("出生年月", r.get("出生年月")),
        ("婚姻", r.get("婚姻")),
        ("学历", r.get("学历")),
        ("所在行业", r.get("所在行业")),
        ("职业", r.get("职业")),
        ("家庭年收入", r.get("家庭年收入")),
        ("单位类型", r.get("单位类型")),
        ("常住地省份", r.get("常住地省份")),
        ("常住地城市", r.get("常住地城市")),
        ("常住地城市等级", r.get("常住地城市等级")),
        ("试驾品牌", r.get("试驾品牌")),
        ("试驾车系", r.get("试驾车系")),
        ("意向车系名称", r.get("意向车系名称")),
        ("用车场景", r.get("用车场景")),
        ("意向等级", r.get("意向等级")),
        ("购车人", r.get("购车人")),
        ("客户阶段", r.get("客户阶段")),
        ("增换购属性", r.get("增换购属性")),
        ("旧车品牌", r.get("旧车品牌")),
        ("旧车使用年限", r.get("旧车使用年限")),
        ("购车一级动机", r.get("购车一级动机")),
        ("购车二级动机", r.get("购车二级动机")),
        ("产品关注因素", r.get("产品关注因素")),
        ("初次了解信息渠道", r.get("初次了解信息渠道")),
        ("购车前对比品牌", r.get("购车前对比品牌")),
        ("最近暂败一级原因", r.get("最近暂败一级原因")),
        ("最近暂败二级原因", r.get("最近暂败二级原因")),
    ]
    return "\n".join(f"- {k}: {v}" for k, v in fields if v is not None and str(v) != "nan")


def build_summary_block(records: list[dict]) -> str:
    """汇总试驾小结和通话小结"""
    summaries = []
    for i, rec in enumerate(records):
        ts = rec.get("试驾小结")
        cs = rec.get("通话小结")
        if ts and str(ts).strip():
            summaries.append(f"试驾小结{i+1}：{str(ts)[:400]}")
        if cs and str(cs).strip():
            summaries.append(f"通话小结{i+1}：{str(cs)[:200]}")
    return "\n\n".join(summaries[:6])


def build_prompt(records: list[dict]) -> tuple[str, str]:
    """构建给 LLM 的 system + user prompt"""
    profile_block = build_profile_block(records)
    summary_block = build_summary_block(records)
    concern_quotes = collect_concern_tags(records)
    demand_labels = collect_demand_labels(records)

    # 拼接 ASR 和试驾对话
    all_asr = []
    all_drive = []
    for rec in records:
        all_asr.extend(parse_dialog_json(rec.get("ASR文本")))
        all_drive.extend(parse_dialog_json(rec.get("试驾录音原文本")))

    asr_text = build_dialog_text(all_asr, MAX_ASR_CHARS)
    drive_text = build_dialog_text(all_drive, MAX_DRIVE_CHARS)

    quotes_block = "\n".join(f"- 「{q}」" for q in concern_quotes[:20]) or "（无）"
    labels_block = "\n".join(
        f"- {l['label']}: {' / '.join(l['reasons'])}" for l in demand_labels
    ) or "（无）"

    system_prompt = """你是一位资深用户画像分析师，专门从真实购车客户的多次对话语料中提炼可被 AI 扮演的虚拟分身画像。

你的输出必须是严格的 JSON 对象（不要任何 markdown 包裹、不要任何解释文字），结构如下：

{
  "profile": {
    "name": "中文姓名（根据性别和地域气质起一个真实感的名字，不要太常见也不要太奇怪）",
    "age": 数字,
    "gender": "M" 或 "F",
    "city": "常住城市",
    "occupation": "职业的具体描述（10-25字）",
    "family": "家庭情况描述（如：已婚，有一个7岁孩子，妻子在事业单位）",
    "current_car": "现有车辆描述（如果首购写'无（首次购车）'，置换写旧车信息）"
  },
  "purchase": {
    "budget_stated": "对外说的预算区间（如 15-20万）",
    "budget_real": "心理真实预算（通常比对外的高 1-2 万）",
    "car_type": "意向车型类型描述",
    "stage": "购车阶段（如：对比选型/初步了解/锁定目标/即将下定）",
    "timeline": "购车时间线（如：1个月内/3个月内/半年内）",
    "usage_scenarios": ["3-5个具体用车场景"]
  },
  "pain_points": [
    {"topic": "痛点主题（4-8字）", "intensity": 0.5-0.95, "detail": "20-40字具体描述，必须有真实对话依据"}
  ],
  "hidden_info": [
    {"content": "客户不会主动透露的真实想法", "trigger_condition": "什么场景下会暴露"}
  ],
  "objections": [
    {"content": "精炼异议短语（8字以内，如'优惠不够''担心续航'）", "trigger_topic": "什么话题会触发", "resistance": 0.4-0.85}
  ],
  "competitor_awareness": "对竞品的认知和态度（30-80字）",
  "behavior": {
    "anti_guide": 0-1, "price_sensitivity": 0-1, "expressiveness": 0-1,
    "decisiveness": 0-1, "tech_literacy": 0-1
  },
  "communication": {
    "style": "沟通风格（如：理性务实型/急躁直接型/温和谨慎型）",
    "description": "30-60字沟通风格描述",
    "speech_patterns": ["3-5条短小口头禅（2-6字，如'说实话''那个''还行吧'），必须是真实对话中反复出现的习惯性表达，不能是完整长句"]
  },
  "tags": ["4-5个标签"]
}

【关键纪律】
1. speech_patterns 必须是该客户在【真实对话语料】里真实说过的短句/口头禅（2-6字），不能编造，不能是完整句子
2. pain_points 和 objections 的 detail/content 要从对话里找依据并精炼总结，objections 必须控制在8字以内，不能直接复制对话原文
3. hidden_info 是从对话推断的"言外之意"（比如客户嘴上说预算 15 万但提到经济压力 → 真实预算可能更紧）
4. 数值字段必须在指定区间，behavior 五项加起来应反映客户的整体性格
5. 必须输出有效 JSON，所有字符串用双引号，不能有尾随逗号
6. pain_points 3-4 个，objections 3-4 个，hidden_info 2-3 个
"""

    user_prompt = f"""请基于以下某位购车客户的全部构造集数据，输出一个可被 AI 扮演的虚拟分身 JSON。

═══ 结构化档案 ═══
{profile_block}

═══ 客户真实话语片段（从关注点标签提取） ═══
{quotes_block}

═══ 购车需求标签摘要 ═══
{labels_block}

═══ 对话/试驾小结 ═══
{summary_block}

═══ ASR 通话对话原文 ═══
{asr_text}

═══ 试驾录音对话原文 ═══
{drive_text}

请仔细阅读这位客户的真实表达，提炼他的性格、口头禅、关注点、异议、隐藏想法，输出 JSON。"""

    return system_prompt, user_prompt


def extract_json(text: str) -> dict:
    """从 LLM 回复中提取 JSON 对象，使用 json_repair 容错"""
    text = text.strip()
    # 去除 markdown 包裹
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    # 启发式：截到最外层 { ... }
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start : end + 1]
    # 先试标准 json，失败用 json_repair
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        repaired = json_repair.loads(text)
        if not isinstance(repaired, dict):
            raise ValueError(f"json_repair 返回非字典: {type(repaired)}")
        logger.warning("使用 json_repair 修复了 JSON")
        return repaired


async def call_llm(system: str, user: str, attempt: int = 1) -> str:
    """调用 minimax-m2.7"""
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.6,
        "max_tokens": 4096,
    }
    async with httpx.AsyncClient(timeout=180.0) as client:
        resp = await client.post(
            API_URL,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if resp.status_code != 200:
            logger.error(f"API 错误 {resp.status_code}: {resp.text[:500]}")
            if attempt < 2:
                logger.info(f"重试中... (attempt {attempt + 1})")
                await asyncio.sleep(3)
                return await call_llm(system, user, attempt + 1)
            resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def generate_persona(customer_id: str, records: list[dict], idx: int) -> dict:
    """为单个客户生成 Persona"""
    logger.info(f"[{idx}] 生成中: {customer_id[:12]}... ({len(records)} 条记录)")
    system, user = build_prompt(records)
    logger.info(f"   prompt 长度: system={len(system)}, user={len(user)}")
    reply = await call_llm(system, user)
    logger.info(f"   收到回复 {len(reply)} 字符")
    persona = extract_json(reply)
    # 注入 ID
    persona["id"] = f"indiv_{idx:02d}_{customer_id[:8]}"
    persona["_source_customer_id"] = customer_id
    persona["_kind"] = "individual"
    return persona


async def main():
    construction_file = DATA_DIR / "construction_set.json"
    if not construction_file.exists():
        sys.exit(f"未找到 {construction_file}，请先运行 01_split_dataset.py")

    with open(construction_file, "r", encoding="utf-8") as f:
        construction = json.load(f)

    records = construction["records"]
    customers = construction["meta"]["customers"]
    logger.info(f"读取构造集：{len(customers)} 个客户，{len(records)} 条记录")

    # 按客户分组
    by_customer: dict[str, list[dict]] = {}
    for rec in records:
        by_customer.setdefault(rec["id"], []).append(rec)

    # 增量模式：如果输出文件已存在，跳过已完成的客户
    output_path = DATA_DIR / "individual_personas.json"
    personas: list[dict] = []
    done_ids: set[str] = set()
    if output_path.exists():
        with open(output_path, "r", encoding="utf-8") as f:
            personas = json.load(f)
        done_ids = {p.get("_source_customer_id") for p in personas}
        logger.info(f"已存在 {len(personas)} 个分身，跳过：{[p['id'] for p in personas]}")

    for i, cust in enumerate(customers):
        if cust["id"] in done_ids:
            continue
        cust_records = by_customer.get(cust["id"], [])
        if not cust_records:
            logger.warning(f"客户 {cust['id']} 无构造集记录，跳过")
            continue
        try:
            persona = await generate_persona(cust["id"], cust_records, i + 1)
            personas.append(persona)
            # 按 _source_customer_id 排序保持稳定
            personas.sort(key=lambda p: p["id"])
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(personas, f, ensure_ascii=False, indent=2)
            logger.info(
                f"   ✓ 已保存 {persona['id']} - {persona.get('profile', {}).get('name', '?')}"
            )
        except Exception as e:
            logger.exception(f"客户 {cust['id']} 生成失败: {e}")

    logger.info(f"\n完成。共 {len(personas)} 个个体分身：{output_path}")


if __name__ == "__main__":
    asyncio.run(main())
