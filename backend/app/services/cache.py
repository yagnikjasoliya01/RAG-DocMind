import json
import hashlib
import redis
from app.core.config import get_settings

settings = get_settings()

# Redis client
_redis = None

def get_redis():
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def _make_cache_key(user_id: str, question: str, document_ids: list[str]) -> str:
    """Creates a unique cache key for a query."""
    content = f"{user_id}:{question.lower().strip()}:{sorted(document_ids)}"
    return f"rag:cache:{hashlib.sha256(content.encode()).hexdigest()}"


def get_cached_response(
    user_id: str,
    question: str,
    document_ids: list[str]
) -> str | None:
    """Returns cached response if exists."""
    try:
        key = _make_cache_key(user_id, question, document_ids)
        return get_redis().get(key)
    except Exception as e:
        print(f"Cache get failed: {e}")
        return None


def set_cached_response(
    user_id: str,
    question: str,
    document_ids: list[str],
    response: str,
    ttl: int = 3600  # 1 hour
) -> None:
    """Caches a response."""
    try:
        key = _make_cache_key(user_id, question, document_ids)
        get_redis().setex(key, ttl, response)
        print(f"✅ Response cached")
    except Exception as e:
        print(f"Cache set failed: {e}")


def invalidate_user_cache(user_id: str) -> None:
    """Clears all cached responses for a user when docs change."""
    try:
        r = get_redis()
        keys = r.keys(f"rag:cache:*")
        if keys:
            r.delete(*keys)
    except Exception as e:
        print(f"Cache invalidation failed: {e}")