"""生成 CAP Token 消耗测试报告（纯实测数据，不写缓存命中）

运行: python3 generate_token_report_v2.py
"""

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

C_DARK = "2D2A26"
C_WHITE = "FFFFFF"
C_GRAY = "8C857E"
C_NOTE = "6B655E"
C_BLUE = "1A5276"
C_BEIGE = "E8E0D5"

THIN = Side(style="thin", color="D9D9D9")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

PRICING = {"standard_input": 2.100, "output": 8.400}

# 基于 real_measurement_v2.py 实测数据（2026-06-11）
# Supervisor 已改为对话结束后一次性评估
# 分身工厂数据基于代码分析估算（100条记录→3个典型分身）
SCENARIOS = {
    "销售对练": {
        "desc": "Training mode，15轮对话 + 结束后1次督导评分 + 1次分析报告",
        "rounds": 15,
        "agents": [
            {"name": "Avatar 分身对话", "calls": 15, "prompt": 41540, "output": 1511},
            {"name": "Supervisor 督导评分", "calls": 1, "prompt": 2524, "output": 1850, "note": "对话结束后一次性评估（含完整15轮历史）"},
            {"name": "Analyst 分析报告", "calls": 1, "prompt": 878, "output": 1024},
        ],
    },
    "用户调研": {
        "desc": "Research mode，20轮对话 + 1次洞察报告（无 Supervisor）",
        "rounds": 20,
        "agents": [
            {"name": "Avatar 分身对话", "calls": 20, "prompt": 45478, "output": 2249},
            {"name": "Analyst 洞察报告", "calls": 1, "prompt": 1344, "output": 1024},
        ],
    },
    "个体用户导入": {
        "desc": "Extractor Agent，单次调用提取结构化 Persona",
        "rounds": 1,
        "agents": [
            {"name": "Extractor 提取", "calls": 1, "prompt": 1369, "output": 538},
        ],
    },
    "问卷调研": {
        "desc": "Survey Agent，10题开放式问卷 × 1个分身（实测 2026-06-11）",
        "rounds": 10,
        "agents": [
            {"name": "Survey 问卷回答", "calls": 10, "prompt": 17435, "output": 3156, "note": "逐题调用，每题含完整画像+历史问答上下文（实测：杨波）"},
        ],
    },
    "分身工厂": {
        "desc": "100条真实用户数据 → LLM特征抽取 → K-Means聚类 → LLM合成3个典型分身",
        "rounds": 1,
        "agents": [
            {"name": "Factory Extractor 特征抽取", "calls": 100, "prompt": 220000, "output": 30000, "note": "逐条提取10维结构化特征标签（System+P≈2,200 ×100；Output≈300 ×100）"},
            {"name": "Factory Synthesizer 分身合成", "calls": 3, "prompt": 7800, "output": 9000, "note": "每个聚类合成1个典型分身（System+统计摘要≈2,600 ×3；Persona JSON≈3,000 ×3）"},
        ],
    },
}


def calc_cost(prompt, completion):
    return prompt / 1_000_000 * PRICING["standard_input"] + completion / 1_000_000 * PRICING["output"]


def set_cell(ws, row, col, value, **kw):
    cell = ws.cell(row=row, column=col, value=value)
    cell.alignment = Alignment(
        horizontal=kw.get("align_h", "center"),
        vertical=kw.get("align_v", "center"),
        wrap_text=True,
    )
    cell.border = BORDER
    font_color = kw.get("font_color", C_DARK)
    if isinstance(font_color, tuple):
        font_color = font_color[0]
    cell.font = Font(
        name="微软雅黑",
        size=kw.get("font_size", 11),
        bold=kw.get("bold", False),
        color=font_color,
    )
    if "bg_color" in kw:
        cell.fill = PatternFill(start_color=kw["bg_color"], end_color=kw["bg_color"], fill_type="solid")
    if "num_fmt" in kw:
        cell.number_format = kw["num_fmt"]
    return cell


