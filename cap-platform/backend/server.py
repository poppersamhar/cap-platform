"""CAP FastAPI 后端主服务"""

import asyncio
import io
import json
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File, Query

# 加载环境变量
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from personas.real_personas import (
    ALL_PERSONAS, get_persona, update_persona, add_factory_personas,
    update_factory_persona, delete_factory_persona, get_factory_personas,
)
from personas.group_config import load_group_names, update_group_name, delete_group_name
from personas.schema import Persona
from engine.emotion_state import EmotionState
from agents import avatar_agent, supervisor_agent, analyst_agent, extractor_agent, sales_agent, survey_agent
from knowledge import ingest, store as knowledge_store, retriever
from factory import pipeline as factory_pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cap.server")

# 数据目录
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
SOURCE_DIALOGUES_DIR = os.path.join(DATA_DIR, "source_dialogues")
logger = logging.getLogger("cap.server")

# ── 内存会话存储（POC 阶段） ──
_sessions: dict[str, dict] = {}

# ── 内存问卷任务存储（POC 阶段） ──
# survey_id -> { id, template, persona_ids, status, progress, reports, created_at }
_survey_tasks: dict[str, dict] = {}


def _clean_text(text: str) -> str:
    """清理文本中的非法控制字符，保留换行和制表符"""
    return ''.join(ch for ch in text if ord(ch) >= 32 or ch in '\n\r\t')


