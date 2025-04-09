from datetime import UTC, datetime, timedelta
from typing import Annotated

import aioboto3
from aiocache import cached
from botocore.signers import CloudFrontSigner
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from fastapi import APIRouter, Depends

from ballskicker_api.api.auth.auth_context import AuthContext
from ballskicker_api.api.dependencies.auth import get_auth_context
from ballskicker_api.api.dependencies.media import get_media_service
from ballskicker_api.api.models.common import PaginatedResponse
from ballskicker_api.api.models.recordings import Analysis, Clip, ClipType, Insights, Player, Recording
from ballskicker_api.common.utils import Measure
from ballskicker_api.config.settings import AppSettings, get_settings
from ballskicker_api.services.media_service import MediaService

recordings_router = APIRouter(prefix="/recordings", tags=["recording"])

KEY_ID = "KJ964SRLKISOT"


async def get_private_key_from_secrets_manager(secret_name, session):
    """
    Retrieve the CloudFront private key from AWS Secrets Manager.
    Uses cachetools TTLCache to cache the key for 1 hour.
    """
    async with session.client("secretsmanager") as secrets_client:
        response = await secrets_client.get_secret_value(SecretId=secret_name)
        private_key_pem = response["SecretString"]
        return load_pem_private_key(private_key_pem.encode("utf-8"), password=None)


def rsa_signer(message, key):
    """
    Creates a signer function for CloudFront URLs using the private key.
    """
    return key.sign(message, padding.PKCS1v15(), hashes.SHA1())


@cached(ttl=3600 * 12, key_builder=lambda *args, **kwargs: f"cf_signer:{args[0]}")
async def get_cloudfront_signer(secret_name, key_id, session) -> CloudFrontSigner:
    private_key = await get_private_key_from_secrets_manager(
        # settings.CLOUDFRONT_PRIVATE_KEY_SECRET_NAME,
        secret_name,
        session,
    )
    signer = lambda message: rsa_signer(message, private_key)
    return CloudFrontSigner(key_id, signer)


async def get_cloudfront_signed_url(resource_path, key_id, expires, session, settings):
    """
    Generate a signed CloudFront URL for a resource.
    """
    cloudfront_signer = await get_cloudfront_signer("cloudfront/private-key", key_id, session)

    # The resource URL should be the CloudFront domain with the S3 key
    # url = f"{settings.CLOUDFRONT_DOMAIN}/{resource_path}"
    url = f"https://media.padel.piar.ai/{resource_path}"

    # Set an expiry time for the signature
    expiry_time = datetime.now(UTC) + timedelta(seconds=expires)

    # Generate the signed URL
    return cloudfront_signer.generate_presigned_url(url, date_less_than=expiry_time)


@recordings_router.get("/")
async def route_get_games_list(
    auth_context: Annotated[AuthContext, Depends(get_auth_context)],
    media_service: Annotated[MediaService, Depends(get_media_service)],
    settings: Annotated[AppSettings, Depends(get_settings)],
) -> PaginatedResponse[Recording]:
    with Measure("Getting user media from dynamo"):
        result = await media_service.get_media_for_user(auth_context.user_id)

    recordings: list[Recording] = []
    for media in result:
        media_clips = media.clips or []
        if media.thumbnail_s3_key:
            session = aioboto3.Session()

            with Measure("Signing urls"):
                thumbnail_url = await get_cloudfront_signed_url(
                    media.thumbnail_s3_key,
                    KEY_ID,  # This should be the CloudFront public key ID
                    1200,  # Expiry time in seconds
                    session,
                    settings,
                )

                media_url = await get_cloudfront_signed_url(
                    media.processed_media_s3_key,
                    KEY_ID,  # This should be the CloudFront public key ID
                    1200,  # Expiry time in seconds
                    session,
                    settings,
                )

                clip_thumbnails = []
                for clip in media_clips:
                    if clip.thumbnail_key:
                        clip_thumbnail_url = await get_cloudfront_signed_url(
                            clip.thumbnail_key,
                            KEY_ID,  # This should be the CloudFront public key ID
                            1200,  # Expiry time in seconds
                            session,
                            settings,
                        )

                        clip_thumbnails.append(clip_thumbnail_url)
                    else:
                        clip_thumbnails.append(thumbnail_url)

        else:
            thumbnail_url = None
            media_url = None
            clip_thumbnails = []

        clips = [
            Clip(
                id=clip_info.clip_id,
                clip_type=ClipType(clip_info.clip_type),
                start_frame=clip_info.start_frame,
                end_frame=clip_info.end_frame,
                start_sec=clip_info.start_sec,
                end_sec=clip_info.end_sec,
                thumbnail_url=clip_thumbnail_url,
                players={
                    p.player_id: Player(
                        player_id=p.player_id,
                        heatmap=p.heatmap,
                        analysis=Analysis(
                            defence_share=p.analysis.defence_share,
                            transition_share=p.analysis.transition_share,
                            volley_share=p.analysis.volley_share,
                        ),
                        insights=Insights(positioning=p.insights.positioning),
                    )
                    for p in clip_info.players.values()
                },
            )
            for clip_info, clip_thumbnail_url in zip(media_clips, clip_thumbnails, strict=False) or []
        ]

        recordings.append(
            Recording(
                id=media.media_id,
                title=media.title,
                uploaded_at=media.uploaded_at,
                state=media.state,
                thumbnail_url=thumbnail_url,
                media_url=media_url,
                duration_seconds=media.duration_sec,
                frames_count=media.frames_count,
                clips=clips,
            )
        )

    return PaginatedResponse[Recording](items=recordings)
