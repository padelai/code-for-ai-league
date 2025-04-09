from typing import Annotated

from fastapi import APIRouter, Depends

from ballskicker_api.api.auth.auth_context import AuthContext
from ballskicker_api.api.dependencies.auth import get_auth_context
from ballskicker_api.api.models.profile import Profile

profile_router = APIRouter(prefix="/profile", tags=["profile"])


@profile_router.get("/me")
async def route_get_profile(auth_context: Annotated[AuthContext, Depends(get_auth_context)]) -> Profile:
    return Profile(
        user_id=auth_context.user_id,
        email=auth_context.user_info.email,
        display_name=auth_context.user_info.display_name or auth_context.user_info.email,
    )
