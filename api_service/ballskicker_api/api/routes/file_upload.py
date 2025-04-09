import os
from typing import Annotated

import aioboto3
from fastapi import APIRouter, Depends

from ballskicker_api.api.auth.auth_context import AuthContext
from ballskicker_api.api.dependencies.auth import get_auth_context
from ballskicker_api.api.dependencies.media import get_media_service
from ballskicker_api.common.utils import CamelModel
from ballskicker_api.config.settings import AppSettings, get_settings
from ballskicker_api.services.media_service import MediaService

videos_router = APIRouter(prefix="/videos", tags=["videos"])


class UploadURLRequest(CamelModel):
    file_name: str
    content_type: str


class UploadURLResponse(CamelModel):
    upload_url: str
    file_key: str
    # fields: dict


@videos_router.post("/")
async def route_upload_file(
    auth_context: Annotated[AuthContext, Depends(get_auth_context)],
    settings: Annotated[AppSettings, Depends(get_settings)],
    media_service: Annotated[MediaService, Depends(get_media_service)],
    request: UploadURLRequest,
) -> UploadURLResponse:
    # timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")

    # Create the file key (path in bucket)
    base_name = os.path.splitext(request.file_name)[0]
    extension = os.path.splitext(request.file_name)[1]
    sanitized_name = "".join(c for c in base_name if c.isalnum() or c in ("-", "_")).lower()

    media = await media_service.create_media_entry(
        auth_context=auth_context,
        title=request.file_name,
        file_name=request.file_name,
    )

    unique_id = str(media.media_id)

    file_key = f"uploads/users/{auth_context.user_id}/videos/{unique_id}/{sanitized_name}{extension}".lstrip("/")

    async with aioboto3.Session().client("s3") as s3_client:
        url = await s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.RAW_FILE_BUCKET_NAME,
                "Key": file_key,
                "ContentType": request.content_type,
            },
            ExpiresIn=300,
        )

    return UploadURLResponse(upload_url=url, file_key=file_key)
