def rerank_chunks(query: str, chunks: list[dict], top_n: int = 5) -> list[dict]:
    """
    Simple keyword-based reranker.
    Scores chunks by query term frequency.
    """
    if not chunks:
        return chunks

    query_terms = query.lower().split()

    for chunk in chunks:
        content = chunk["content"].lower()
        score = sum(content.count(term) for term in query_terms)
        # Combine with vector similarity score
        chunk["rerank_score"] = score * 0.3 + chunk.get("score", 0) * 0.7

    # Sort by combined score
    reranked = sorted(chunks, key=lambda x: x["rerank_score"], reverse=True)

    return reranked[:top_n]