def _load_source_quotes_for_persona(persona_id: str) -> list[dict]:
    """从原始对话文件中提取口头禅级别的短句，用于 avatar agent 的风格参考

    关键原则：只提取极短片段（2-12字），这些片段只包含语气/口头禅/用词偏好，
    不可能包含完整的语义内容。这样 avatar 只会模仿说话风格，不会复述历史对话内容。

    返回: [{"text": "口头禅短句", "type": "outbound_call|test_drive", "context": "..."}, ...]
    """
    dialogue_path = os.path.join(SOURCE_DIALOGUES_DIR, f"{persona_id}.json")
    if not os.path.exists(dialogue_path):
        return []

    import json
    import re

    try:
        with open(dialogue_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return []

    # 有实质内容的表达习惯词库（不是纯语气词，而是有语义的习惯性表达）
    SUBSTANTIVE_MARKERS = {
        "给家里", "给媳妇", "媳妇", "老婆", "孩子", "家里用", "家用",
        "十万", "十几万", "预算", "价钱", "价格", "优惠", "便宜", "贵",
        "续航", "电池", "充电", "纯电", "混动", "油车",
        "空间", "后排", "后备箱", "座椅", "内饰", "外观",
        "试驾", "看看", "了解一下", "对比", "比较",
        "安全", "保险", "保养", "售后", "质保", "维修",
        "接送", "通勤", "上下班", "代步", "家用",
        "目前", "现在", "之前", "开过", "有辆", "换车",
        "考虑", "想", "打算", "计划", "准备",
    }

    # 纯语气词，需要过滤掉
    FILLER_WORDS = {"嗯", "啊", "哦", "呢", "吧", "嘛", "呗", "哈", "唉", "哎", "哟", "呵"}

    quotes = []
    seen = set()

    for dia in data.get("dialogues", []):
        transcript = dia.get("transcript", "")
        dia_type = dia.get("type", "unknown")

        for line in transcript.split("\n"):
            if not line.strip().startswith("[客户]"):
                continue
            text = line.replace("[客户]", "").strip()

            # 按常见停顿符切分为短句
            for sentence in re.split(r'[。！？；,，]', text):
                sentence = sentence.strip()
                # 保留 4-20 字的片段——太短没信息量，太长可能是完整句子
                if not (4 <= len(sentence) <= 20):
                    continue
                if sentence in seen:
                    continue

                # 过滤掉纯语气词组成的句子（如"嗯嗯"、"啊啊"、"哦哦"）
                # 计算句子中纯语气词字符占比
                filler_chars = sum(1 for c in sentence if c in FILLER_WORDS)
                if filler_chars / len(sentence) > 0.5:
                    continue

                # 保留条件：包含有实质内容的词汇，或属于典型的购车表达
                has_substance = any(marker in sentence for marker in SUBSTANTIVE_MARKERS)
                # 或者是具体数字/名词短语（如"530续航"、"360影像"）
                has_entities = bool(re.search(r'\d+', sentence) and len(sentence) >= 5)

                if not (has_substance or has_entities):
                    continue

                seen.add(sentence)
                quotes.append({
                    "text": sentence,
                    "type": dia_type,
                    "context": text[:120],
                })

    # 按长度排序（适中长度优先），最多8条
    quotes.sort(key=lambda q: (abs(len(q["text"]) - 10), q["text"]))
    return quotes[:8]


def _parse_excel_to_text(file_bytes: bytes, filename: str) -> str:
    """将 Excel 文件解析为文本格式，供 Extractor Agent 使用"""
    import pandas as pd

    try:
        xls = pd.ExcelFile(io.BytesIO(file_bytes))
    except Exception as e:
        raise ValueError(f"无法解析 Excel 文件: {e}")

    parts = []

    for sheet_name in xls.sheet_names:
        df = pd.read_excel(xls, sheet_name=sheet_name)
        if df.empty:
            continue

        # 清理列名：去除空格、转为小写用于匹配
        df.columns = [str(c).strip() for c in df.columns]

        # 判断 sheet 类型
        # 如果列名包含"销售""客户""话术""回复"等，认为是对话记录表
        col_text = ' '.join(df.columns).lower()
        is_dialogue = any(k in col_text for k in ['销售', '客户', '话术', '回复', '发言', '对话', 'content', 'message'])
        is_basic = any(k in col_text for k in ['姓名', '年龄', '性别', '城市', '电话', '基础', 'profile', '客户信息'])

        if is_dialogue:
            parts.append(f"=== 销售对话记录（工作表：{sheet_name}） ===")
            # 尝试找到销售和客户列
            sales_col = None
            client_col = None
            for c in df.columns:
                cl = c.lower()
                if any(k in cl for k in ['销售', '顾问', 'sale', 'sales']):
                    sales_col = c
                elif any(k in cl for k in ['客户', '用户', 'customer', 'client', '回复', '话术']):
                    client_col = c

            if sales_col and client_col:
                for _, row in df.iterrows():
                    s = str(row.get(sales_col, '')).strip()
                    cl = str(row.get(client_col, '')).strip()
                    if s:
                        parts.append(f"销售：{s}")
                    if cl:
                        parts.append(f"客户：{cl}")
            else:
                # fallback：按行输出所有内容
                for _, row in df.iterrows():
                    for c in df.columns:
                        v = str(row.get(c, '')).strip()
                        if v and v.lower() != 'nan':
                            parts.append(f"{c}：{v}")

        elif is_basic:
            parts.append(f"=== 客户基础信息（工作表：{sheet_name}） ===")
            # 通常基础信息表一行就是一个客户
            for _, row in df.iterrows():
                for c in df.columns:
                    v = str(row.get(c, '')).strip()
                    if v and v.lower() != 'nan':
                        parts.append(f"{c}：{v}")

        else:
            # 通用处理
            parts.append(f"=== 其他数据（工作表：{sheet_name}） ===")
            for _, row in df.iterrows():
                for c in df.columns:
                    v = str(row.get(c, '')).strip()
                    if v and v.lower() != 'nan':
                        parts.append(f"{c}：{v}")

    result = '\n'.join(parts)
    if len(result) < 50:
        raise ValueError("Excel 文件内容太少，无法提取有效信息")

    return result


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CAP backend starting...")
    yield
    logger.info("CAP backend shutting down...")


app = FastAPI(title="CAP Platform", version="0.1.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 请求/响应模型 ──
class CreateSessionRequest(BaseModel):
    persona_id: str
    mode: str  # "training" | "research"
    persona_override: dict | None = None  # 可选：传入完整 persona 数据（用于临时导入）
    research_topic: str = ""  # 调研主题（仅调研模式）
    research_goals: str = ""  # 调研目标（仅调研模式）


class ChatRequest(BaseModel):
    session_id: str
    message: str


class CreatePersonaRequest(BaseModel):
    persona: dict


class ExtractRequest(BaseModel):
    dialogue: str


class GroupNameUpdate(BaseModel):
    name: str


class SurveyRunRequest(BaseModel):
    template_id: str
    persona_ids: list[str]


# ── 健康检查 ──
@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


# ── 分身列表 ──
@app.get("/api/personas")
async def list_personas():
    """返回所有可用分身（完整结构，与前端 Persona 类型匹配）"""
    return {
        "personas": [
            p.model_dump(mode="json", by_alias=True)
            for p in ALL_PERSONAS
        ]
    }


# ── 更新典型分身 ──
@app.put("/api/persona/{persona_id}")
async def update_persona_endpoint(persona_id: str, req: CreatePersonaRequest):
    """更新典型分身（仅 typical_ 前缀支持编辑）"""
    try:
        updated = update_persona(persona_id, req.persona)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Update persona failed")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")

    return {
        "id": updated.id,
        "profile": updated.profile.model_dump(),
        "purchase": updated.purchase.model_dump(),
        "pain_points": [pp.model_dump() for pp in updated.pain_points],
        "hidden_info": [hi.model_dump() for hi in updated.hidden_info],
        "objections": [obj.model_dump() for obj in updated.objections],
        "behavior": updated.behavior.model_dump(),
        "communication": updated.communication.model_dump(),
        "tags": updated.tags,
    }


# ── 获取个体用户原始对话 ──
@app.get("/api/persona/{persona_id}/source-dialogues")
async def get_source_dialogues(persona_id: str):
    """获取个体用户的原始对话文档（外呼通话、试驾录音等）"""
    # 验证 persona 存在
    persona = get_persona(persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    # 仅个体用户支持溯源
    if not persona_id.startswith("indiv_"):
        raise HTTPException(status_code=400, detail="Only individual personas have source dialogues")

    dialogue_path = os.path.join(SOURCE_DIALOGUES_DIR, f"{persona_id}.json")
    if not os.path.exists(dialogue_path):
        raise HTTPException(status_code=404, detail="Source dialogues not found for this persona")

    import json
    with open(dialogue_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return {
        "persona_id": data.get("persona_id"),
        "source_customer_id": data.get("source_customer_id"),
        "dialogues": data.get("dialogues", []),
        "summaries": data.get("summaries", []),
        "record_count": data.get("record_count", 0),
    }


# ── 创建会话 ──
@app.post("/api/session/create")
async def create_session(req: CreateSessionRequest):
    """创建新会话"""
    persona = get_persona(req.persona_id)
    # 如果 persona 不存在于已加载列表，且传入了 persona_override，使用 override
    if not persona and req.persona_override:
        try:
            from personas.real_personas import _dict_to_persona
            persona = _dict_to_persona(req.persona_override)
            logger.info(f"Using custom persona override for session: {persona.id}")
        except Exception as e:
            logger.warning(f"Failed to parse persona_override: {e}")
            raise HTTPException(status_code=400, detail="Invalid persona_override format")

    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    session_id = str(uuid.uuid4())[:8]
    session = {
        "id": session_id,
        "persona_id": req.persona_id,
        "mode": req.mode,
        "messages": [],
        "emotion_state": EmotionState(),
        "special_state": None,
        "round": 0,
        "evaluation": None,
        "status": "active",
        "created_at": time.time(),
        "research_topic": req.research_topic,
        "research_goals": req.research_goals,
        "token_usage": [],
    }

    # 个体用户：加载原始对话引用
    if req.persona_id.startswith("indiv_"):
        source_quotes = _load_source_quotes_for_persona(req.persona_id)
        if source_quotes:
            session["source_quotes"] = source_quotes
            logger.info(f"Loaded {len(source_quotes)} source quotes for session {session_id} persona={req.persona_id}")
    _sessions[session_id] = session
    logger.info(f"Session created: {session_id} persona={req.persona_id} mode={req.mode}")

    return {
        "session_id": session_id,
        "persona": persona.model_dump(mode="json"),
        "emotion_state": session["emotion_state"].to_dict(),
    }


# ── 核心对话 ──
@app.post("/api/chat")
async def chat(req: ChatRequest):
    """发送消息，获取分身回复"""
    session = _sessions.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session already ended")

    # 轮次上限
    MAX_ROUNDS = 15 if session["mode"] == "training" else 20
    if session["round"] >= MAX_ROUNDS:
        session["status"] = "ended"
        return {
            "reply": "【对话已自动结束】已达到本轮对话上限，请查看报告。",
            "emotion_state": session["emotion_state"].to_dict(),
            "special_state": session.get("special_state"),
            "triggered_tags": [],
            "hidden_revealed": [],
            "round": session["round"],
        }

    persona = get_persona(session["persona_id"])
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    # 更新轮次
    session["round"] += 1
    round_num = session["round"]

    # 构建历史
    history = session["messages"].copy()

    # 检索培训知识库（训练模式下生效）+ 典型用户专属知识库
    knowledge_context = ""
    if session["mode"] == "training":
        try:
            kb_results = retriever.retrieve_for_avatar(
                history, req.message, top_k=3, persona_id=session["persona_id"]
            )
            if kb_results:
                knowledge_context = retriever.format_knowledge_prompt(kb_results)
                logger.info(f"Injected {len(kb_results)} knowledge chunks for session {req.session_id}")
        except Exception as e:
            logger.warning(f"Knowledge retrieval failed: {e}")

    # 调用分身 Agent
    emotion = session["emotion_state"]
    source_quotes = session.get("source_quotes")
    try:
        result = await avatar_agent.chat(
            persona=persona,
            emotion=emotion,
            history=history,
            user_message=req.message,
            mode=session["mode"],
            knowledge_context=knowledge_context,
            source_quotes=source_quotes,
        )
    except Exception as e:
        logger.exception("Avatar agent error")
        raise HTTPException(status_code=500, detail=f"Avatar agent error: {str(e)}")

    # 清理回复中的非法字符
    reply_clean = _clean_text(result["reply"])

    # 更新情绪状态
    emotion.update(result.get("emotion_delta", {}))
    session["emotion_state"] = emotion
    special = emotion.check_triggers()
    session["special_state"] = special

    # 记录 token 使用
    usage = result.get("usage", {})
    if usage and any(usage.values()):
        session.setdefault("token_usage", []).append({
            "round": round_num,
            "agent": "avatar",
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
        })

    # 记录消息
    matched_quotes = result.get("source_quotes", [])
    session["messages"].append({"role": "user", "content": req.message})
    session["messages"].append({
        "role": "assistant",
        "content": reply_clean,
        "triggered_tags": result.get("triggered_tags", []),
        "hidden_revealed": result.get("hidden_revealed", []),
        "source_quotes": matched_quotes,
    })

    # 异步触发督导评估（仅对练模式）
    if session.get("mode") == "training":
        asyncio.create_task(_async_evaluate(session, persona))

    return {
        "reply": reply_clean,
        "emotion_state": emotion.to_dict(),
        "special_state": special,
        "triggered_tags": result.get("triggered_tags", []),
        "hidden_revealed": result.get("hidden_revealed", []),
        "source_quotes": matched_quotes,
        "round": round_num,
    }


# ── 自动评测：Sales Agent vs Avatar Agent ──
class EvalRunRequest(BaseModel):
    persona_id: str
    mode: str = "training"
    max_rounds: int = 8
    opening_message: str = "您好，欢迎到店看车！今天主要想了解哪款车型？"


@app.post("/api/eval/run")
async def run_eval(req: EvalRunRequest):
    """自动运行销售Agent与Avatar Agent的完整对话，返回对话记录"""
    persona = get_persona(req.persona_id)
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    session_id = str(uuid.uuid4())[:8]
    session = {
        "id": session_id,
        "persona_id": req.persona_id,
        "mode": req.mode,
        "messages": [],
        "emotion_state": EmotionState(),
        "special_state": None,
        "round": 0,
        "evaluation": None,
        "status": "active",
        "created_at": time.time(),
    }
    _sessions[session_id] = session

    transcript = []
    emotion = session["emotion_state"]

    # 开场白
    sales_msg = req.opening_message
    transcript.append({"role": "sales", "round": 0, "content": sales_msg})

    for round_num in range(1, req.max_rounds + 1):
        session["round"] = round_num

        # Avatar 回复 Sales
        avatar_history = session["messages"].copy()
        try:
            avatar_result = await avatar_agent.chat(
                persona=persona,
                emotion=emotion,
                history=avatar_history,
                user_message=sales_msg,
                mode=req.mode,
            )
        except Exception as e:
            logger.exception("Avatar agent error in eval")
            raise HTTPException(status_code=500, detail=f"Avatar error: {str(e)}")

        avatar_reply = _clean_text(avatar_result["reply"])
        emotion.update(avatar_result.get("emotion_delta", {}))
        session["emotion_state"] = emotion

        # 记录到会话
        session["messages"].append({"role": "user", "content": sales_msg})
        session["messages"].append({
            "role": "assistant",
            "content": avatar_reply,
            "triggered_tags": avatar_result.get("triggered_tags", []),
            "hidden_revealed": avatar_result.get("hidden_revealed", []),
        })

        transcript.append({
            "role": "avatar",
            "round": round_num,
            "content": avatar_reply,
            "emotion": emotion.to_dict(),
            "triggered_tags": avatar_result.get("triggered_tags", []),
            "hidden_revealed": avatar_result.get("hidden_revealed", []),
        })

        # Sales 回复 Avatar
        sales_history = session["messages"].copy()
        try:
            sales_reply = await sales_agent.generate_sales_message(sales_history)
        except Exception as e:
            logger.exception("Sales agent error in eval")
            raise HTTPException(status_code=500, detail=f"Sales error: {str(e)}")

        sales_msg = _clean_text(sales_reply)
        transcript.append({"role": "sales", "round": round_num, "content": sales_msg})

        logger.info(f"Eval round {round_num}: sales='{sales_msg[:40]}...' avatar='{avatar_reply[:40]}...'")

    # 触发督导评估
    asyncio.create_task(_async_evaluate(session, persona))

    return {
        "session_id": session_id,
        "persona_id": req.persona_id,
        "persona_name": persona.profile.name,
        "mode": req.mode,
        "rounds": req.max_rounds,
        "transcript": transcript,
        "emotion_final": emotion.to_dict(),
    }


async def _async_evaluate(session: dict, persona: Persona):
    """异步督导评估"""
    try:
        eval_result = await supervisor_agent.evaluate(
            persona=persona,
            history=session["messages"],
            mode=session.get("mode", "training"),
        )
        usage = eval_result.pop("_usage", {})
        session["evaluation"] = {
            **eval_result,
            "updated_at": time.time(),
        }
        if usage and any(usage.values()):
            session.setdefault("token_usage", []).append({
                "round": session.get("round", 0),
                "agent": "supervisor",
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            })
        logger.info(f"Evaluation updated for session {session['id']}")
    except Exception as e:
        logger.warning(f"Supervisor evaluation failed: {e}")


# ── 获取评分 ──
@app.get("/api/session/{session_id}/evaluation")
async def get_evaluation(session_id: str):
    """获取督导评分"""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    evaluation = session.get("evaluation")
    if not evaluation:
        return {"status": "pending", "evaluation": None}

    return {"status": "ready", "evaluation": evaluation}


# ── 生成报告 ──
@app.post("/api/session/{session_id}/report")
async def generate_report(session_id: str):
    """生成最终报告"""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    persona = get_persona(session["persona_id"])
    try:
        report = await analyst_agent.generate_report(
            mode=session["mode"],
            history=session["messages"],
            evaluation=session.get("evaluation"),
            persona=persona.model_dump() if persona else None,
            research_topic=session.get("research_topic", ""),
            research_goals=session.get("research_goals", ""),
        )
        usage = report.pop("_usage", {})
        if usage and any(usage.values()):
            session.setdefault("token_usage", []).append({
                "round": session.get("round", 0),
                "agent": "analyst",
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            })
    except Exception as e:
        logger.warning(f"Analyst agent failed: {e}, using fallback")
        report = {
            "type": session["mode"],
            "rounds": session["round"],
            "duration_seconds": time.time() - session["created_at"],
            "evaluation": session.get("evaluation"),
        }

    session["report"] = report
    session["status"] = "ended"

    return {"report": report}


# ── 获取报告 ──
@app.get("/api/session/{session_id}/report")
async def get_report(session_id: str):
    """获取已生成的报告"""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    report = session.get("report")
    if not report:
        return {"status": "pending", "report": None}

    return {"status": "ready", "report": report}


# ── 追问建议（仅调研模式）──
@app.post("/api/session/{session_id}/suggestions")
async def get_follow_up_suggestions(session_id: str):
    """基于最近对话生成追问建议"""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.get("mode") != "research":
        return {"suggestions": []}

    messages = session.get("messages", [])
    if len(messages) < 2:
        return {"suggestions": []}

    # 取最近 3 轮对话（6 条消息）
    recent = messages[-6:]
    dialog = "\n".join(
        f"{'研究员' if m['role'] == 'user' else '受访者'}：{m['content']}"
        for m in recent
    )

    prompt = f"""你是一位资深汽车行业用户研究专家。基于以下购车用户访谈对话的最新进展，为研究员生成 2-3 条高质量的追问建议。

【核心纪律】
1. 所有建议问题必须与"汽车、购车、用车、选车决策"直接相关
2. 严禁追问公交、地铁、电动车、自行车、步行等与汽车无关的出行方式
3. 如果受访者提到了非汽车出行方式，应追问"这是否影响了他对汽车的需求/选择"
4. 建议必须是具体的问题，不是泛泛的"继续深入"
5. 问题要能帮助挖掘受访者没说出口的真实想法
6. 避免引导性提问，保持开放和中立
7. 问题要简短自然，像日常聊天

【追问方向参考】
- 用车场景的具体细节（如通勤距离、路况、停车条件）
- 对现有车辆的不满或满意之处
- 换车/购车的真实触发因素
- 对具体配置/功能的偏好及原因
- 预算弹性及决策影响因素
- 竞品对比的真实考虑

对话记录：
{dialog}

请输出 JSON 格式：
{{"suggestions": ["建议1", "建议2", "建议3"]}}

只输出 JSON，不要其他文字。"""

    import os
    import httpx
    import json

    api_key = os.getenv("MINIMAX_API_KEY", "")
    api_url = os.getenv("MINIMAX_API_URL", "https://api.minimax.chat/v1/text/chatcompletion_v2")
    model = os.getenv("MINIMAX_MODEL", "MiniMax-Text-01")

    if not api_key:
        return {"suggestions": []}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                api_url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": prompt},
                        {"role": "user", "content": "生成追问建议"},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 256,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()

            # 解析 JSON
            if content.startswith("```"):
                lines = content.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                content = "\n".join(lines).strip()

            parsed = json.loads(content)
            suggestions = parsed.get("suggestions", [])

            # 过滤与汽车无关的建议
            _off_topic_keywords = ("公交", "地铁", "电动车", "电瓶车", "自行车", "步行", "走路")
            filtered = [
                s for s in suggestions
                if not any(kw in s for kw in _off_topic_keywords)
            ]
            return {"suggestions": filtered[:3]}
    except Exception as e:
        logger.warning(f"Suggestions generation failed: {e}")
        return {"suggestions": []}


# ── 从对话提取分身（保留，兼容纯文本） ──
@app.post("/api/extract")
async def extract_from_dialogue(req: ExtractRequest):
    """从销售-客户对话文本提取 Persona JSON"""
    if not req.dialogue or len(req.dialogue.strip()) < 50:
        raise HTTPException(status_code=400, detail="对话文本太短，至少需要50个字符")

    try:
        persona_data = await extractor_agent.extract_persona(req.dialogue)
    except Exception as e:
        logger.exception("Extractor agent error")
        raise HTTPException(status_code=500, detail=f"提取失败: {str(e)}")

    return {"persona": persona_data}


# ── 从 Excel 提取分身 ──
@app.post("/api/extract/excel")
async def extract_from_excel(file: UploadFile = File(...)):
    """从 Excel 文件提取 Persona JSON"""
    if not file.filename or not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="请上传 .xlsx 或 .xls 格式的 Excel 文件")

    try:
        contents = await file.read()
        data_text = _parse_excel_to_text(contents, file.filename)
        logger.info(f"Excel parsed: {len(data_text)} chars from {file.filename}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Excel parse error")
        raise HTTPException(status_code=500, detail=f"Excel 解析失败: {str(e)}")

    try:
        persona_data = await extractor_agent.extract_persona(data_text)
    except Exception as e:
        logger.exception("Extractor agent error")
        raise HTTPException(status_code=500, detail=f"提取失败: {str(e)}")

    return {"persona": persona_data}


# ── 结束会话 ──
@app.post("/api/session/{session_id}/end")
async def end_session(session_id: str):
    """结束会话"""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session["status"] = "ended"
    return {"status": "ended"}


# ── 知识库管理 ──
@app.post("/api/knowledge/upload")
async def upload_knowledge(
    file: UploadFile = File(...),
    persona_id: str | None = Query(None, description="指定典型用户ID，文档将入库到该用户的专属知识库"),
):
    """上传培训文档（PDF/DOCX/PPTX/TXT/MD），入库到向量知识库

    如果传入 persona_id（且为 typical_ 前缀），文档会存入该 persona 的专属 collection。
    """
    allowed = ('.pdf', '.docx', '.pptx', '.txt', '.md')
    if not file.filename or not file.filename.lower().endswith(allowed):
        raise HTTPException(status_code=400, detail=f"不支持的文件格式，请上传 {allowed}")

    collection_name = "training_docs"
    if persona_id:
        if not persona_id.startswith("typical_"):
            raise HTTPException(status_code=400, detail="只有典型用户(typical_)支持专属知识库")
        collection_name = f"persona_{persona_id}_docs"

    try:
        contents = await file.read()
        result = ingest.ingest_document(contents, filename=file.filename, collection_name=collection_name)
    except Exception as e:
        logger.exception("Knowledge ingest error")
        raise HTTPException(status_code=500, detail=f"文档入库失败: {str(e)}")

    if result["status"] == "too_short_or_empty":
        raise HTTPException(status_code=400, detail="文档内容太短或无法提取文本")

    return result


@app.get("/api/knowledge/sources")
async def list_knowledge_sources():
    """列出已入库的所有全局文档来源"""
    try:
        sources = knowledge_store.list_sources()
    except Exception as e:
        logger.warning(f"List sources failed: {e}")
        raise HTTPException(status_code=500, detail="获取知识库列表失败")
    return {"sources": sources}


@app.delete("/api/knowledge/source/{source_name:path}")
async def delete_knowledge_source(source_name: str):
    """删除某个全局来源的所有文档片段"""
    try:
        deleted = knowledge_store.delete_source(source_name)
    except Exception as e:
        logger.warning(f"Delete source failed: {e}")
        raise HTTPException(status_code=500, detail="删除失败")
    return {"deleted_chunks": deleted}


# ── 典型用户专属知识库 ──
@app.get("/api/persona/{persona_id}/knowledge/sources")
async def list_persona_knowledge_sources(persona_id: str):
    """列出某典型用户的专属文档来源"""
    if not persona_id.startswith("typical_"):
        raise HTTPException(status_code=400, detail="只有典型用户(typical_)支持专属知识库")

    collection_name = f"persona_{persona_id}_docs"
    try:
        sources = knowledge_store.list_sources(collection_name)
    except Exception as e:
        logger.warning(f"List persona sources failed: {e}")
        raise HTTPException(status_code=500, detail="获取专属知识库列表失败")
    return {"sources": sources}


@app.delete("/api/persona/{persona_id}/knowledge/source/{source_name:path}")
async def delete_persona_knowledge_source(persona_id: str, source_name: str):
    """删除某典型用户专属知识库中的某个来源"""
    if not persona_id.startswith("typical_"):
        raise HTTPException(status_code=400, detail="只有典型用户(typical_)支持专属知识库")

    collection_name = f"persona_{persona_id}_docs"
    try:
        deleted = knowledge_store.delete_source(source_name, collection_name)
    except Exception as e:
        logger.warning(f"Delete persona source failed: {e}")
        raise HTTPException(status_code=500, detail="删除失败")
    return {"deleted_chunks": deleted}


# ── Token 使用查询 ──
@app.get("/api/session/{session_id}/token-usage")
async def get_token_usage(session_id: str):
    """获取会话的 token 使用量明细"""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    usage = session.get("token_usage", [])
    total_prompt = sum(u.get("prompt_tokens", 0) for u in usage)
    total_completion = sum(u.get("completion_tokens", 0) for u in usage)
    total = sum(u.get("total_tokens", 0) for u in usage)

    by_agent = {}
    for u in usage:
        agent = u.get("agent", "unknown")
        by_agent.setdefault(agent, {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})
        by_agent[agent]["prompt_tokens"] += u.get("prompt_tokens", 0)
        by_agent[agent]["completion_tokens"] += u.get("completion_tokens", 0)
        by_agent[agent]["total_tokens"] += u.get("total_tokens", 0)

    return {
        "session_id": session_id,
        "mode": session.get("mode"),
        "rounds": session.get("round"),
        "total_prompt_tokens": total_prompt,
        "total_completion_tokens": total_completion,
        "total_tokens": total,
        "by_agent": by_agent,
        "detail": usage,
    }


# ── 分身工厂 ──
@app.post("/api/factory/generate")
async def factory_generate(file: UploadFile = File(...)):
    """上传真实用户 Excel，自动聚类并生成典型分身"""
    if not file.filename or not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="请上传 .xlsx 或 .xls 格式的 Excel 文件")

    try:
        contents = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"读取文件失败: {str(e)}")

    try:
        personas = await factory_pipeline.run_pipeline(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Factory pipeline error")
        raise HTTPException(status_code=500, detail=f"分身生成失败: {str(e)}")

    return {
        "count": len(personas),
        "personas": personas,
    }


class SaveFactoryRequest(BaseModel):
    personas: list[dict]


@app.post("/api/factory/save")
async def factory_save(req: SaveFactoryRequest):
    """将工厂生成的分身保存到系统（追加模式，自动处理 ID 冲突）"""
    if not req.personas:
        raise HTTPException(status_code=400, detail="personas 列表为空")

    try:
        added = add_factory_personas(req.personas)
    except Exception as e:
        logger.exception("保存工厂分身失败")
        raise HTTPException(status_code=500, detail=f"保存失败: {str(e)}")

    return {
        "saved_count": len(added),
        "personas": [
            {
                "id": p.id,
                "name": p.profile.name,
                "_cluster_title": getattr(p, "_cluster_title", ""),
            }
            for p in added
        ],
    }


# ── 工厂分身 CRUD ──

@app.get("/api/factory/personas")
async def list_factory_personas():
    """列出所有工厂分身"""
    personas = get_factory_personas()
    return {
        "count": len(personas),
        "personas": [
            {
                "id": p.id,
                "name": p.profile.name,
                "profile": p.profile.model_dump(),
                "purchase": p.purchase.model_dump(),
                "pain_points": [pp.model_dump() for pp in p.pain_points],
                "hidden_info": [hi.model_dump() for hi in p.hidden_info],
                "objections": [obj.model_dump() for obj in p.objections],
                "behavior": p.behavior.model_dump(),
                "communication": p.communication.model_dump(),
                "tags": p.tags,
                "competitor_awareness": p.competitor_awareness,
                "_cluster_title": getattr(p, "_cluster_title", ""),
                "_cluster_stats": getattr(p, "_cluster_stats", {}),
                "_source": getattr(p, "_source", "factory"),
            }
            for p in personas
        ],
    }


@app.put("/api/factory/persona/{persona_id}")
async def factory_update_persona(persona_id: str, req: CreatePersonaRequest):
    """更新工厂分身（仅 _source == 'factory' 支持）"""
    try:
        updated = update_factory_persona(persona_id, req.persona)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Update factory persona failed")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")

    return {
        "id": updated.id,
        "profile": updated.profile.model_dump(),
        "purchase": updated.purchase.model_dump(),
        "pain_points": [pp.model_dump() for pp in updated.pain_points],
        "hidden_info": [hi.model_dump() for hi in updated.hidden_info],
        "objections": [obj.model_dump() for obj in updated.objections],
        "behavior": updated.behavior.model_dump(),
        "communication": updated.communication.model_dump(),
        "tags": updated.tags,
        "competitor_awareness": updated.competitor_awareness,
    }


