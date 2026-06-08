"""典型分身生成脚本 — 按 3 类聚类后合成代表性分身

3 类划分（按 cap-persona-selection 文档建议）：
  - 年轻单身通勤 (≤30岁 且 未婚)
  - 家庭已婚购车 (30-50岁 且 已婚有孩)
  - 增换购成熟 (≥40岁 且 增换购属性∈{增加购买, 旧车置换})

输入：data/typical_pool.json （29 人全部数据）
输出：data/typical_personas.json （3 个典型分身）
"""

import asyncio
import json
import logging
import os
import re
import sys
from collections import Counter
from pathlib import Path

import httpx
import json_repair
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).parent.parent
DATA_DIR = BACKEND_DIR / "data"
load_dotenv(BACKEND_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("gen.typical")

API_KEY = os.getenv("MINIMAX_API_KEY", "")
API_URL = os.getenv("MINIMAX_API_URL", "")
MODEL = os.getenv("MINIMAX_MODEL", "")

if not (API_KEY and API_URL and MODEL):
    sys.exit("缺少 MINIMAX_API_KEY / MINIMAX_API_URL / MINIMAX_MODEL 环境变量")


# ── 聚类规则 ──
CLUSTERS = {
    "typical_01_young_single": {
        "title": "年轻单身通勤客户",
        "filter": lambda r: (
            r.get("年龄") is not None
            and r["年龄"] <= 30
            and r.get("婚姻") == "未婚"
        ),
    },
    "typical_02_family_with_kids": {
        "title": "家庭已婚有孩客户",
        "filter": lambda r: (
            r.get("年龄") is not None
            and 30 <= r["年龄"] <= 50
            and r.get("婚姻") == "已婚有孩"
        ),
    },
    "typical_03_mature_replacement": {
        "title": "增换购成熟客户",
        "filter": lambda r: (
            r.get("年龄") is not None
            and r["年龄"] >= 40
            and r.get("增换购属性") in ("增加购买", "旧车置换")
        ),
    },
}


def parse_dialog_json(raw):
    if not raw:
        return []
    try:
        data = json.loads(raw) if isinstance(raw, str) else raw
        items = []
        for d in data:
            role = d.get("additions", {}).get("role") or d.get("role", "?")
            text = d.get("text", "")
            if text and text.strip():
                items.append({"role": role, "text": text.strip()})
        return items
    except (json.JSONDecodeError, TypeError, AttributeError):
        return []


def collect_concern_quotes(records, max_n=40):
    quotes = []
    for rec in records:
        raw = rec.get("客户关注点标签")
        if not raw:
            continue
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
            for item in data:
                qs = item.get("quote", [])
                if isinstance(qs, list):
                    for q in qs:
                        if isinstance(q, str) and q.startswith("客户:"):
                            quotes.append(q[3:].strip())
        except (json.JSONDecodeError, TypeError):
            continue
    seen = set()
    out = []
    for q in quotes:
        if q not in seen and len(q) >= 4:
            seen.add(q)
            out.append(q)
        if len(out) >= max_n:
            break
    return out


def cluster_summary(records: list[dict]) -> dict:
    """聚类内的统计摘要"""
    by_customer = {}
    for r in records:
        by_customer.setdefault(r["id"], []).append(r)

    ages = [r["年龄"] for r in records if r.get("年龄") is not None]
    cities = Counter(r["常住地城市"] for r in records if r.get("常住地城市"))
    occupations = Counter(r["职业"] for r in records if r.get("职业"))
    incomes = Counter(r["家庭年收入"] for r in records if r.get("家庭年收入"))
    purchase_types = Counter(r["增换购属性"] for r in records if r.get("增换购属性"))
    motivations = Counter()
    for r in records:
        m = r.get("购车二级动机")
        if m:
            for part in str(m).split(","):
                part = part.strip()
                if part:
                    motivations[part] += 1
    concerns = Counter()
    for r in records:
        c = r.get("产品关注因素")
        if c:
            for part in str(c).split(","):
                part = re.sub(r"（[^）]*）", "", part).strip()
                if part:
                    concerns[part] += 1
    usage = Counter()
    for r in records:
        u = r.get("用车场景")
        if u:
            matches = re.findall(r"\{([^}]+)\}", str(u))
            for m in matches:
                usage[m] += 1
    fail_reasons = Counter()
    for r in records:
        f1 = r.get("最近暂败一级原因")
        f2 = r.get("最近暂败二级原因")
        if f1 and str(f1) != "nan":
            fail_reasons[str(f1)] += 1
        if f2 and str(f2) != "nan":
            fail_reasons[str(f2)] += 1

    # 收集真实客户话语
    quotes = collect_concern_quotes(records)
    # 收集试驾原文片段（取每个客户前 2 条客户发言）
    drive_quotes = []
    for cust_records in list(by_customer.values())[:8]:
        for rec in cust_records[:1]:
            dialog = parse_dialog_json(rec.get("试驾录音原文本"))
            cust_only = [d["text"] for d in dialog if d["role"] == "客户"][:3]
            drive_quotes.extend(cust_only)
    drive_quotes = list(dict.fromkeys(drive_quotes))[:25]

    return {
        "unique_customers": len(by_customer),
        "total_records": len(records),
        "age_range": (min(ages), max(ages)) if ages else (None, None),
        "age_avg": sum(ages) / len(ages) if ages else None,
        "top_cities": cities.most_common(5),
        "top_occupations": occupations.most_common(5),
        "income_dist": incomes.most_common(5),
        "purchase_type_dist": purchase_types.most_common(5),
        "top_motivations": motivations.most_common(8),
        "top_concerns": concerns.most_common(8),
        "top_usage_scenarios": usage.most_common(6),
        "top_fail_reasons": fail_reasons.most_common(5),
        "concern_quotes": quotes,
        "drive_quotes": drive_quotes,
    }


def build_prompt(cluster_key: str, title: str, summary: dict) -> tuple[str, str]:
    age_lo, age_hi = summary["age_range"]
    age_avg = summary["age_avg"]

    def fmt_counter(items):
        return "\n".join(f"  - {k}: {v} 次" for k, v in items) or "  （无）"

    def fmt_list(items):
        return "\n".join(f"  - 「{q}」" for q in items) or "  （无）"

    system_prompt = """你是一位资深用户画像分析师，专门把多个真实客户的共性聚合成一个"典型分身"——他不是某个具体客户，而是该客群共性特征的代表。

输出必须是严格的 JSON 对象（不要 markdown 包裹、不要解释），结构如下：

{
  "profile": {
    "name": "中文姓名（典型代表，起一个常见但不刻板的名字）",
    "age": 数字（取该聚类的中位年龄附近）,
    "gender": "M" 或 "F"（取该聚类的主流性别）,
    "city": "代表性城市（不要选最热门的一二线，选该聚类典型的城市）",
    "occupation": "代表性职业（10-25字）",
    "family": "代表性家庭情况描述",
    "current_car": "代表性现有车辆描述"
  },
  "purchase": {
    "budget_stated": "对外预算（基于该聚类收入水平推断）",
    "budget_real": "心理真实预算",
    "car_type": "意向车型类型",
    "stage": "典型购车阶段",
    "timeline": "典型购车时间线",
    "usage_scenarios": ["3-5个典型用车场景"]
  },
  "pain_points": [
    {"topic": "痛点主题（4-8字）", "intensity": 0.5-0.95, "detail": "该聚类共性痛点"}
  ],
  "hidden_info": [
    {"content": "该聚类典型隐藏诉求", "trigger_condition": "触发场景"}
  ],
  "objections": [
    {"content": "精炼异议短语（8字以内，如'优惠不够''担心续航'）", "trigger_topic": "触发话题", "resistance": 0.4-0.85}
  ],
  "competitor_awareness": "该聚类典型竞品认知（30-80字）",
  "behavior": {
    "anti_guide": 0-1, "price_sensitivity": 0-1, "expressiveness": 0-1,
    "decisiveness": 0-1, "tech_literacy": 0-1
  },
  "communication": {
    "style": "典型沟通风格",
    "description": "30-60字描述",
    "speech_patterns": ["3-5条短小口头禅（2-6字，如'说实话''那个''还行吧'），必须是真实话语片段中反复出现的习惯性表达，不能是完整长句"]
  },
  "tags": ["4-5个标签，体现该聚类的核心特征"]
}

【关键纪律】
1. speech_patterns 必须从下面提供的【真实客户话语片段】里挑出该聚类客户真实说过的短小口头禅（2-6字），不能是完整句子
2. 痛点、异议、隐藏信息必须基于聚类的统计数据，反映共性而非某个体特殊性，objections 必须控制在8字以内，不能直接复制对话原文
3. behavior 五项要反映该聚类的整体性格倾向
4. 所有字段必须输出，JSON 必须有效
"""

    user_prompt = f"""请基于以下聚类统计数据，输出一个典型分身的 JSON。

═══ 聚类信息 ═══
聚类标题：{title}
聚类内客户数：{summary['unique_customers']}
聚类内记录条数：{summary['total_records']}
年龄分布：{age_lo}-{age_hi} 岁（平均 {age_avg:.1f}）

═══ 主要城市分布 ═══
{fmt_counter(summary['top_cities'])}

═══ 主要职业分布 ═══
{fmt_counter(summary['top_occupations'])}

═══ 家庭年收入分布 ═══
{fmt_counter(summary['income_dist'])}

═══ 增换购属性分布 ═══
{fmt_counter(summary['purchase_type_dist'])}

═══ 高频购车动机 ═══
{fmt_counter(summary['top_motivations'])}

═══ 高频产品关注因素 ═══
{fmt_counter(summary['top_concerns'])}

═══ 高频用车场景 ═══
{fmt_counter(summary['top_usage_scenarios'])}

═══ 主要暂败原因 ═══
{fmt_counter(summary['top_fail_reasons'])}

═══ 真实客户话语片段（speech_patterns 必须从此处选取） ═══
{fmt_list(summary['concern_quotes'])}

═══ 试驾对话客户原话样本 ═══
{fmt_list(summary['drive_quotes'])}

请仔细分析这个聚类的共性特征，合成一个能代表该客群的典型虚拟分身 JSON。"""

    return system_prompt, user_prompt


def extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start : end + 1]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        repaired = json_repair.loads(text)
        if not isinstance(repaired, dict):
            raise ValueError(f"json_repair 非字典: {type(repaired)}")
        logger.warning("使用 json_repair 修复 JSON")
        return repaired


