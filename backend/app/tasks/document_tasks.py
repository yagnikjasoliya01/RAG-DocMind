import uuid
from celery import shared_task
from app.tasks.celery_app import celery_app
from app.db.supabase import get_supabase_admin
from app.services.pdf_extractor import extract_text_from_pdf
from app.services.embeddings import embed_texts
from app.services.vector_store import upsert_chunks, delete_document_chunks
from langchain_text_splitters import RecursiveCharacterTextSplitter

@celery_app.task(bind=True, max_retries=3)
def process_document(self, document_id: str, user_id: str):
    """
    Main Celery task — full RAG processing pipeline:
    Download → Extract → Chunk → Embed → Store → Update status
    """
    supabase = get_supabase_admin()

    try:
        # ── Update status to processing ───────────────────────
        supabase.table("documents")\
            .update({"status": "processing"})\
            .eq("id", document_id)\
            .execute()

        # ── Get document info ─────────────────────────────────
        doc_result = supabase.table("documents")\
            .select("*")\
            .eq("id", document_id)\
            .single()\
            .execute()

        doc = doc_result.data
        storage_path = doc["storage_path"]

        # ── Download file from Supabase Storage ───────────────
        file_bytes = supabase.storage\
            .from_("documents")\
            .download(storage_path)

        # ── Extract text ──────────────────────────────────────
        text = extract_text_from_pdf(file_bytes)

        if not text:
            raise ValueError("No text could be extracted from this PDF")

        # ── Split into chunks ─────────────────────────────────
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", " ", ""]
        )
        chunks = splitter.split_text(text)

        if not chunks:
            raise ValueError("No chunks created from document")

        # ── Generate embeddings ───────────────────────────────
        embeddings = embed_texts(chunks)

        # ── Prepare data for ChromaDB ─────────────────────────
        chunk_ids = [str(uuid.uuid4()) for _ in chunks]
        metadatas = [
            {
                "user_id": user_id,
                "document_id": document_id,
                "document_name": doc["original_name"],
                "chunk_index": i,
            }
            for i in range(len(chunks))
        ]

        # ── Store in ChromaDB ─────────────────────────────────
        upsert_chunks(
            chunks=chunks,
            embeddings=embeddings,
            chunk_ids=chunk_ids,
            metadatas=metadatas
        )

        # ── Save chunk metadata to Postgres ───────────────────
        chunk_rows = [
            {
                "id": chunk_ids[i],
                "document_id": document_id,
                "user_id": user_id,
                "chunk_index": i,
                "content": chunks[i],
                "token_count": len(chunks[i].split()),
                "vector_id": chunk_ids[i],
            }
            for i in range(len(chunks))
        ]

        # Insert in batches of 50
        for i in range(0, len(chunk_rows), 50):
            supabase.table("document_chunks")\
                .insert(chunk_rows[i:i+50])\
                .execute()

        # ── Update document status to ready ───────────────────
        supabase.table("documents").update({
            "status": "ready",
            "chunk_count": len(chunks),
        }).eq("id", document_id).execute()

        print(f"✅ Document {document_id} processed: {len(chunks)} chunks")
        return {"status": "ready", "chunks": len(chunks)}

    except Exception as e:
        print(f"❌ Error processing document {document_id}: {e}")

        # Update status to error
        supabase.table("documents").update({
            "status": "error",
            "error_message": str(e)
        }).eq("id", document_id).execute()

        # Retry up to 3 times
        raise self.retry(exc=e, countdown=60)