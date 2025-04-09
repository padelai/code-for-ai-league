from typing import Annotated

from fastapi import Depends

from ballskicker_api.config.settings import AppSettings, get_settings
from ballskicker_api.repositories.user_repository import UserRepository
from ballskicker_api.services.users_service import UsersService


def get_user_repository() -> UserRepository:
    return UserRepository()


def get_user_service(
    repository: Annotated[UserRepository, Depends(get_user_repository)],
    settings: Annotated[AppSettings, Depends(get_settings)],
) -> UsersService:
    return UsersService(settings.COGNITO_USER_POOL_ID, repository)
