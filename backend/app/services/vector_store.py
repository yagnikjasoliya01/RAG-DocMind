import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import get_settings

settings = get_settings()

COLLECTION_NAME = "docmind_chunks"


def get_chroma_client():
    return chromadb.HttpClient(
        host="localhost",
        port=8001,
        settings=ChromaSettings(anonymized_telemetry=False)
    )


def get_or_create_collection():
    """Gets or creates the main collection."""
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )


def upsert_chunks(
    chunks: list[str],
    embeddings: list[list[float]],
    chunk_ids: list[str],
    metadatas: list[dict]
):
    """Stores chunks + embeddings in ChromaDB."""
    collection = get_or_create_collection()
    collection.upsert(
        ids=chunk_ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas
    )


def search_chunks(
    query_embedding: list[float],
    user_id: str,
    n_results: int = 5
) -> list[dict]:
    """
    Searches for similar chunks.
    ALWAYS filters by user_id — this is the tenant boundary.
    """
    collection = get_or_create_collection()

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        where={"user_id": user_id},
        include=["documents", "metadatas", "distances"]
    )

    chunks = []
    for i, doc in enumerate(results["documents"][0]):
        chunks.append({
            "content": doc,
            "metadata": results["metadatas"][0][i],
            "score": 1 - results["distances"][0][i]
        })

    return chunks


def delete_document_chunks(document_id: str):
    """Deletes all chunks for a document from ChromaDB."""
    collection = get_or_create_collection()
    collection.delete(where={"document_id": document_id})