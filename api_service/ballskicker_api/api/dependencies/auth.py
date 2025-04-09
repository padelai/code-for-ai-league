import logging
from typing import Annotated

from cachetools import TTLCache
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ballskicker_api.api.auth.auth import get_cognito_auth
from ballskicker_api.api.auth.auth_context import AuthContext
from ballskicker_api.api.auth.cognito_auth import CognitoAuth
from ballskicker_api.api.dependencies.users import get_user_service
from ballskicker_api.services.users_service import UsersService

log = logging.getLogger("Auth")

security = HTTPBearer()


auth_cache = TTLCache(maxsize=1000, ttl=3600)


async def get_auth_context(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    cognito_auth: Annotated[CognitoAuth, Depends(get_cognito_auth)],
    users_service: Annotated[UsersService, Depends(get_user_service)],
) -> AuthContext:
    token = credentials.credentials
    cache_key = f"auth:{token}"
    cached_result = auth_cache.get(cache_key)

    if cached_result:
        log.info(f"Using cached authentication for token: {token[:10]}...")
        return cached_result

    try:
        token_claims = await cognito_auth.verify_token(credentials.credentials)
        log.info(f"Authentication attempt with claims: {token_claims}")

        user_info = await users_service.get_user_by_cognito_username(token_claims.username)
        auth_context = AuthContext(user_id=user_info.user_id, user_info=user_info)
        auth_cache[cache_key] = auth_context

        return auth_context

    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e)) from None
