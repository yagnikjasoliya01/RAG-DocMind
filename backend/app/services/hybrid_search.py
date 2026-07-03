import numpy as np
from rank_bm25 import BM25Okapi
from app.services.vector_store import search_chunks
from app.services.embeddings import embed_query


def hybrid_search(
    question: str,
    query_embedding: list[float],
    user_id: str,
    document_ids: list[str] = [],
    n_results: int = 10,
    alpha: float = 0.7  # 0.7 vector + 0.3 keyword
) -> list[dict]:
    """
    Hybrid search combining vector + BM25 keyword search.
    Alpha controls vector vs keyword balance.
    """
    # ── Vector search ─────────────────────────────────────
    vector_results = search_chunks(
        query_embedding=query_embedding,
        user_id=user_id,
        n_results=n_results,
        document_ids=document_ids
    )

    if not vector_results:
        return []

    # ── BM25 keyword search on retrieved chunks ───────────
    corpus = [chunk["content"].lower().split() for chunk in vector_results]
    bm25 = BM25Okapi(corpus)
    query_tokens = question.lower().split()
    bm25_scores = bm25.get_scores(query_tokens)

    # ── Normalize scores ──────────────────────────────────
    vector_scores = np.array([c.get("score", 0) for c in vector_results])
    bm25_scores = np.array(bm25_scores)

    # Normalize to 0-1
    if vector_scores.max() > 0:
        vector_scores = vector_scores / vector_scores.max()
    if bm25_scores.max() > 0:
        bm25_scores = bm25_scores / bm25_scores.max()

    # ── Combine scores ────────────────────────────────────
    combined = alpha * vector_scores + (1 - alpha) * bm25_scores

    # ── Sort by combined score ────────────────────────────
    for i, chunk in enumerate(vector_results):
        chunk["hybrid_score"] = float(combined[i])

    return sorted(vector_results, key=lambda x: x["hybrid_score"], reverse=True)