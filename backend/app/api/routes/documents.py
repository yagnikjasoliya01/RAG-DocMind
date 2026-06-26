import hashlib
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.core.auth import get_current_user
from app.db.supabase import get_supabase_admin
from app.services.storage import upload_file_to_supabase, delete_file_from_supabase
from pydantic import BaseModel
from typing import Optional
from app.services.vector_store import delete_document_chunks

router = APIRouter()

ALLOWED_TYPES = ["application/pdf"]
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


class DocumentResponse(BaseModel):
    id: str
    filename: str
    original_name: str
    status: str
    chunk_count: int
    created_at: str
    error_message: Optional[str] = None


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user)
):
    # ── Validate file ─────────────────────────────────────────
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only PDF files are allowed")

    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large. Max size is 10MB")

    # ── Check for duplicate ───────────────────────────────────
    content_hash = hashlib.sha256(file_bytes).hexdigest()
    supabase = get_supabase_admin()

    existing = supabase.table("documents")\
        .select("id, status")\
        .eq("user_id", user_id)\
        .eq("content_hash", content_hash)\
        .execute()

    if existing.data:
        doc = existing.data[0]
        if doc["status"] == "ready":
            return {
                "document_id": doc["id"],
                "status": "already_processed",
                "message": "This document was already uploaded and processed"
            }

    # ── Upload to Supabase Storage ────────────────────────────
    unique_filename = f"{uuid.uuid4()}_{file.filename}"

    storage_path = upload_file_to_supabase(
        supabase=supabase,
        file_bytes=file_bytes,
        user_id=user_id,
        filename=unique_filename,
        mime_type=file.content_type
    )

    # ── Save to documents table ───────────────────────────────
    doc_data = {
        "user_id": user_id,
        "filename": unique_filename,
        "original_name": file.filename,
        "storage_path": storage_path,
        "file_size": len(file_bytes),
        "mime_type": file.content_type,
        "content_hash": content_hash,
        "status": "pending"
    }

    result = supabase.table("documents").insert(doc_data).execute()
    doc_id = result.data[0]["id"]

    # ── Queue processing task (Celery — added in Step 6) ─────
    from app.tasks.document_tasks import process_document
    process_document.delay(doc_id, user_id)

    return {
        "document_id": doc_id,
        "status": "pending",
        "message": "File uploaded. Processing will start shortly."
    }


@router.get("/", response_model=list[DocumentResponse])
async def list_documents(user_id: str = Depends(get_current_user)):
    """Returns all documents for the current user."""
    supabase = get_supabase_admin()

    result = supabase.table("documents")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("created_at", desc=True)\
        .execute()

    return result.data


@router.get("/{doc_id}/status")
async def get_document_status(
    doc_id: str,
    user_id: str = Depends(get_current_user)
):
    """Polling endpoint — frontend checks this every few seconds."""
    supabase = get_supabase_admin()

    result = supabase.table("documents")\
        .select("id, status, chunk_count, error_message")\
        .eq("id", doc_id)\
        .eq("user_id", user_id)\
        .single()\
        .execute()

    if not result.data:
        raise HTTPException(404, "Document not found")

    return result.data


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    user_id: str = Depends(get_current_user)
):
    """Deletes document from ChromaDB + Storage + DB."""
    supabase = get_supabase_admin()

    # ── Get document ──────────────────────────────────────────
    result = supabase.table("documents")\
        .select("*")\
        .eq("id", doc_id)\
        .eq("user_id", user_id)\
        .single()\
        .execute()

    if not result.data:
        raise HTTPException(404, "Document not found")

    doc = result.data

    # ── Delete vectors from ChromaDB ──────────────────────────
    try:
        delete_document_chunks(doc_id)
    except Exception as e:
        print(f"Warning: Could not delete ChromaDB chunks: {e}")

    # ── Delete file from Supabase Storage ─────────────────────
    try:
        delete_file_from_supabase(supabase, doc["storage_path"])
    except Exception as e:
        print(f"Warning: Could not delete file from storage: {e}")

    # ── Delete from DB (chunks cascade via FK) ────────────────
    supabase.table("documents")\
        .delete()\
        .eq("id", doc_id)\
        .eq("user_id", user_id)\
        .execute()

    return {"message": "Document deleted successfully"}