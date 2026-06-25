from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user
from app.db.supabase import get_supabase_admin
from pydantic import BaseModel

router = APIRouter()


class UserProfileResponse(BaseModel):
    user_id: str
    email: str


@router.get("/me", response_model=UserProfileResponse)
async def get_me(user_id: str = Depends(get_current_user)):
    """
    Returns current logged in user profile.
    Frontend calls this to verify token is valid.
    """
    supabase = get_supabase_admin()

    result = supabase.table("user_profiles")\
        .select("*")\
        .eq("id", user_id)\
        .single()\
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    return UserProfileResponse(
        user_id=result.data["id"],
        email=result.data["email"]
    )


@router.post("/profile")
async def create_profile(user_id: str = Depends(get_current_user)):
    """
    Creates user profile in user_profiles table.
    Called automatically after signup.
    """
    supabase = get_supabase_admin()

    # Get user email from Supabase Auth
    user = supabase.auth.admin.get_user_by_id(user_id)

    # Insert into user_profiles
    result = supabase.table("user_profiles").upsert({
        "id": user_id,
        "email": user.user.email
    }).execute()

    return {"message": "Profile created", "user_id": user_id}