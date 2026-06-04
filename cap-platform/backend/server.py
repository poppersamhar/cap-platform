"""CAP FastAPI 后端主服务"""

import asyncio
import io
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

from personas.real_personas import ALL_PERSONAS, get_persona, update_persona
from personas.schema import Persona
from engine.emotion_state import EmotionState
from agents import avatar_agent, supervisor_agent, analyst_agent, extractor_agent, sales_agent
from knowledge import ingest, store as knowledge_store, retriever

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cap.server")

# ── 内存会话存储（POC 阶段） ──
_sessions: dict[str, dict] = {}


def _clean_text(text: str) -> str:
    """清理文本中的非法控制字符，保留换行和制表符"""
    return ''.join(ch for ch in text if ord(ch) >= 32 or ch in '\n\r\t')


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


class ChatRequest(BaseModel):
    session_id: str
    message: str


class CreatePersonaRequest(BaseModel):
    persona: dict


class ExtractRequest(BaseModel):
    dialogue: str


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
            {
                "id": p.id,
                "profile": p.profile.model_dump(),
                "purchase": p.purchase.model_dump(),
                "pain_points": [pp.model_dump() for pp in p.pain_points],
                "hidden_info": [hi.model_dump() for hi in p.hidden_info],
                "objections": [obj.model_dump() for obj in p.objections],
                "behavior": p.behavior.model_dump(),
                "communication": p.communication.model_dump(),
                "competitor_awareness": p.competitor_awareness,
                "tags": p.tags,
            }
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
    try:
        result = await avatar_agent.chat(
            persona=persona,
            emotion=emotion,
            history=history,
            user_message=req.message,
            mode=session["mode"],
            knowledge_context=knowledge_context,
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


# ── 启动 ──
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8787, reload=True)
