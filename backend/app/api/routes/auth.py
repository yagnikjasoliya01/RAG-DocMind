from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user
from app.db.supabase import get_supabase_admin
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class UserProfileResponse(BaseModel):
    user_id: str
    email: str
    username: Optional[str] = None


class CreateProfileRequest(BaseModel):
    username: str


class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None


@router.get("/me", response_model=UserProfileResponse)
async def get_me(user_id: str = Depends(get_current_user)):
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
        email=result.data["email"],
        username=result.data.get("username")
    )


@router.post("/profile")
async def create_profile(
    body: CreateProfileRequest,
    user_id: str = Depends(get_current_user)
):
    supabase = get_supabase_admin()
    print(f"Creating profile - user_id: {user_id}, username: {body.username}")

    # Check username taken
    existing = supabase.table("user_profiles")\
        .select("id")\
        .eq("username", body.username)\
        .neq("id", user_id)\
        .execute()

    if existing.data:
        raise HTTPException(400, "Username already taken")

    user = supabase.auth.admin.get_user_by_id(user_id)

    supabase.table("user_profiles").upsert({
        "id": user_id,
        "email": user.user.email,
        "username": body.username
    }).execute()

    return {"message": "Profile created", "user_id": user_id}


@router.patch("/profile")
async def update_profile(
    body: UpdateProfileRequest,
    user_id: str = Depends(get_current_user)
):
    supabase = get_supabase_admin()

    # Check username uniqueness
    if body.username:
        existing = supabase.table("user_profiles")\
            .select("id")\
            .eq("username", body.username)\
            .neq("id", user_id)\
            .execute()

        if existing.data:
            raise HTTPException(400, "Username already taken")

    supabase.table("user_profiles").update({
        "username": body.username
    }).eq("id", user_id).execute()

    return {"message": "Profile updated"}