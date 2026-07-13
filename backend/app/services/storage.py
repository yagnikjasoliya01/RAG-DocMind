from supabase import Client
from app.core.config import get_settings

settings = get_settings()


def upload_file_to_supabase(
    supabase: Client,
    file_bytes: bytes,
    user_id: str,
    filename: str,
    mime_type: str
) -> str:
    """
    Uploads file to Supabase Storage.
    Returns the storage path.
    """
    storage_path = f"{user_id}/{filename}"

    supabase.storage.from_("documents").upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": mime_type}
    )

    return storage_path


def delete_file_from_supabase(supabase: Client, storage_path: str):
    """Deletes file from Supabase Storage."""
    supabase.storage.from_("documents").remove([storage_path])