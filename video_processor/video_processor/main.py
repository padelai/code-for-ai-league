import json
import logging
import signal
import time

import boto3
import psutil
import typer
from message_visibility_manager import MessageVisibilityManager
from pydantic_settings import BaseSettings, SettingsConfigDict
from queue_models import QueueResponse

from video_processor import VideoPreprocessor

logging.basicConfig(
    level=logging.INFO,  # Set the logging level
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler()  # This sends output to console/stdout
    ],
)

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    AWS_REGION: str = "eu-west-2"

    SOURCE_SQS_QUEUE: str
    OUTPUT_SQS_QUEUE: str

    RAW_FILES_BUCKET: str
    PROCESSED_FILES_BUCKET: str

    DEBUG_MODE: bool = False
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local", ".env.dev"),
        env_prefix="VIDEO_PROCESSOR_",
        case_sensitive=True,
        extra="ignore",
        frozen=True,
    )


def handle_shutdown(signum, frame):
    logger.info(f"Received shutdown signal {signum}, finishing current batch...")
    # Cleanup code here
    # sys.exit(0)

    memory_usage = psutil.Process().memory_info().rss / 1024 / 1024
    cpu_percent = psutil.Process().cpu_percent()

    logger.info(f"""
        Shutdown triggered:
        Signal: {signum}
        Memory Usage (MB): {memory_usage}
        CPU Usage (%): {cpu_percent}
        Current Stack Frame: {frame.f_code.co_name}
    """)


signal.signal(signal.SIGTERM, handle_shutdown)


VISIBILITY_TIMEOUT = 60


def main():
    print("Starting the task")

    settings = Settings()

    sqs = boto3.client("sqs")
    s3 = boto3.client("s3")

    video_processor = VideoPreprocessor(s3, settings.PROCESSED_FILES_BUCKET)

    while True:
        try:
            # Receive messages from SQS
            response_val = sqs.receive_message(
                QueueUrl=settings.SOURCE_SQS_QUEUE,
                MaxNumberOfMessages=1,
                WaitTimeSeconds=20,
                VisibilityTimeout=VISIBILITY_TIMEOUT,
            )

            response = QueueResponse.model_validate(response_val)
            if not response.messages:
                continue

            logger.info(f"SQS RESPONSE: {response}")

            for message in response.messages:
                with MessageVisibilityManager(
                    sqs, settings.SOURCE_SQS_QUEUE, message.receipt_handle, extend_seconds=VISIBILITY_TIMEOUT
                ):
                    try:
                        for record in message.body.records:
                            media_id, media_key = video_processor.process_video(record)

                            logger.info("Enqueue message to the analysis queue")

                            # Send a message
                            sqs.send_message(
                                QueueUrl=settings.OUTPUT_SQS_QUEUE,
                                MessageBody=json.dumps({"media_id": str(media_id), "media_key": str(media_key)}),
                                DelaySeconds=0,
                            )

                            logger.info("...enqueued")

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


if __name__ == "__main__":
    typer.run(main)
