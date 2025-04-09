from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from ballskicker_api.api.auth.cognito_auth import CognitoAuth
from ballskicker_api.config.settings import AppSettings, get_settings


@lru_cache
def get_cognito_auth(settings: Annotated[AppSettings, Depends(get_settings)]) -> CognitoAuth:
    return CognitoAuth(
        region=settings.AWS_REGION, user_pool_id=settings.COGNITO_USER_POOL_ID, client_id=settings.COGNITO_CLIENT_ID
    )
