"""真实 API 调用 + 完整 Token 消耗测量（改进版）

改进:
1. 对话结束后轮询等待所有 Supervisor 异步任务完成
2. 输出每个 Agent 的逐轮明细
3. 分别统计无缓存和按 40% 缓存命中率的成本

运行:
    export MINIMAX_API_KEY=your_key
    cd backend && python3 real_measurement_v2.py
"""

import json
import os
import subprocess
import sys
import time
import httpx

BASE = "http://127.0.0.1:8787"

TRAINING_MESSAGES = [
    "您好，欢迎到店看车！今天主要想了解哪款车型？",
    "您之前了解过我们品牌吗？",
    "方便问一下您的用车需求吗？主要是日常通勤还是家庭出行？",
    "您预算大概在什么范围？",
    "您对新能源车有兴趣吗？我们这边有几款续航很不错的车型。",
    "那您对车辆空间有要求吗？需要经常载人吗？",
    "您目前开的是什么车？感觉怎么样？",
    "您比较看重车辆的哪些方面？是外观、配置还是安全性？",
    "我们这款车最近有优惠活动，您要不要试驾一下？",
    "您对这个颜色满意吗？",
    "您如果今天定下来的话，我可以帮您申请额外的优惠。",
    "您对分期付款有了解吗？我们目前的利率很低。",
    "您还有其他顾虑吗？",
    "那您觉得这款车怎么样？",
    "您看要不要先交个定金，我帮您把这台车留着？",
]

RESEARCH_MESSAGES = [
    "您好，能先简单介绍一下您的用车情况吗？",
    "您目前开的是什么车？体验如何？",
    "如果换车，您最看重哪些方面？",
    "您一般会在什么场景下用车？",
    "您对新能源车怎么看？",
    "您的预算大概在什么范围？",
    "您会考虑哪些品牌的车型？",
    "您家人对选车有什么意见吗？",
    "您对车辆的智能化功能有要求吗？",
    "您平时停车方便吗？对车身尺寸有要求吗？",
    "您比较在意油耗还是动力？",
    "您会去试驾吗？试驾时最关注什么？",
    "您对售后服务有什么期待？",
    "您是通过什么渠道了解这款车的？",
    "您对比过哪些竞品？觉得它们怎么样？",
    "您购车的决策周期一般多长？",
    "如果最终没选我们品牌，可能是什么原因？",
    "您对价格优惠的敏感度如何？",
    "您更倾向自己开还是也会给家人用？",
    "感谢您的时间，还有什么想补充的吗？",
]


def wait_for_server(timeout: int = 30) -> bool:
    for _ in range(timeout * 2):
        try:
            r = httpx.get(f"{BASE}/health", timeout=2)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def create_session(persona_id: str, mode: str) -> str:
    r = httpx.post(
        f"{BASE}/api/session/create",
        json={"persona_id": persona_id, "mode": mode},
    )
    r.raise_for_status()
    return r.json()["session_id"]


def chat_round(session_id: str, message: str, max_retries: int = 2) -> dict:
    for attempt in range(max_retries + 1):
        try:
            r = httpx.post(
                f"{BASE}/api/chat",
                json={"session_id": session_id, "message": message},
                timeout=90,
            )
            if r.status_code == 500 and attempt < max_retries:
                print(f"    [WARN] round failed with 500, retrying...")
                time.sleep(2)
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:
            if attempt < max_retries:
                print(f"    [WARN] round error: {e}, retrying...")
                time.sleep(2)
                continue
            raise


def end_session(session_id: str):
    r = httpx.post(f"{BASE}/api/session/{session_id}/end", timeout=10)
    if r.status_code == 404:
        return
    r.raise_for_status()


def generate_report(session_id: str):
    r = httpx.post(f"{BASE}/api/session/{session_id}/report", timeout=120)
    r.raise_for_status()
    return r.json()


def get_token_usage(session_id: str) -> dict:
    r = httpx.get(f"{BASE}/api/session/{session_id}/token-usage", timeout=10)
    r.raise_for_status()
    return r.json()


def wait_for_supervisor_completion(session_id: str, timeout: int = 120):
    """轮询等待 Supervisor 异步任务完成（现在只在对话结束后触发 1 次）"""
    print("  等待 Supervisor 评估完成...")
    for _ in range(timeout):
        usage = get_token_usage(session_id)
        detail = usage.get("detail", [])
        supervisor_count = sum(1 for d in detail if d.get("agent") == "supervisor")
        if supervisor_count >= 1:
            print(f"  ✓ Supervisor 完成（1/1）")
            return usage
        time.sleep(1)
    print(f"  ⚠ 超时，Supervisor 未完成")
    return get_token_usage(session_id)


def run_conversation_scenario(mode: str, messages: list[str], persona_id: str) -> dict:
    print(f"\n{'='*70}")
    print(f"[开始] {mode} 场景，分身: {persona_id}，预计 {len(messages)} 轮")
    print(f"{'='*70}")
    sid = create_session(persona_id, mode)
    print(f"  Session: {sid}")

    for i, msg in enumerate(messages, 1):
        resp = chat_round(sid, msg)
        reply = resp.get("reply", "")[:40].replace("\n", " ")
        print(f"  Round {i:2d}: {reply}...")
        time.sleep(0.5)

    print("  结束对话，生成报告...")
    end_session(sid)
    generate_report(sid)

    # 如果是 training 模式，等待 Supervisor 完成（现在只在结束后触发 1 次）
    if mode == "training":
        usage = wait_for_supervisor_completion(sid)
    else:
        time.sleep(3)
        usage = get_token_usage(sid)

    return usage


