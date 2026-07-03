import uuid
from celery import shared_task
from app.tasks.celery_app import celery_app
from app.db.supabase import get_supabase_admin
from app.services.pdf_extractor import extract_text_from_file
from app.services.embeddings import embed_texts
from app.services.vector_store import upsert_chunks, delete_document_chunks
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_experimental.text_splitter import SemanticChunker
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from app.core.config import get_settings
from app.services.contextual_retrieval import add_context_to_chunks
from app.services.metrics import metrics
import time
settings = get_settings()

@celery_app.task(bind=True, max_retries=3)
def process_document(self, document_id: str, user_id: str):
    """
    Main Celery task — full RAG processing pipeline:
    Download → Extract → Chunk → Embed → Store → Update status
    """
    supabase = get_supabase_admin()

    try:

        start_time = time.time()

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
        text = extract_text_from_file(
            file_bytes=file_bytes,
            filename=doc["original_name"],
            mime_type=doc["mime_type"]
        )

        if not text:
            raise ValueError("No text could be extracted from this PDF")

        # ── Split into chunks ─────────────────────────────────
        try:
            # Try semantic chunking first
            embedding_model = GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001",
                google_api_key=settings.google_api_key,
                http_options={"api_version": "v1"}
            )
            splitter = SemanticChunker(
                embedding_model,
                breakpoint_threshold_type="percentile",
                breakpoint_threshold_amount=85
            )
            chunks = splitter.split_text(text)
            # Fall back if too few chunks
            if len(chunks) < 2:
                raise ValueError("Too few semantic chunks")
        except Exception:
            # Fallback to recursive splitter
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                separators=["\n\n", "\n", " ", ""]
            )
            chunks = splitter.split_text(text)

        if not chunks:
            raise ValueError("No chunks created from document")

        # ── Add contextual information to chunks ──────────────
        print(f"Adding context to {len(chunks)} chunks...")
        contextualized_chunks = add_context_to_chunks(
            chunks=chunks,
            full_text=text,
            document_name=doc["original_name"]
        )

        # ── Generate embeddings on contextualized chunks ──────
        embeddings = embed_texts(contextualized_chunks)

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

        # ── Store contextualized chunks in ChromaDB ───────────
        upsert_chunks(
            chunks=contextualized_chunks,
            embeddings=embeddings,
            chunk_ids=chunk_ids,
            metadatas=metadatas
        )

        # ── Save original chunks to Postgres ─────────────────
        # Store original chunks (not contextualized) for display
        chunk_rows = [
            {
                "id": chunk_ids[i],
                "document_id": document_id,
                "user_id": user_id,
                "chunk_index": i,
                "content": chunks[i],          # original chunk for display
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

        processing_time = (time.time() - start_time) * 1000
        metrics.log_upload(
            user_id=user_id,
            filename=doc["original_name"],
            file_size=doc.get("file_size", 0),
            chunk_count=len(chunks),
            processing_time_ms=processing_time
        )
        print(f"✅ Document {document_id} processed: {len(chunks)} chunks in {processing_time:.0f}ms")
        return {"status": "ready", "chunks": len(chunks)}

    except Exception as e:
        print(f"❌ Error processing document {document_id}: {e}")

        # Update status to error
        supabase.table("documents").update({
            "status": "error",
            "error_message": str(e)
        }).eq("id", document_id).execute()

        # Retry up to 3 times
        raise self.retry(exc=e, countdown=10)