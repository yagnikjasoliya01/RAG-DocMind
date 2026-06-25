from google import genai
from google.genai import types
from app.core.config import get_settings

settings = get_settings()


def _get_client():
    return genai.Client(
        api_key=settings.google_api_key,
        http_options={"api_version": "v1"}
    )


def embed_texts(texts: list[str]) -> list[list[float]]:
    client = _get_client()
    all_embeddings = []

    batch_size = 20
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        result = client.models.embed_content(
            model="gemini-embedding-001",
            contents=batch,
            config=types.EmbedContentConfig(
                task_type="RETRIEVAL_DOCUMENT"
            )
        )
        for emb in result.embeddings:
            all_embeddings.append(emb.values)

    return all_embeddings


def embed_query(text: str) -> list[float]:
    client = _get_client()
    result = client.models.embed_content(
        model="gemini-embedding-001",
        contents=[text],
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY"
        )
    )
    return result.embeddings[0].values