def summarize_usage(usage: dict) -> dict:
    detail = usage.get("detail", [])
    by_agent = {}
    totals = {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "cache_read_input_tokens": 0,
        "cache_creation_input_tokens": 0,
    }
    for d in detail:
        agent = d.get("agent", "unknown")
        by_agent.setdefault(agent, {
            "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
            "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0,
            "calls": 0,
        })
        for k in totals:
            by_agent[agent][k] += d.get(k, 0)
            totals[k] += d.get(k, 0)
        by_agent[agent]["calls"] += 1

    return {
        "mode": usage.get("mode"),
        "rounds": usage.get("rounds"),
        "by_agent": by_agent,
        "totals": totals,
        "detail": detail,
    }


def print_scenario_summary(label: str, summary: dict):
    print(f"\n{'='*70}")
    print(f"  {label} 实测结果")
    print(f"{'='*70}")
    t = summary["totals"]
    print(f"  总 Prompt Tokens:        {t['prompt_tokens']:,}")
    print(f"  总 Completion Tokens:    {t['completion_tokens']:,}")
    print(f"  总 Total Tokens:         {t['total_tokens']:,}")
    print(f"  Cache Read Input Tokens: {t['cache_read_input_tokens']:,}")
    print(f"  Cache Creation Tokens:   {t['cache_creation_input_tokens']:,}")

    if t["prompt_tokens"] > 0:
        hit_rate = t["cache_read_input_tokens"] / t["prompt_tokens"] * 100
        print(f"  实际缓存命中率:          {hit_rate:.1f}%")

    print(f"\n  按 Agent 拆分:")
    for agent, stats in summary["by_agent"].items():
        print(f"    {agent:12s}: calls={stats['calls']} "
              f"prompt={stats['prompt_tokens']:,} "
              f"completion={stats['completion_tokens']:,} "
              f"cache_read={stats['cache_read_input_tokens']:,} "
              f"cache_creation={stats['cache_creation_input_tokens']:,}")


def calc_cost_with_cache(prompt: int, completion: int, cache_ratio: float = 0.0) -> float:
    cacheable = int(prompt * cache_ratio)
    noncache = prompt - cacheable
    return (
        cacheable / 1_000_000 * 0.420
        + noncache / 1_000_000 * 2.100
        + completion / 1_000_000 * 8.400
    )


def main():
    api_key = os.getenv("MINIMAX_API_KEY")
    if not api_key:
        print("错误：请设置 MINIMAX_API_KEY 环境变量")
        sys.exit(1)

    print("启动 CAP 后端服务...")
    env = os.environ.copy()
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "8787"],
        cwd="/Users/samhar/text/.claude/worktrees/bold-chandrasekhar-ae472b/cap-platform/backend",
        env=env,
    )

    try:
        if not wait_for_server():
            print("后端启动超时")
            proc.terminate()
            return
        print("后端就绪 ✓\n")

        # 1. 销售对练
        training_usage = run_conversation_scenario("training", TRAINING_MESSAGES, "typical_01_starter")
        training_summary = summarize_usage(training_usage)
        print_scenario_summary("销售对练 (Training)", training_summary)

        # 2. 用户调研
        research_usage = run_conversation_scenario("research", RESEARCH_MESSAGES, "typical_02_family")
        research_summary = summarize_usage(research_usage)
        print_scenario_summary("用户调研 (Research)", research_summary)

        # 汇总输出
        print("\n" + "="*70)
        print("  成本测算（MiniMax-M2.7 定价）")
        print("="*70)

        for label, summary in [("销售对练", training_summary), ("用户调研", research_summary)]:
            total_prompt = summary["totals"]["prompt_tokens"]
            total_completion = summary["totals"]["completion_tokens"]
            cost_no_cache = calc_cost_with_cache(total_prompt, total_completion, 0.0)
            cost_40_cache = calc_cost_with_cache(total_prompt, total_completion, 0.40)

            print(f"\n  {label}:")
            print(f"    Prompt:     {total_prompt:,}")
            print(f"    Completion: {total_completion:,}")
            print(f"    无缓存:     ¥{cost_no_cache:.4f}")
            print(f"    40%缓存:    ¥{cost_40_cache:.4f}")
            print(f"    节省:       ¥{cost_no_cache - cost_40_cache:.4f}")

            for agent, stats in summary["by_agent"].items():
                p = stats["prompt_tokens"]
                c = stats["completion_tokens"]
                calls = stats["calls"]
                c_no = calc_cost_with_cache(p, c, 0.0)
                c_40 = calc_cost_with_cache(p, c, 0.40)
                print(f"      {agent:12s}: calls={calls} P={p:,} C={c:,} 无缓存=¥{c_no:.4f} 40%=¥{c_40:.4f}")

        # 保存 JSON
        output = {
            "training": training_summary,
            "research": research_summary,
        }
        with open("token_measurement_v2.json", "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        print("\n实测数据已保存到 token_measurement_v2.json")

    finally:
        print("\n关闭后端服务...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("完成")


if __name__ == "__main__":
    main()
