import time
import json
import logging
from datetime import datetime
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class MetricsLogger:
    """Simple metrics logger using Redis."""

    def __init__(self):
        self._redis = None

    def _get_redis(self):
        if self._redis is None:
            import redis
            self._redis = redis.from_url(
                settings.redis_url,
                decode_responses=True
            )
        return self._redis

    def log_query(
        self,
        user_id: str,
        question: str,
        response_time_ms: float,
        chunks_retrieved: int,
        cached: bool = False,
        error: str = None
    ):
        """Logs a RAG query metric."""
        try:
            r = self._get_redis()
            metric = {
                "timestamp": datetime.utcnow().isoformat(),
                "user_id": user_id,
                "response_time_ms": round(response_time_ms, 2),
                "chunks_retrieved": chunks_retrieved,
                "cached": cached,
                "error": error,
                "question_length": len(question)
            }

            # Store in Redis list (keep last 1000)
            r.lpush("metrics:queries", json.dumps(metric))
            r.ltrim("metrics:queries", 0, 999)

            # Update counters
            r.incr("metrics:total_queries")
            if cached:
                r.incr("metrics:cache_hits")
            if error:
                r.incr("metrics:errors")

            # Track avg response time
            r.lpush("metrics:response_times", response_time_ms)
            r.ltrim("metrics:response_times", 0, 99)

            logger.info(
                f"Query metrics: {response_time_ms:.0f}ms | "
                f"chunks={chunks_retrieved} | cached={cached}"
            )

        except Exception as e:
            logger.warning(f"Metrics logging failed: {e}")

    def log_upload(
        self,
        user_id: str,
        filename: str,
        file_size: int,
        chunk_count: int,
        processing_time_ms: float,
        error: str = None
    ):
        """Logs a document upload metric."""
        try:
            r = self._get_redis()
            metric = {
                "timestamp": datetime.utcnow().isoformat(),
                "user_id": user_id,
                "filename": filename,
                "file_size": file_size,
                "chunk_count": chunk_count,
                "processing_time_ms": round(processing_time_ms, 2),
                "error": error
            }

            r.lpush("metrics:uploads", json.dumps(metric))
            r.ltrim("metrics:uploads", 0, 999)
            r.incr("metrics:total_uploads")

            logger.info(
                f"Upload metrics: {filename} | "
                f"{chunk_count} chunks | {processing_time_ms:.0f}ms"
            )

        except Exception as e:
            logger.warning(f"Metrics logging failed: {e}")

    def get_stats(self) -> dict:
        """Returns aggregated metrics."""
        try:
            r = self._get_redis()

            total_queries = int(r.get("metrics:total_queries") or 0)
            cache_hits = int(r.get("metrics:cache_hits") or 0)
            total_errors = int(r.get("metrics:errors") or 0)
            total_uploads = int(r.get("metrics:total_uploads") or 0)

            times = r.lrange("metrics:response_times", 0, -1)
            avg_response_time = (
                sum(float(t) for t in times) / len(times)
                if times else 0
            )

            return {
                "total_queries": total_queries,
                "cache_hits": cache_hits,
                "cache_hit_rate": round(cache_hits / total_queries * 100, 1) if total_queries > 0 else 0,
                "total_errors": total_errors,
                "error_rate": round(total_errors / total_queries * 100, 1) if total_queries > 0 else 0,
                "total_uploads": total_uploads,
                "avg_response_time_ms": round(avg_response_time, 2)
            }

        except Exception as e:
            logger.warning(f"Metrics get failed: {e}")
            return {}


# Singleton
metrics = MetricsLogger()