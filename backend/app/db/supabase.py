from supabase import create_client, Client
from app.core.config import get_settings

settings = get_settings()

def get_supabase() -> Client:
    """
    Regular client — uses anon key.
    For normal DB operations with RLS enforced.
    """
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key
    )

def get_supabase_admin() -> Client:
    """
    Admin client — uses service role key.
    Bypasses RLS. Only use in Celery workers
    where we don't have a user JWT.
    """
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key
    )