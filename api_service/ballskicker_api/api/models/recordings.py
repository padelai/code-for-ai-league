from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from ballskicker_api.common.utils import CamelModel
from ballskicker_api.repositories.media_repository import MediaInfo, MediaState


class ClipType(StrEnum):
    FULL = "full"
    RALLY = "rally"


class Analysis(CamelModel):
    defence_share: float
    transition_share: float
    volley_share: float


class Insights(CamelModel):
    positioning: list[str]


class Player(CamelModel):
    player_id: int
    heatmap: list[tuple[tuple[int, int], int]]
    analysis: Analysis
    insights: Insights


class Clip(CamelModel):
    id: UUID
    clip_type: ClipType
    title: str | None = None
    thumbnail_url: str | None = None
    start_frame: int
    end_frame: int
    start_sec: int
    end_sec: int
    players: dict[int, Player]


class Recording(CamelModel):
    id: UUID
    title: str
    uploaded_at: datetime
    state: MediaState
    thumbnail_url: str | None
    media_url: str | None

    duration_seconds: int | None
    frames_count: int | None
    clips: list[Clip]

    @staticmethod
    def from_media_info(media_info: MediaInfo) -> Recording:
        return Recording(
            id=media_info.media_id, title=media_info.title, state=media_info.state, uploaded_at=media_info.uploaded_at
        )
