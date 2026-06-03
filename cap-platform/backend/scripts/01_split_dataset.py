"""数据切分脚本 — 按 70/30 把原始 Excel 切成构造集 + 保真评估集

输出：
  data/persona_rankings.json   — 29 个客户的数据丰富度排名
  data/construction_set.json   — 9 个个体分身候选的构造集记录（70%）
  data/fidelity_set.json       — 9 个个体分身候选的保真评估集（30%，锁定）
  data/typical_pool.json       — 全部 29 人的数据，给典型分身聚类用
"""

import io
import json
import math
import os
import sys
from pathlib import Path

import msoffcrypto
import pandas as pd

# ── 配置 ──
EXCEL_PATH = "/Users/samhar/Downloads/训练样本数据0518100.xlsx"
PASSWORD = "demo0518&100"
TOP_N_INDIVIDUAL = 9  # 前 9 名做个体分身
CONSTRUCTION_RATIO = 0.7  # 构造集占比

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def load_decrypted() -> pd.DataFrame:
    with open(EXCEL_PATH, "rb") as f:
        office_file = msoffcrypto.OfficeFile(f)
        office_file.load_key(password=PASSWORD)
        decrypted = io.BytesIO()
        office_file.decrypt(decrypted)
        decrypted.seek(0)
        df = pd.read_excel(decrypted)
    df["创建时间"] = pd.to_datetime(df["创建时间"], errors="coerce")
    return df


def count_concern_tags(val) -> int:
    if pd.isna(val) or not str(val).strip():
        return 0
    try:
        return len(json.loads(str(val)))
    except (json.JSONDecodeError, TypeError):
        return 0


def compute_rankings(df: pd.DataFrame) -> list[dict]:
    """按记录数、ASR 字数、试驾字数、关注点数 综合排名"""
    rankings = []
    for cust_id, group in df.groupby("id"):
        asr_chars = sum(len(str(x)) for x in group["ASR文本"].dropna())
        drive_chars = sum(len(str(x)) for x in group["试驾录音原文本"].dropna())
        concern_count = sum(count_concern_tags(x) for x in group["客户关注点标签"].dropna())

        first_row = group.iloc[0]
        rankings.append({
            "id": cust_id,
            "records": int(len(group)),
            "asr_chars": int(asr_chars),
            "drive_chars": int(drive_chars),
            "concern_count": int(concern_count),
            "gender": first_row.get("性别"),
            "age": int(first_row.get("年龄")) if pd.notna(first_row.get("年龄")) else None,
            "marriage": first_row.get("婚姻"),
            "occupation": first_row.get("职业"),
            "city": first_row.get("常住地城市"),
            "purchase_type": first_row.get("增换购属性"),
            # 综合分：记录数权重最大
            "score": (
                len(group) * 1000
                + asr_chars / 100
                + drive_chars / 100
                + concern_count * 10
            ),
        })

    rankings.sort(key=lambda r: r["score"], reverse=True)
    for i, r in enumerate(rankings):
        r["rank"] = i + 1
    return rankings


def split_records(group: pd.DataFrame, ratio: float) -> tuple[pd.DataFrame, pd.DataFrame]:
    """按创建时间升序，前 ratio 做构造，后面做保真。至少保留 1 条进保真集。"""
    sorted_group = group.sort_values("创建时间", ascending=True, na_position="last")
    n = len(sorted_group)
    n_construct = max(1, math.floor(n * ratio))
    # 至少 1 条进保真集（如果总数 >= 2）
    if n_construct >= n and n >= 2:
        n_construct = n - 1
    construct = sorted_group.iloc[:n_construct]
    fidelity = sorted_group.iloc[n_construct:]
    return construct, fidelity


def row_to_record(row: pd.Series) -> dict:
    """把一行 DataFrame 转成可 JSON 序列化的 dict（保留全部字段）"""
    rec = {}
    for col in row.index:
        val = row[col]
        if pd.isna(val):
            rec[col] = None
        elif isinstance(val, pd.Timestamp):
            rec[col] = val.strftime("%Y-%m-%d %H:%M:%S")
        elif hasattr(val, "item"):
            try:
                rec[col] = val.item()
            except (ValueError, AttributeError):
                rec[col] = str(val)
        else:
            rec[col] = val
    return rec


def main():
    print(f"[1/5] 读取并解密 Excel: {EXCEL_PATH}")
    df = load_decrypted()
    print(f"   共 {len(df)} 条记录，{df['id'].nunique()} 个客户")

    print("[2/5] 计算数据丰富度排名")
    rankings = compute_rankings(df)
    top_ids = [r["id"] for r in rankings[:TOP_N_INDIVIDUAL]]
    print(f"   Top {TOP_N_INDIVIDUAL} 个体分身候选：")
    for r in rankings[:TOP_N_INDIVIDUAL]:
        print(
            f"     #{r['rank']:>2} {r['id'][:12]}... "
            f"records={r['records']:>2} asr={r['asr_chars']:>6} "
            f"drive={r['drive_chars']:>6} concern={r['concern_count']:>3}"
        )

    print(f"[3/5] 按 {CONSTRUCTION_RATIO:.0%}/{1 - CONSTRUCTION_RATIO:.0%} 切分构造集 / 保真集")
    construction_records: list[dict] = []
    fidelity_records: list[dict] = []
    customer_splits: list[dict] = []
    for cust_id in top_ids:
        group = df[df["id"] == cust_id]
        construct_df, fidelity_df = split_records(group, CONSTRUCTION_RATIO)
        c_recs = [row_to_record(r) for _, r in construct_df.iterrows()]
        f_recs = [row_to_record(r) for _, r in fidelity_df.iterrows()]
        construction_records.extend(c_recs)
        fidelity_records.extend(f_recs)
        customer_splits.append({
            "id": cust_id,
            "total": len(group),
            "construction": len(c_recs),
            "fidelity": len(f_recs),
        })
        print(
            f"   {cust_id[:12]}... 共{len(group):>2}条 → "
            f"构造{len(c_recs):>2}条 + 保真{len(f_recs):>2}条"
        )

    print("[4/5] 构建典型分身聚类池（全部 29 人）")
    typical_pool = [row_to_record(r) for _, r in df.iterrows()]
    print(f"   {len(typical_pool)} 条记录入池")

    print("[5/5] 写入输出文件")
    outputs = {
        "persona_rankings.json": rankings,
        "construction_set.json": {
            "meta": {
                "total_records": len(construction_records),
                "customers": customer_splits,
                "ratio": CONSTRUCTION_RATIO,
            },
            "records": construction_records,
        },
        "fidelity_set.json": {
            "meta": {
                "total_records": len(fidelity_records),
                "customers": customer_splits,
                "ratio": 1 - CONSTRUCTION_RATIO,
                "warning": "本文件仅供保真度评估使用，不得用于 Persona 生成",
            },
            "records": fidelity_records,
        },
        "typical_pool.json": {
            "meta": {
                "total_records": len(typical_pool),
                "unique_customers": df["id"].nunique(),
            },
            "records": typical_pool,
        },
    }
    for filename, content in outputs.items():
        path = DATA_DIR / filename
        with open(path, "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        size_kb = path.stat().st_size / 1024
        print(f"   ✓ {filename}  ({size_kb:.1f} KB)")

    print("\n完成。下一步运行 scripts/02_generate_individual_personas.py")


if __name__ == "__main__":
    main()
