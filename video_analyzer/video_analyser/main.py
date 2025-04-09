import json
import logging
import time
import uuid

import boto3
import typer
from insights import analyze_stats
from message_visibility_manager import MessageVisibilityManager
from pydantic_settings import BaseSettings, SettingsConfigDict
from queue_models import QueueResponse
from video_metadata_manager import Analysis, Clip, ClipType, Insights, Player, update_clips

from video_analyser import VideoAnalyser

logging.basicConfig(
    level=logging.INFO,  # Set the logging level
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler()  # This sends output to console/stdout
    ],
)

logger = logging.getLogger(__name__)


app = typer.Typer()


class Settings(BaseSettings):
    AWS_REGION: str = "eu-west-2"

    SOURCE_SQS_QUEUE: str
    MEDIA_FILES_BUCKET: str

    DEBUG_MODE: bool = False
    LOG_LEVEL: str = "INFO"

    OPENAI_API_KEY: str

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local", ".env.dev"),
        env_prefix="VIDEO_ANALYSER_",
        case_sensitive=True,
        extra="ignore",
        frozen=True,
    )


SQS_VISIBILITY_TIMEOUT = 30


@app.command()
def main():
    print("Starting the task")

    settings = Settings()

    sqs = boto3.client("sqs")
    s3 = boto3.client("s3")

    video_analyser = VideoAnalyser(s3, settings.MEDIA_FILES_BUCKET)

    while True:
        try:
            response_val = sqs.receive_message(
                QueueUrl=settings.SOURCE_SQS_QUEUE,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=20,
                VisibilityTimeout=SQS_VISIBILITY_TIMEOUT,
            )

            response = QueueResponse.model_validate(response_val)
            if not response.messages:
                continue

            logger.info(f"SQS RESPONSE: {response}")

            for message in response.messages:
                with MessageVisibilityManager(
                    sqs, settings.SOURCE_SQS_QUEUE, message.receipt_handle, extend_seconds=SQS_VISIBILITY_TIMEOUT
                ):
                    try:
                        # media_id, media_key = video_processor.process_video(record)
                        media_descriptor = message.body
                        logger.info(f"Handling media {media_descriptor}")

                        rallies, thumbnails = video_analyser.analyse_video(media_descriptor.media_key)

                        clips = []
                        for rally, thumbnail in zip(rallies, thumbnails, strict=False):
                            players = []

                            for p in rally.players.values():
                                advice = analyze_stats(
                                    settings.OPENAI_API_KEY,
                                    p.zone_stats.volley_share * 100,
                                    p.zone_stats.transition_share * 100,
                                    p.zone_stats.defence_share * 100,
                                )
                                players.append(
                                    Player(
                                        player_id=p.id,
                                        heatmap=p.heatmap,
                                        analysis=Analysis(
                                            defence_share=p.zone_stats.defence_share,
                                            transition_share=p.zone_stats.transition_share,
                                            volley_share=p.zone_stats.volley_share,
                                        ),
                                        insights=Insights(positioning=[advice]),
                                    )
                                )

                            clips.append(
                                Clip(
                                    clip_id=uuid.uuid4(),
                                    clip_type=ClipType.RALLY if rally.rally_id > 0 else ClipType.FULL,
                                    start_frame=rally.start_frame,
                                    end_frame=rally.end_frame,
                                    start_sec=int(rally.start_time),
                                    end_sec=int(rally.end_time),
                                    thumbnail_key=thumbnail,
                                    players={p.player_id: p for p in players},
                                )
                            )

                        logger.info("Updating metadata")
                        update_clips(media_descriptor.media_id, clips)
                        logger.info("Metadata update complete")

                        logger.info("Removing message from the queue")
                        sqs.delete_message(QueueUrl=settings.SOURCE_SQS_QUEUE, ReceiptHandle=message.receipt_handle)
                        logger.info("Message is removed")

                    except json.JSONDecodeError as e:
                        logger.error(f"Error parsing message: {str(e)}")
                    except Exception as e:
                        logger.error(f"Error processing message: {str(e)}")

        except Exception as e:
            logger.error(f"Error receiving messages: {str(e)}")
            time.sleep(5)  # Wait before retrying

    print("Hello from ballskicker-video-analyser!")


if __name__ == "__main__":
    app()
