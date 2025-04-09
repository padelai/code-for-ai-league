from datetime import datetime
from decimal import Decimal
from enum import StrEnum, auto
from uuid import UUID

import boto3
from pydantic import BaseModel


class ClipType(StrEnum):
    FULL = auto()
    RALLY = auto()


class Analysis(BaseModel):
    defence_share: float
    transition_share: float
    volley_share: float


class Insights(BaseModel):
    positioning: list[str]


class Player(BaseModel):
    player_id: int
    heatmap: list[tuple[tuple[int, int], int]]
    analysis: Analysis
    insights: Insights


class Clip(BaseModel):
    clip_id: UUID
    clip_type: ClipType
    start_frame: int
    end_frame: int
    start_sec: int
    end_sec: int
    thumbnail_key: str | None = None
    players: dict[int, Player]


class MediaState(StrEnum):
    UPLOADING = auto()
    PROCESSING = auto()
    PROCESSED = auto()
    ANALYZING = auto()
    COMPLETE = auto()
    FAILED = auto()


class MediaInfo(BaseModel):
    media_id: UUID
    user_id: UUID
    title: str
    file_name: str
    uploaded_at: datetime
    updated_at: datetime | None = None
    state: MediaState
    processed_media_s3_key: str | None = None
    thumbnail_s3_key: str | None = None
    error_message: str | None = None
    frames_count: int | None = None
    duration_sec: int | None = None
    clips: list[Clip] | None = None


def _convert_floats_to_decimal(data):
    if isinstance(data, float):
        return Decimal(str(data))
    elif isinstance(data, dict):
        return {k: _convert_floats_to_decimal(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [_convert_floats_to_decimal(i) for i in data]
    return data


def update_video_status(media_id: UUID, s3_key: str, thumbnail_s3_key: str):
    """
    Update a video entry in DynamoDB after processing.

    Args:
        media_id: The primary key for the video entry
        table_name: The name of the DynamoDB table
        new_status: The new status to set for the video
        **additional_updates: Any additional fields to update

    Returns:
        The updated VideoMetadata object
    """
    # Initialize DynamoDB client

    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table("users-media")

    # Get the current item
    response = table.get_item(Key={"media_id": str(media_id)})

    if "Item" not in response:
        raise ValueError(f"No video found with media_id: {media_id}")

    # Convert DynamoDB item to Pydantic model
    current_data = response["Item"]

    # Parse the ISO format strings back to datetime objects
    # if 'created_at' in current_data:
    #     current_data['created_at'] = datetime.fromisoformat(current_data['created_at'])
    # if 'updated_at' in current_data:
    #     current_data['updated_at'] = datetime.fromisoformat(current_data['updated_at'])

    # Create a Pydantic model from the DynamoDB item
    video_metadata = MediaInfo.model_validate(current_data)

    # Update the model with new values
    video_metadata.state = MediaState.PROCESSED
    video_metadata.updated_at = datetime.now()
    video_metadata.processed_media_s3_key = s3_key
    video_metadata.thumbnail_s3_key = thumbnail_s3_key

    updated_item = video_metadata.model_dump(mode="json")

    table.put_item(Item=updated_item)

    return video_metadata


def update_clips(media_id: UUID, clips: list[Clip]) -> None:
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table("users-media")

    # Get the current item
    response = table.get_item(Key={"media_id": str(media_id)})

    if "Item" not in response:
        raise ValueError(f"No video found with media_id: {media_id}")

    # Convert DynamoDB item to Pydantic model
    current_data = response["Item"]

    # Create a Pydantic model from the DynamoDB item
    video_metadata = MediaInfo.model_validate(current_data)

    # Update the model with new values
    video_metadata.state = MediaState.COMPLETE
    video_metadata.updated_at = datetime.now()
    video_metadata.clips = clips

    updated_item = video_metadata.model_dump(mode="json")
    updated_item = _convert_floats_to_decimal(updated_item)

    table.put_item(Item=updated_item)
