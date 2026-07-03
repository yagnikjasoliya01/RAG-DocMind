import redis
from fastapi import HTTPException
from app.core.config import get_settings

settings = get_settings()

_redis = None

def get_redis():
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def check_rate_limit(
    user_id: str,
    action: str,
    max_requests: int,
    window_seconds: int
) -> None:
    """
    Raises 429 if user exceeds rate limit.
    Uses sliding window counter in Redis.
    """
    try:
        r = get_redis()
        key = f"rate:{action}:{user_id}"

        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        results = pipe.execute()

        count = results[0]

        if count > max_requests:
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests. Max {max_requests} per {window_seconds}s. Try again later."
            )

    except HTTPException:
        raise
    except Exception as e:
        # Don't block requests if Redis is down
        print(f"Rate limiter error: {e}")


# Preset limits
def rate_limit_chat(user_id: str) -> None:
    """20 chat queries per minute."""
    check_rate_limit(user_id, "chat", max_requests=20, window_seconds=60)

def rate_limit_upload(user_id: str) -> None:
    """10 uploads per hour."""
    check_rate_limit(user_id, "upload", max_requests=10, window_seconds=3600)

def rate_limit_auth(user_id: str) -> None:
    """5 auth attempts per minute."""
    check_rate_limit(user_id, "auth", max_requests=5, window_seconds=60)