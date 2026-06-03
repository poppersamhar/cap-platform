"""Prompt A/B 实验：完整版 vs 精简版 vs 极简版"""

import asyncio
import json
import os
import sys
import time

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from personas.real_personas import get_persona
from engine.emotion_state import EmotionState
from agents.avatar_agent import (
    build_system_prompt as build_full,
    build_persona_prompt,
    build_scene_prompt,
    _emotion_to_description,
)

import httpx

MINIMAX_API_KEY = os.getenv("MINIMAX_API_KEY", "")
MINIMAX_API_URL = os.getenv("MINIMAX_API_URL", "")
MINIMAX_MODEL = os.getenv("MINIMAX_MODEL", "")


def est_tokens(text: str) -> int:
    """简易 token 估算"""
    import re
    cn = len(re.findall(r'[一-鿿]', text))
    en = len(re.findall(r'[a-zA-Z]+', text))
    punct = len(re.findall(r'[，。！？、：；\"''（）【】—…·]', text))
    return cn + int(en * 0.7) + punct


def build_compact_persona_prompt(persona, emotion):
    """精简版角色层：压缩情绪描述，简化列表格式"""
    # 口头禅只保留前3条
    patterns = persona.communication.speech_patterns[:3]
    patterns_text = ' '.join(f'「{sp}」' for sp in patterns)

    # 痛点一句话
    pains = '；'.join(f"{p.topic}({p.intensity:.0%})" for p in persona.pain_points)

    # 异议一句话
    objections = '；'.join(f"{obj.trigger_topic}:「{obj.content}」" for obj in persona.objections)

    # 隐藏信息
    hidden = '；'.join(f"{h.content}（触发:{h.trigger_condition}）" for h in persona.hidden_info)

    # 情绪极简标签化
    emotion_tags = []
    if emotion.trust < 25: emotion_tags.append("极度不信任")
    elif emotion.trust < 45: emotion_tags.append("有戒心")
    elif emotion.trust < 70: emotion_tags.append("基本信任")
    else: emotion_tags.append("比较信任")

    if emotion.intent < 25: emotion_tags.append("随便看看")
    elif emotion.intent < 50: emotion_tags.append("犹豫中")
    elif emotion.intent < 75: emotion_tags.append("认真考虑")
    else: emotion_tags.append("接近决策")

    if emotion.rapport < 30: emotion_tags.append("关系生疏")
    elif emotion.rapport < 60: emotion_tags.append("正常交流")
    else: emotion_tags.append("聊得不错")

    if emotion.resistance > 70: emotion_tags.append("强烈抵触")
    elif emotion.resistance > 45: emotion_tags.append("有一定抵触")

    if emotion.anxiety > 70: emotion_tags.append("焦虑感强")
    elif emotion.anxiety > 40: emotion_tags.append("有些焦虑")

    emotion_desc = f"当前状态：{', '.join(emotion_tags)}"

    tech_level = persona.behavior.tech_literacy
    tech_labels = ["完全不懂", "几乎不了解", "基本了解", "有一定了解", "比较了解"]
    tech_idx = min(int(tech_level / 0.2), 4)

    return f"""你是{persona.profile.name}，{persona.profile.age}岁{'男' if persona.profile.gender == 'M' else '女'}，{persona.profile.city}人，{persona.profile.occupation}。{persona.profile.family}。现有车：{persona.profile.current_car}。

【说话方式】{persona.communication.style}。{persona.communication.description}
【口头禅】{patterns_text}
【技术认知】{tech_labels[tech_idx]}（{tech_level:.0%}）
【{emotion_desc}】

【购车背景】意向车型:{persona.purchase.car_type}；对外预算:{persona.purchase.budget_stated}；真实预算:{persona.purchase.budget_real}（绝不主动说）；阶段:{persona.purchase.stage}；时间:{persona.purchase.timeline}；场景:{', '.join(persona.purchase.usage_scenarios)}

【痛点】{pains}
【隐藏信息】{hidden}
【常见异议】{objections}
【竞品】{persona.competitor_awareness}

【纪律】真实预算绝不主动暴露；回复体现当前状态；情绪影响态度。"""