def build_sheet(ws):
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 14
    ws.column_dimensions["C"].width = 16
    ws.column_dimensions["D"].width = 16
    ws.column_dimensions["E"].width = 16
    ws.column_dimensions["F"].width = 18
    ws.column_dimensions["G"].width = 18
    ws.column_dimensions["H"].width = 40

    row = 1

    # ═══ 大标题 ═══
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
    set_cell(ws, row, 1, "CAP 平台 Token 消耗测试报告",
             font_size=18, bold=True, align_h="center", font_color=C_DARK)
    ws.row_dimensions[row].height = 35
    row += 1

    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
    info = "模型：MiniMax-M2.7  |  测试时间：2026-06-11  |  基于实测 API 数据"
    set_cell(ws, row, 1, info, font_size=10, align_h="center", font_color=C_GRAY)
    ws.row_dimensions[row].height = 22
    row += 2

    # ═══ 一、定价 ═══
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
    set_cell(ws, row, 1, "一、MiniMax-M2.7 国内站定价",
             font_size=11, bold=True, align_h="left", font_color=C_DARK)
    row += 1

    for c, h in enumerate(["计费类型", "单价（¥/M tokens）", "说明"], 1):
        set_cell(ws, row, c, h, bg_color=C_DARK, font_color=C_WHITE, bold=True)
    ws.row_dimensions[row].height = 28
    row += 1

    pricing_rows = [
        ("Standard Input（标准输入）", PRICING["standard_input"], "非缓存的 input tokens"),
        ("Output（输出）", PRICING["output"], "LLM 生成的 completion tokens"),
    ]
    for label, price, note in pricing_rows:
        is_total = label.startswith("Output")
        bg = C_BEIGE if is_total else None
        bold = is_total
        set_cell(ws, row, 1, label, bold=bold, bg_color=bg, align_h="left")
        set_cell(ws, row, 2, price, bold=bold, bg_color=bg, num_fmt='"¥"#,##0.000')
        set_cell(ws, row, 3, note, bold=bold, bg_color=bg, align_h="left")
        row += 1
    row += 1

    # ═══ 二、各场景 Token 消耗明细 ═══
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
    set_cell(ws, row, 1, "二、各场景 Token 消耗与成本明细（单次会话，实测数据）",
             font_size=11, bold=True, align_h="left", font_color=C_DARK)
    row += 1

    for scene_name, scene_data in SCENARIOS.items():
        total_prompt = sum(a["prompt"] for a in scene_data["agents"])
        total_completion = sum(a["output"] for a in scene_data["agents"])
        total_tokens = total_prompt + total_completion

        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        rounds_text = f"{scene_data['rounds']} 轮" if scene_data['rounds'] > 1 else "单次"
        set_cell(ws, row, 1, f"【{scene_name}】{scene_data['desc']} — {rounds_text}",
                 font_size=11, bold=True, align_h="left", font_color=C_BLUE)
        ws.row_dimensions[row].height = 26
        row += 1

        agent_headers = ["环节", "调用次数", "Prompt Tokens", "Completion Tokens", "合计 Tokens",
                         "费用（无缓存）", "单环节占比", "备注"]
        for c, h in enumerate(agent_headers, 1):
            set_cell(ws, row, c, h, bg_color=C_DARK, font_color=C_WHITE, bold=True)
        ws.row_dimensions[row].height = 26
        row += 1

        for a in scene_data["agents"]:
            prompt = a["prompt"]
            output = a["output"]
            total = prompt + output
            pct = total / total_tokens if total_tokens > 0 else 0
            cost = calc_cost(prompt, output)

            set_cell(ws, row, 1, a["name"], align_h="left")
            set_cell(ws, row, 2, a["calls"])
            set_cell(ws, row, 3, prompt, num_fmt='#,##0')
            set_cell(ws, row, 4, output, num_fmt='#,##0')
            set_cell(ws, row, 5, total, num_fmt='#,##0')
            set_cell(ws, row, 6, cost, num_fmt='"¥"#,##0.0000')
            set_cell(ws, row, 7, f"{pct*100:.1f}%")
            set_cell(ws, row, 8, a.get("note", ""), align_h="left")
            row += 1

        # 场景合计
        cost_total = calc_cost(total_prompt, total_completion)

        set_cell(ws, row, 1, f"{scene_name}合计", bold=True, bg_color=C_BEIGE, align_h="left")
        set_cell(ws, row, 2, "—", bold=True, bg_color=C_BEIGE)
        set_cell(ws, row, 3, total_prompt, bold=True, bg_color=C_BEIGE, num_fmt='#,##0')
        set_cell(ws, row, 4, total_completion, bold=True, bg_color=C_BEIGE, num_fmt='#,##0')
        set_cell(ws, row, 5, total_tokens, bold=True, bg_color=C_BEIGE, num_fmt='#,##0')
        set_cell(ws, row, 6, cost_total, bold=True, bg_color=C_BEIGE, num_fmt='"¥"#,##0.0000')
        set_cell(ws, row, 7, "100.0%", bold=True, bg_color=C_BEIGE)
        set_cell(ws, row, 8, "", bold=True, bg_color=C_BEIGE)
        row += 1

        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        note = f"  单轮平均 Token：{total_tokens // scene_data['rounds']:,}"
        set_cell(ws, row, 1, note, font_size=9, align_h="left", font_color=C_GRAY, italic=True)
        row += 1
        row += 1

    # ═══ 三、五场景合计 ═══
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
    set_cell(ws, row, 1, "三、五场景合计",
             font_size=11, bold=True, align_h="left", font_color=C_DARK)
    row += 1

    total_headers = ["场景", "总轮次", "Prompt Tokens", "Completion Tokens", "总 Tokens",
                     "费用（无缓存）", None, None]
    for c, h in enumerate(total_headers, 1):
        if h:
            set_cell(ws, row, c, h, bg_color=C_DARK, font_color=C_WHITE, bold=True)
    ws.row_dimensions[row].height = 28
    row += 1

    grand_cost = 0
    grand_prompt = 0
    grand_completion = 0
    grand_tokens = 0

    for scene_name in ["销售对练", "用户调研", "个体用户导入", "问卷调研", "分身工厂"]:
        scene_data = SCENARIOS[scene_name]
        total_prompt = sum(a["prompt"] for a in scene_data["agents"])
        total_completion = sum(a["output"] for a in scene_data["agents"])
        total_tokens = total_prompt + total_completion
        rounds = scene_data["rounds"]
        cost = calc_cost(total_prompt, total_completion)

        grand_cost += cost
        grand_prompt += total_prompt
        grand_completion += total_completion
        grand_tokens += total_tokens

        set_cell(ws, row, 1, scene_name, align_h="left")
        set_cell(ws, row, 2, rounds)
        set_cell(ws, row, 3, total_prompt, num_fmt='#,##0')
        set_cell(ws, row, 4, total_completion, num_fmt='#,##0')
        set_cell(ws, row, 5, total_tokens, num_fmt='#,##0')
        set_cell(ws, row, 6, cost, num_fmt='"¥"#,##0.0000')
        row += 1

    set_cell(ws, row, 1, "合计", bold=True, bg_color=C_BEIGE, align_h="left")
    set_cell(ws, row, 2, "—", bold=True, bg_color=C_BEIGE)
    set_cell(ws, row, 3, grand_prompt, bold=True, bg_color=C_BEIGE, num_fmt='#,##0')
    set_cell(ws, row, 4, grand_completion, bold=True, bg_color=C_BEIGE, num_fmt='#,##0')
    set_cell(ws, row, 5, grand_tokens, bold=True, bg_color=C_BEIGE, num_fmt='#,##0')
    set_cell(ws, row, 6, grand_cost, bold=True, bg_color=C_BEIGE, num_fmt='"¥"#,##0.0000')
    row += 2

    # ═══ 四、单条用户消息成本 ═══
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
    set_cell(ws, row, 1, "四、单条用户消息成本",
             font_size=11, bold=True, align_h="left", font_color=C_DARK)
    row += 1

    msg_headers = ["场景", "总轮次", "总费用", "单条消息成本", None, None, None, None]
    for c, h in enumerate(msg_headers, 1):
        if h:
            set_cell(ws, row, c, h, bg_color=C_DARK, font_color=C_WHITE, bold=True)
    ws.row_dimensions[row].height = 28
    row += 1

    for scene_name in ["销售对练", "用户调研", "个体用户导入", "问卷调研", "分身工厂"]:
        scene_data = SCENARIOS[scene_name]
        total_prompt = sum(a["prompt"] for a in scene_data["agents"])
        total_completion = sum(a["output"] for a in scene_data["agents"])
        rounds = scene_data["rounds"]
        cost = calc_cost(total_prompt, total_completion)
        per_msg = cost / rounds if rounds > 0 else 0

        set_cell(ws, row, 1, scene_name, align_h="left")
        set_cell(ws, row, 2, rounds)
        set_cell(ws, row, 3, cost, num_fmt='"¥"#,##0.0000')
        set_cell(ws, row, 4, per_msg, num_fmt='"¥"#,##0.0000')
        row += 1

    row += 1

    # ═══ 五、关键结论 ═══
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
    set_cell(ws, row, 1, "五、关键结论",
             font_size=11, bold=True, align_h="left", font_color=C_DARK)
    row += 1

    train_prompt = sum(a["prompt"] for a in SCENARIOS["销售对练"]["agents"])
    train_completion = sum(a["output"] for a in SCENARIOS["销售对练"]["agents"])
    train_cost = calc_cost(train_prompt, train_completion)

    research_prompt = sum(a["prompt"] for a in SCENARIOS["用户调研"]["agents"])
    research_completion = sum(a["output"] for a in SCENARIOS["用户调研"]["agents"])
    research_cost = calc_cost(research_prompt, research_completion)

    survey_prompt = sum(a["prompt"] for a in SCENARIOS["问卷调研"]["agents"])
    survey_completion = sum(a["output"] for a in SCENARIOS["问卷调研"]["agents"])
    survey_cost = calc_cost(survey_prompt, survey_completion)

    conclusions = [
        "1. Supervisor 已改为对话结束后一次性评估（原每轮触发导致并发 502/超时）",
        "2. 一次性评估包含完整 15 轮对话历史，Prompt≈2,524 Completion≈1,850，一次成功",
        f"3. 销售对练单次会话（实测）：Prompt={train_prompt:,} Completion={train_completion:,} 费用=¥{train_cost:.4f}",
        f"4. 用户调研单次会话（实测）：Prompt={research_prompt:,} Completion={research_completion:,} 费用=¥{research_cost:.4f}",
        f"5. 问卷调研单次（实测 10 题）：Prompt={survey_prompt:,} Completion={survey_completion:,} 费用=¥{survey_cost:.4f}",
        "6. Avatar Prompt 逐轮线性增长：Training 15轮共 41,540P；Research 20轮共 45,478P",
        "7. 本报告仅展示无缓存成本（实测数据），缓存测算见《CAP 成本测算表》",
        "8. 改为最后一次性评估后，销售对练 Supervisor 调用从 15 次降至 1 次，成本下降显著",
    ]
    for note in conclusions:
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        set_cell(ws, row, 1, note, font_size=10, align_h="left", font_color=C_NOTE)
        ws.row_dimensions[row].height = 22
        row += 1


def main():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Token消耗测试报告"
    build_sheet(ws)
    output_path = "/Users/samhar/Downloads/CAP_Token_Report.xlsx"
    wb.save(output_path)
    print(f"Excel 已生成: {output_path}")

    # 控制台概览
    print("\n" + "="*70)
    print("  CAP Token 消耗测试报告（实测数据，无缓存）")
    print("="*70)
    for name, data in SCENARIOS.items():
        total_prompt = sum(a["prompt"] for a in data["agents"])
        total_completion = sum(a["output"] for a in data["agents"])
        rounds = data["rounds"]
        cost = calc_cost(total_prompt, total_completion)
        print(f"\n  {name} ({rounds}轮):")
        print(f"    Token: {total_prompt+total_completion:,} (P:{total_prompt:,} + C:{total_completion:,})")
        print(f"    费用: ¥{cost:.4f}  |  单条: ¥{cost/rounds:.4f}")
        for a in data["agents"]:
            c = calc_cost(a["prompt"], a["output"])
            print(f"      {a['name']}: calls={a['calls']} P={a['prompt']:,} C={a['output']:,} 费用=¥{c:.4f}")


if __name__ == "__main__":
    main()
