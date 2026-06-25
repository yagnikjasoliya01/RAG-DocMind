from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── App ───────────────────────────────────────────────────
    environment: str = "development"
    secret_key: str = "change-me"
    allowed_origins: str = "http://localhost:3000"

    # ── Supabase ──────────────────────────────────────────────
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    # ── Google AI ─────────────────────────────────────────────
    google_api_key: str

    # ── Groq ──────────────────────────────────────────────────
    groq_api_key: str

    # ── Redis ─────────────────────────────────────────────────
    redis_url: str = "redis://redis:6379/0"

    # ── ChromaDB ──────────────────────────────────────────────
    chroma_host: str = "chromadb"
    chroma_port: int = 8000

    # ── Chunking ──────────────────────────────────────────────
    chunk_size: int = 1000
    chunk_overlap: int = 200

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = "../.env"
        case_sensitive = False
        extra = "ignore"        # ← fixes NEXT_PUBLIC_ error


@lru_cache()
def get_settings() -> Settings:
    return Settings()