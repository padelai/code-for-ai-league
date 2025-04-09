from datetime import datetime
from enum import StrEnum, auto
from uuid import UUID

import boto3
from pydantic import BaseModel


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


def update_video_status(media_id: UUID, s3_key: str, thumbnail_s3_key: str, frames_count: int, duration_sec: int):
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

    # Create a Pydantic model from the DynamoDB item
    video_metadata = MediaInfo.model_validate(current_data)

    # Update the model with new values
    video_metadata.state = MediaState.PROCESSED
    video_metadata.updated_at = datetime.now()
    video_metadata.processed_media_s3_key = s3_key
    video_metadata.thumbnail_s3_key = thumbnail_s3_key
    video_metadata.frames_count = frames_count
    video_metadata.duration_sec = duration_sec

    updated_item = video_metadata.model_dump(mode="json")

    table.put_item(Item=updated_item)

    return video_metadata
