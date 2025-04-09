import logging
import uuid
from datetime import UTC, datetime
from enum import StrEnum, auto
from uuid import UUID

from aioboto3 import Session
from aiocache import cached
from pydantic import BaseModel, Field

from ballskicker_api.api.auth.auth_context import AuthContext

log = logging.getLogger("MediaRepository")


class MediaClipType(StrEnum):
    FULL = "full"
    RALLY = "rally"


class Analysis(BaseModel):
    defence_share: float = 0.0
    transition_share: float = 0.0
    volley_share: float = 0.0


class Insights(BaseModel):
    positioning: list[str] = Field(default_factory=list)


class Player(BaseModel):
    player_id: int
    heatmap: list[tuple[tuple[int, int], int]]
    analysis: Analysis = Field(default_factory=Analysis)
    insights: Insights = Field(default_factory=Insights)


class MediaClip(BaseModel):
    clip_id: UUID
    clip_type: MediaClipType
    start_frame: int
    end_frame: int
    start_sec: int
    end_sec: int
    thumbnail_key: str | None = None
    players: dict[int, Player] = Field(default_factory=dict)


class MediaState(StrEnum):
    UPLOADING = auto()
    PROCESSING = auto()
    PROCESSED = auto()
    ANALYZING = auto()
    COMPLETE = auto()


class MediaInfo(BaseModel):
    media_id: UUID
    user_id: UUID
    title: str
    file_name: str
    uploaded_at: datetime
    state: MediaState
    clips: list[MediaClip] | None = None
    duration_sec: int | None = None
    frames_count: int | None = None
    processed_media_s3_key: str | None = None
    thumbnail_s3_key: str | None = None


class MediaRepository:
    def __init__(self):
        self._session = Session()

    @cached(ttl=3600)
    async def _get_table(self):
        async with self._session.resource("dynamodb") as dynamodb:
            return await dynamodb.Table("users-media")

    async def get_media_by_id(self, media_id: UUID) -> MediaInfo:
        pass

    async def get_media_for_user(self, user_id: UUID) -> list[MediaInfo]:
        media_table = await self._get_table()
        response = await media_table.query(
            IndexName="user-id-index",  # Name of your GSI
            KeyConditionExpression="user_id = :user_id",
            ExpressionAttributeValues={
                ":user_id": str(user_id)  # Convert UUID to string if needed
            },
        )

        return [MediaInfo.model_validate(item) for item in response.get("Items", [])]

    async def create_media_entry(self, *, title: str, file_name: str, auth_context: AuthContext) -> MediaInfo:
        async with Session().resource("dynamodb") as dynamodb:
            media_table = await dynamodb.Table("users-media")

            media_info = MediaInfo(
                media_id=uuid.uuid4(),
                title=title,
                file_name=file_name,
                uploaded_at=datetime.now(tz=UTC),
                state=MediaState.UPLOADING,
                user_id=auth_context.user_id,
            )

            # Put the item
            response = await media_table.put_item(Item=media_info.model_dump(mode="json"))

        if response["ResponseMetadata"]["HTTPStatusCode"] == 200:
            return media_info

        log.error(f"Failed to create media entry: {response}")
        raise RuntimeError("Failed to create media entry")
