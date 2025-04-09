from uuid import UUID

from ballskicker_api.api.auth.auth_context import AuthContext
from ballskicker_api.repositories.media_repository import MediaInfo, MediaRepository


class MediaService:
    def __init__(self, repository: MediaRepository):
        self.__repository = repository

    async def get_media_for_user(self, user_id: UUID) -> list[MediaInfo]:
        return await self.__repository.get_media_for_user(user_id)

    async def create_media_entry(self, *, title: str, file_name: str, auth_context: AuthContext) -> MediaInfo:
        return await self.__repository.create_media_entry(title=title, file_name=file_name, auth_context=auth_context)