def build_compact_scene_prompt(mode="training"):
    """精简版场景层"""
    if mode == "research":
        return """【场景】用户调研访谈。更开放、愿意分享，隐藏信息仍需触发才说。回答详细深入。"""
    return """【场景】4S店看车，对面是销售。保持警惕，不暴露真实预算。试探销售专业度。push太紧会抵触。

【纪律】1.你是真实用户，不说AI套话。2.回复简短口语化，1-3句。3.自然融入口头禅。4.不主动问专业技术问题。5.不过度配合，会犹豫反问。6.不暴露隐藏信息。7.信任低更简短，焦虑高更犹豫。8.节奏控制：不回答所有问题。9.预算纪律：先报对外预算。"""


def build_compact_system_prompt(persona, emotion, mode="training"):
    return f"{build_compact_persona_prompt(persona, emotion)}\n\n{build_compact_scene_prompt(mode)}"


def build_minimal_persona_prompt(persona, emotion):
    """极简版：只保留核心人设 + 3条纪律"""
    patterns = persona.communication.speech_patterns[:2]
    patterns_text = ' '.join(f'「{sp}」' for sp in patterns)

    emotion_tags = []
    if emotion.trust < 45: emotion_tags.append("警惕")
    else: emotion_tags.append("信任")
    if emotion.intent < 50: emotion_tags.append("犹豫")
    else: emotion_tags.append("积极")
    if emotion.anxiety > 40: emotion_tags.append("焦虑")

    emotion_desc = ', '.join(emotion_tags) if emotion_tags else "正常"

    return f"""你叫{persona.profile.name}，{persona.profile.age}岁，{persona.profile.city}人，{persona.profile.occupation}。
口头禅：{patterns_text}。
预算：对外说{persona.purchase.budget_stated}，心里真实{persona.purchase.budget_real}（绝不主动说）。
状态：{emotion_desc}。
痛点：{persona.pain_points[0].topic if persona.pain_points else '无'}。"""


def build_minimal_scene_prompt(mode="training"):
    return "你是真实购车用户，不是AI。回复简短口语化，1-3句话。不过度配合，会犹豫反问。"


def build_minimal_system_prompt(persona, emotion, mode="training"):
    return f"{build_minimal_persona_prompt(persona, emotion)} {build_minimal_scene_prompt(mode)}"


async def call_api(system_prompt: str, history: list, user_msg: str) -> str:
    """调用一次 API"""
    messages = [{"role": "system", "content": system_prompt}]
    for h in history:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_msg})

    payload = {
        "model": MINIMAX_MODEL,
        "messages": messages,
        "temperature": 0.6,
        "max_tokens": 512,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            MINIMAX_API_URL,
            headers={"Authorization": f"Bearer {MINIMAX_API_KEY}", "Content-Type": "application/json"},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


async def run_experiment():
    persona = get_persona("typical_01_young_single")
    emotion = EmotionState()

    # 固定测试对话
    test_script = [
        "您好，请问今天是来看车的吗？",
        "有的，您预算大概多少？",
        "这款车限时优惠，今天订送终身质保，错过就没了。",
        "那您看分期怎么样？首付三成。",
        "您朋友最近有买车的吗？",
    ]

    versions = {
        "完整版": build_full(persona, emotion, "training"),
        "精简版": build_compact_system_prompt(persona, emotion, "training"),
        "极简版": build_minimal_system_prompt(persona, emotion, "training"),
    }

    print("=" * 60)
    print("Prompt A/B 实验")
    print("=" * 60)

    for name, prompt in versions.items():
        print(f"\n【{name}】预估 token: {est_tokens(prompt)}")
        # 只打印前200字符
        preview = prompt.replace('\n', ' ')[:200]
        print(f"Preview: {preview}...")

    print("\n" + "=" * 60)
    print("开始对话测试（每版本跑一轮）")
    print("=" * 60)

    results = {}
    for name, prompt in versions.items():
        print(f"\n--- {name} ---")
        history = []
        replies = []
        for i, user_msg in enumerate(test_script, 1):
            reply = await call_api(prompt, history, user_msg)
            history.append({"role": "user", "content": user_msg})
            history.append({"role": "assistant", "content": reply})
            replies.append(reply)
            print(f"  R{i} [销售]: {user_msg}")
            print(f"  R{i} [分身]: {reply}")
            print()
            time.sleep(0.5)
        results[name] = replies

    # 保存结果
    output = {
        "versions": {k: {"token_est": est_tokens(v), "prompt_preview": v[:500]} for k, v in versions.items()},
        "conversations": results,
    }
    out_path = "/Users/samhar/text/.claude/worktrees/bold-chandrasekhar-ae472b/cap-platform/backend/scripts/prompt_experiment_result.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n结果已保存: {out_path}")


if __name__ == "__main__":
    asyncio.run(run_experiment())