@app.delete("/api/factory/persona/{persona_id}")
async def factory_delete_persona(persona_id: str):
    """删除工厂分身"""
    try:
        delete_factory_persona(persona_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Delete factory persona failed")
        raise HTTPException(status_code=500, detail=f"删除失败: {str(e)}")

    return {"deleted": True, "id": persona_id}


# ── 客群分组名称管理 ──

@app.get("/api/persona-groups")
async def list_persona_groups():
    """获取所有客群分组的显示名称

    按 persona 的 _source 字段分组（mg4 / 4x / factory），返回自定义名称。
    """
    names = load_group_names()
    return {"groups": names}


@app.put("/api/persona-groups/{source}")
async def update_persona_group_name(source: str, req: GroupNameUpdate):
    """更新某个客群分组的显示名称"""
    if not req.name or not req.name.strip():
        raise HTTPException(status_code=400, detail="名称不能为空")
    try:
        updated = update_group_name(source, req.name.strip())
    except Exception as e:
        logger.exception("Update group name failed")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")
    return {"source": source, "name": updated}


@app.delete("/api/persona-groups/{source}")
async def reset_persona_group_name(source: str):
    """重置某个客群分组的显示名称（回退到默认）"""
    try:
        delete_group_name(source)
    except Exception as e:
        logger.exception("Reset group name failed")
        raise HTTPException(status_code=500, detail=f"重置失败: {str(e)}")
    return {"source": source, "name": load_group_names().get(source, f"{source} 客群")}


# ── 问卷调研 ──

SURVEY_TEMPLATES_DIR = os.path.join(DATA_DIR, "survey_templates")


def _load_survey_templates() -> list[dict]:
    """加载所有问卷模板"""
    templates = []
    if not os.path.exists(SURVEY_TEMPLATES_DIR):
        return templates
    for filename in os.listdir(SURVEY_TEMPLATES_DIR):
        if not filename.endswith(".json"):
            continue
        filepath = os.path.join(SURVEY_TEMPLATES_DIR, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                templates.append(json.load(f))
        except Exception as e:
            logger.warning(f"Failed to load survey template {filename}: {e}")
    return templates


def _get_survey_template(template_id: str) -> dict | None:
    """获取指定问卷模板"""
    filepath = os.path.join(SURVEY_TEMPLATES_DIR, f"{template_id}.json")
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


@app.get("/api/survey/templates")
async def list_survey_templates():
    """列出所有问卷模板"""
    templates = _load_survey_templates()
    return {"templates": templates}


@app.post("/api/survey/run")
async def run_survey(req: SurveyRunRequest):
    """启动问卷调研任务

    为每个选中的 persona 独立执行问卷，后台异步运行。
    """
    template = _get_survey_template(req.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="问卷模板不存在")

    # 验证所有 persona 存在
    personas = []
    for pid in req.persona_ids:
        p = get_persona(pid)
        if not p:
            raise HTTPException(status_code=404, detail=f"Persona {pid} 不存在")
        personas.append(p)

    survey_id = str(uuid.uuid4())[:8]
    questions = template.get("questions", [])

    # 初始化任务状态
    progress = []
    for p in personas:
        progress.append({
            "persona_id": p.id,
            "persona_name": p.profile.name,
            "persona_gender": p.profile.gender,
            "status": "pending",
            "completed_questions": 0,
        })

    _survey_tasks[survey_id] = {
        "id": survey_id,
        "template": template,
        "persona_ids": req.persona_ids,
        "status": "running",
        "progress": progress,
        "reports": [],
        "created_at": time.time(),
    }

    logger.info(f"Survey started: {survey_id} with {len(personas)} personas, {len(questions)} questions")

    # 后台异步执行
    asyncio.create_task(_run_survey_async(survey_id, personas, questions))

    return {
        "survey_id": survey_id,
        "status": "running",
        "progress": progress,
    }


async def _run_survey_async(survey_id: str, personas: list[Persona], questions: list[dict]):
    """后台执行问卷任务"""
    task = _survey_tasks.get(survey_id)
    if not task:
        return

    reports = []

    for persona in personas:
        # 更新进度为 running
        for p in task["progress"]:
            if p["persona_id"] == persona.id:
                p["status"] = "running"
                p["completed_questions"] = 0
                break

        try:
            # 加载原始对话风格引用（个体用户）
            source_quotes = None
            if persona.id.startswith("indiv_"):
                source_quotes = _load_source_quotes_for_persona(persona.id)

            # 执行问卷
            result = await survey_agent.run_survey_for_persona(
                persona=persona,
                questions=questions,
                source_quotes=source_quotes,
            )

            reports.append(result)

            # 更新进度为 completed
            for p in task["progress"]:
                if p["persona_id"] == persona.id:
                    p["status"] = "completed"
                    p["completed_questions"] = len(questions)
                    break

            logger.info(f"Survey {survey_id}: persona {persona.profile.name} completed")

        except Exception as e:
            logger.exception(f"Survey {survey_id}: persona {persona.profile.name} failed")
            for p in task["progress"]:
                if p["persona_id"] == persona.id:
                    p["status"] = "failed"
                    break

    task["reports"] = reports
    task["status"] = "completed"
    logger.info(f"Survey {survey_id} completed with {len(reports)} reports")


@app.get("/api/survey/{survey_id}/progress")
async def get_survey_progress(survey_id: str):
    """获取问卷执行进度"""
    task = _survey_tasks.get(survey_id)
    if not task:
        raise HTTPException(status_code=404, detail="问卷任务不存在")

    return {
        "survey_id": survey_id,
        "status": task["status"],
        "progress": task["progress"],
    }


@app.get("/api/survey/{survey_id}/reports")
async def get_survey_reports(survey_id: str):
    """获取问卷所有报告"""
    task = _survey_tasks.get(survey_id)
    if not task:
        raise HTTPException(status_code=404, detail="问卷任务不存在")

    return {
        "survey_id": survey_id,
        "status": task["status"],
        "reports": task["reports"],
    }


@app.get("/api/survey/{survey_id}/report/{persona_id}")
async def get_survey_persona_report(survey_id: str, persona_id: str):
    """获取单个 persona 的问卷报告"""
    task = _survey_tasks.get(survey_id)
    if not task:
        raise HTTPException(status_code=404, detail="问卷任务不存在")

    for report in task["reports"]:
        if report["persona_id"] == persona_id:
            return {"report": report}

    raise HTTPException(status_code=404, detail="报告不存在")


# ── 启动 ──
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8787, reload=True)
