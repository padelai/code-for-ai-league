from typing import Annotated

from fastapi import Depends

from ballskicker_api.config.settings import AppSettings, get_settings
from ballskicker_api.repositories.media_repository import MediaRepository
from ballskicker_api.services.media_service import MediaService


def get_media_repository() -> MediaRepository:
    return MediaRepository()


def get_media_service(
    repository: Annotated[MediaRepository, Depends(get_media_repository)],
    settings: Annotated[AppSettings, Depends(get_settings)],
) -> MediaService:
    return MediaService(repository)
