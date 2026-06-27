import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.core.auth import get_current_user
from app.db.supabase import get_supabase_admin
from app.schemas.chat import (
    CreateSessionRequest, SessionResponse,
    QueryRequest, MessageResponse
)
from pydantic import BaseModel
from app.services.rag import get_rag_response

router = APIRouter()


@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    body: CreateSessionRequest,
    user_id: str = Depends(get_current_user)
):
    """Creates a new chat session."""
    supabase = get_supabase_admin()

    result = supabase.table("chat_sessions").insert({
        "user_id": user_id,
        "title": body.title
    }).execute()

    return result.data[0]


@router.get("/sessions")
async def list_sessions(user_id: str = Depends(get_current_user)):
    """Lists all chat sessions for the user."""
    supabase = get_supabase_admin()

    result = supabase.table("chat_sessions")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("updated_at", desc=True)\
        .execute()

    return result.data


@router.get("/sessions/{session_id}/messages")
async def get_messages(
    session_id: str,
    user_id: str = Depends(get_current_user)
):
    """Loads chat history for a session."""
    supabase = get_supabase_admin()

    result = supabase.table("chat_messages")\
        .select("*")\
        .eq("session_id", session_id)\
        .eq("user_id", user_id)\
        .order("created_at")\
        .execute()

    return result.data


@router.post("/sessions/{session_id}/query")
async def query(
    session_id: str,
    body: QueryRequest,
    user_id: str = Depends(get_current_user)
):
    """
    Main RAG endpoint — streams answer tokens via SSE.
    """
    supabase = get_supabase_admin()

    # ── Verify session belongs to user ────────────────────────
    session = supabase.table("chat_sessions")\
        .select("id")\
        .eq("id", session_id)\
        .eq("user_id", user_id)\
        .single()\
        .execute()

    if not session.data:
        raise HTTPException(404, "Session not found")

    # ── Load chat history ─────────────────────────────────────
    history_result = supabase.table("chat_messages")\
        .select("role, content")\
        .eq("session_id", session_id)\
        .order("created_at")\
        .limit(10)\
        .execute()

    chat_history = history_result.data or []

    # ── Save human message ────────────────────────────────────
    supabase.table("chat_messages").insert({
        "session_id": session_id,
        "user_id": user_id,
        "role": "human",
        "content": body.question
    }).execute()

    # ── Stream response ───────────────────────────────────────
    async def stream():
        full_response = ""
        source_chunks = []

        try:
            async for token, chunks, accumulated in get_rag_response(
                question=body.question,
                user_id=user_id,
                chat_history=chat_history,
                document_ids=body.document_ids
            ):
                full_response = accumulated
                source_chunks = chunks

                # Send token to frontend
                yield f"data: {json.dumps({'token': token})}\n\n"

            # ── Save AI response to DB ────────────────────────
            supabase.table("chat_messages").insert({
                "session_id": session_id,
                "user_id": user_id,
                "role": "ai",
                "content": full_response,
                "source_chunks": [
                    {
                        "content": c["content"][:200],
                        "document_name": c["metadata"].get("document_name"),
                        "score": c["score"]
                    }
                    for c in source_chunks
                ]
            }).execute()

            # ── Update session updated_at ─────────────────────
            supabase.table("chat_sessions").update({
                "updated_at": "now()",
                "title": body.question[:50]
            }).eq("id", session_id).execute()

            # ── Send done signal ──────────────────────────────
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user_id: str = Depends(get_current_user)
):
    """Deletes a session and all its messages."""
    supabase = get_supabase_admin()

    supabase.table("chat_sessions")\
        .delete()\
        .eq("id", session_id)\
        .eq("user_id", user_id)\
        .execute()

    return {"message": "Session deleted"}


class RenameSessionRequest(BaseModel):
    title: str

@router.patch("/sessions/{session_id}/rename")
async def rename_session(
    session_id: str,
    body: RenameSessionRequest,
    user_id: str = Depends(get_current_user)
):
    supabase = get_supabase_admin()

    supabase.table("chat_sessions")\
        .update({"title": body.title})\
        .eq("id", session_id)\
        .eq("user_id", user_id)\
        .execute()

    return {"message": "Session renamed"}