"""CAP FastAPI 后端主服务"""

import asyncio
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

# 加载环境变量
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from personas.test_personas import ALL_PERSONAS, get_persona
from personas.schema import Persona
from engine.emotion_state import EmotionState
from agents import avatar_agent, supervisor_agent, analyst_agent

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cap.server")

# ── 内存会话存储（POC 阶段） ──
_sessions: dict[str, dict] = {}


def _clean_text(text: str) -> str:
    """清理文本中的非法控制字符，保留换行和制表符"""
    return ''.join(ch for ch in text if ord(ch) >= 32 or ch in '\n\r\t')


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CAP backend starting...")
    yield
    logger.info("CAP backend shutting down...")


app = FastAPI(title="CAP Platform", version="0.1.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 请求/响应模型 ──
class CreateSessionRequest(BaseModel):
    persona_id: str
    mode: str  # "training" | "research"


class ChatRequest(BaseModel):
    session_id: str
    message: str


class CreatePersonaRequest(BaseModel):
    persona: dict


# ── 健康检查 ──
@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


# ── 分身列表 ──
@app.get("/api/personas")
async def list_personas():
    """返回所有可用分身（嵌套结构，与前端类型匹配）"""
    return {
        "personas": [
            {
                "id": p.id,
                "profile": {
                    "name": p.profile.name,
                    "age": p.profile.age,
                    "gender": p.profile.gender,
                    "city": p.profile.city,
                    "occupation": p.profile.occupation,
                    "family": p.profile.family,
                    "current_car": p.profile.current_car,
                },
                "purchase": {
                    "budget_stated": p.purchase.budget_stated,
                    "budget_real": p.purchase.budget_real,
                    "car_type": p.purchase.car_type,
                    "stage": p.purchase.stage,
                    "timeline": p.purchase.timeline,
                    "usage_scenarios": p.purchase.usage_scenarios,
                },
                "tags": p.tags,
            }
            for p in ALL_PERSONAS
        ]
    }


# ── 创建会话 ──
@app.post("/api/session/create")
async def create_session(req: CreateSessionRequest):
    """创建新会话"""
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
    logger.info(f"Session created: {session_id} persona={req.persona_id} mode={req.mode}")

    return {
        "session_id": session_id,
        "persona": {
            "id": persona.id,
            "name": persona.profile.name,
            "profile": persona.profile.model_dump(),
            "purchase": persona.purchase.model_dump(),
            "pain_points": [pp.model_dump() for pp in persona.pain_points],
            "hidden_info": [hi.model_dump() for hi in persona.hidden_info],
            "objections": [obj.model_dump() for obj in persona.objections],
            "behavior": persona.behavior.model_dump(),
            "communication": persona.communication.model_dump(),
            "tags": persona.tags,
        },
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

    # 调用分身 Agent
    emotion = session["emotion_state"]
    try:
        result = await avatar_agent.chat(
            persona=persona,
            emotion=emotion,
            history=history,
            user_message=req.message,
            mode=session["mode"],
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

    # 记录消息
    session["messages"].append({"role": "user", "content": req.message})
    session["messages"].append({
        "role": "assistant",
        "content": reply_clean,
        "triggered_tags": result.get("triggered_tags", []),
        "hidden_revealed": result.get("hidden_revealed", []),
    })

    # 异步触发督导评估（不等待）
    asyncio.create_task(_async_evaluate(session, persona))

    return {
        "reply": reply_clean,
        "emotion_state": emotion.to_dict(),
        "special_state": special,
        "triggered_tags": result.get("triggered_tags", []),
        "hidden_revealed": result.get("hidden_revealed", []),
        "round": round_num,
    }


async def _async_evaluate(session: dict, persona: Persona):
    """异步督导评估"""
    try:
        eval_result = await supervisor_agent.evaluate(
            persona=persona,
            history=session["messages"],
        )
        session["evaluation"] = {
            **eval_result,
            "updated_at": time.time(),
        }
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
        )
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


# ── 结束会话 ──
@app.post("/api/session/{session_id}/end")
async def end_session(session_id: str):
    """结束会话"""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session["status"] = "ended"
    return {"status": "ended"}


# ── 启动 ──
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8787, reload=True)