async def call_llm(system: str, user: str, attempt: int = 1) -> str:
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
                await asyncio.sleep(3)
                return await call_llm(system, user, attempt + 1)
            resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def generate_typical(cluster_key: str, title: str, records: list[dict]) -> dict | None:
    if not records:
        logger.warning(f"聚类 {cluster_key} 无匹配记录，跳过")
        return None
    summary = cluster_summary(records)
    logger.info(
        f"[{cluster_key}] {title}: {summary['unique_customers']} 客户 / {summary['total_records']} 记录"
    )
    system, user = build_prompt(cluster_key, title, summary)
    logger.info(f"   prompt: system={len(system)}, user={len(user)}")
    reply = await call_llm(system, user)
    logger.info(f"   收到回复 {len(reply)} 字符")
    persona = extract_json(reply)
    persona["id"] = cluster_key
    persona["_kind"] = "typical"
    persona["_cluster_title"] = title
    persona["_cluster_stats"] = {
        "unique_customers": summary["unique_customers"],
        "age_range": summary["age_range"],
        "top_concerns": summary["top_concerns"][:5],
    }
    return persona


async def main():
    pool_file = DATA_DIR / "typical_pool.json"
    if not pool_file.exists():
        sys.exit(f"未找到 {pool_file}，请先运行 01_split_dataset.py")

    with open(pool_file, "r", encoding="utf-8") as f:
        pool = json.load(f)
    all_records = pool["records"]
    logger.info(f"读取聚类池：{len(all_records)} 条记录，{pool['meta']['unique_customers']} 个客户")

    output_path = DATA_DIR / "typical_personas.json"
    personas: list[dict] = []
    if output_path.exists():
        with open(output_path, "r", encoding="utf-8") as f:
            personas = json.load(f)
        done = {p["id"] for p in personas}
        logger.info(f"已存在 {len(personas)} 个典型分身：{list(done)}")
    else:
        done = set()

    for cluster_key, cfg in CLUSTERS.items():
        if cluster_key in done:
            continue
        matched = [r for r in all_records if cfg["filter"](r)]
        try:
            persona = await generate_typical(cluster_key, cfg["title"], matched)
            if persona:
                personas.append(persona)
                personas.sort(key=lambda p: p["id"])
                with open(output_path, "w", encoding="utf-8") as f:
                    json.dump(personas, f, ensure_ascii=False, indent=2)
                logger.info(
                    f"   ✓ {persona['id']} - {persona.get('profile', {}).get('name', '?')}"
                )
        except Exception as e:
            logger.exception(f"聚类 {cluster_key} 生成失败: {e}")

    logger.info(f"\n完成。共 {len(personas)} 个典型分身：{output_path}")


if __name__ == "__main__":
    asyncio.run(main())
