import logging
import os
import re
import select
import subprocess
import threading
import time
from collections.abc import Generator
from contextlib import ExitStack
from dataclasses import dataclass
from enum import StrEnum
from io import BytesIO
from pathlib import Path
from queue import Queue
from tempfile import TemporaryDirectory
from typing import Any
from uuid import UUID

import ffmpeg
from botocore.exceptions import BotoCoreError
from queue_models import S3Record
from thumbnail_creator import extract_thumbnail
from video_metadata_manager import update_video_status


class VideoCodec(StrEnum):
    H264 = "libx264"


@dataclass
class ProgressInfo:
    """Stores FFmpeg encoding progress information"""

    frame: int = 0
    fps: float = 0.0
    total_size: int = 0
    time: float = 0.0
    bitrate: str = ""
    speed: str = "0x"  # Changed to string to handle the 'x' suffix
    progress: str = ""


class FFmpegError(Exception):
    """Custom exception for FFmpeg-related errors"""

    pass


class VideoPreprocessor:
    # Minimum part size for multipart uploads (5MB)
    MIN_PART_SIZE = 5 * 1024 * 1024

    def __init__(
        self,
        s3_client,
        target_bucket: str,
        target_width: int = 1080,
        target_height: int = 720,
        progress_interval: int = 30,
    ):
        """
        Initialize video preprocessor

        Args:
            s3_client: Initialized S3 client
            target_bucket: Target S3 bucket for processed videos
            target_height: Target height in pixels (default: 1080 for Full HD)
            progress_interval: Interval in seconds for progress updates (default: 30)
        """
        self.s3 = s3_client
        self.target_bucket = target_bucket
        self.target_height = target_height
        self.target_width = target_width
        self.progress_interval = progress_interval
        self.logger = logging.getLogger(__name__)

    def _get_codec_settings(self, codec: VideoCodec, pass_number: int = 0) -> dict[str, Any]:
        """
        Get FFmpeg settings for a specific codec and pass number

        Args:
            codec: Video codec to use
            pass_number: 1 for first pass, 2 for second pass, 0 for single pass

        Returns:
            Dictionary of FFmpeg settings
        """
        base_settings = {
            "acodec": "none",  # No audio
            "movflags": "frag_keyframe+empty_moov+faststart",  # Enable streaming
        }

        codec_settings = {
            VideoCodec.H264: {
                "vcodec": codec.value,
                "preset": "medium",
                "profile:v": "high",
                "b:v": "2M",
                "maxrate": "2.5M",
                "bufsize": "5M",
                "g": 20,
                "bf": 2,
                "flags": "+cgop",
                "force_key_frames": "expr:gte(t,n_forced*2)",
            }
        }

        settings = {**base_settings, **codec_settings[codec]}

        if pass_number == 1:
            return {**settings, "pass": 1, "f": "null"}
        elif pass_number == 2:
            return {**settings, "pass": 2, "format": "mp4"}
        else:
            return {**settings, "crf": 23, "format": "mp4"}

    def _parse_progress_line(self, line: str, progress_info: ProgressInfo) -> None:
        """
        Parse a single line of FFmpeg progress output

        Args:
            line: Progress line from FFmpeg
            progress_info: ProgressInfo object to update
        """
        if "=" not in line:
            return

        key, value = line.strip().split("=", 1)
        if not hasattr(progress_info, key):
            return

        try:
            field_type = type(getattr(progress_info, key))
            if field_type is float:
                try:
                    setattr(progress_info, key, float(value))
                except ValueError:
                    # Handle speed=Nx format
                    if key == "speed" and value.endswith("x"):
                        setattr(progress_info, key, value)
                    else:
                        self.logger.debug(f"Could not parse float value: {key}={value}")
            elif field_type is int:
                try:
                    setattr(progress_info, key, int(value))
                except ValueError:
                    self.logger.debug(f"Could not parse int value: {key}={value}")
            else:
                setattr(progress_info, key, value)
        except ValueError:
            self.logger.warning(f"Could not parse progress value: {key}={value}")

    def _get_video_info(self, input_url: str) -> dict:
        """
        Get video information including duration and frame count using FFprobe

        Args:
            input_url: URL or path to input video

        Returns:
            Dictionary containing video metadata

        Raises:
            FFmpegError: If FFprobe fails to get video information
        """
        try:
            # Get video information using FFprobe
            probe = ffmpeg.probe(
                input_url, v="error", show_format=None, show_streams=None, protocol_whitelist="https,tls,tcp,file"
            )

            self.logger.debug(f"FFprobe result: {probe}")

            # Find the video stream
            video_info = None
            for stream in probe.get("streams", []):
                if stream.get("codec_type") == "video":
                    video_info = stream
                    break

            # If we didn't find a stream with codec_type, look for streams with valid width/height
            if not video_info:
                for stream in probe.get("streams", []):
                    if "width" in stream and "height" in stream:
                        video_info = stream
                        self.logger.info("Found video stream without codec_type but with dimensions")
                        break

            if not video_info:
                raise FFmpegError("No video stream found in probe results")

            # Get duration - first try from stream, then from format
            duration_seconds = 0
            if "duration" in video_info:
                duration_seconds = float(video_info["duration"])
            elif "format" in probe and "duration" in probe["format"]:
                duration_seconds = float(probe["format"]["duration"])

            # Get or calculate frame count
            frame_count = 0
            if "nb_frames" in video_info:
                frame_count = int(video_info["nb_frames"])
            else:
                # Try to get frame rate
                frame_rate = 30.0  # Default to 30fps if we can't determine
                if "r_frame_rate" in video_info:
                    try:
                        r_frame_rate = video_info["r_frame_rate"]
                        num, den = map(int, r_frame_rate.split("/"))
                        frame_rate = num / den
                    except (ValueError, ZeroDivisionError):
                        self.logger.warning(f"Couldn't parse frame rate: {video_info.get('r_frame_rate')}")

                # Calculate frame count from duration and frame rate
                frame_count = int(duration_seconds * frame_rate)

            # Get width and height
            width = int(video_info.get("width", 0))
            height = int(video_info.get("height", 0))

            # Get frame rate as string
            frame_rate_str = video_info.get("r_frame_rate", "30/1")

            # Compile video information
            video_metadata = {
                "duration_seconds": int(duration_seconds),
                "frame_count": int(frame_count),
                "width": width,
                "height": height,
                "frame_rate": frame_rate_str,
            }

            self.logger.info(f"Extracted video info: {video_metadata}")
            return video_metadata

        except ffmpeg.Error as e:
            error_message = e.stderr.decode() if hasattr(e, "stderr") else str(e)
            self.logger.error(f"FFprobe error: {error_message}")
            raise FFmpegError(f"Failed to get video information: {error_message}") from e
        except Exception as e:
            self.logger.error(f"Error getting video information: {e}")
            # Print the traceback for debugging
            import traceback

            self.logger.error(f"Traceback: {traceback.format_exc()}")
            raise FFmpegError(f"Failed to get video information: {e}") from e

    def _monitor_progress(self, progress_fd: int, progress_queue: Queue, pass_number: int) -> None:
        """
        Monitor FFmpeg progress and send updates through queue

        Args:
            progress_fd: File descriptor for progress pipe
            progress_queue: Queue for progress updates
            pass_number: Current pass number (1 or 2)
        """
        progress_info = ProgressInfo()

        with os.fdopen(progress_fd, "r") as progress_file:
            last_log_time = time.time()

            while True:
                rlist, _, _ = select.select([progress_file], [], [], 1.0)
                if not rlist:
                    continue

                line = progress_file.readline()
                if not line:
                    break

                self._parse_progress_line(line, progress_info)
                if progress_info.progress == "end":
                    progress_queue.put(("complete", progress_info))
                    self.logger.info("Pass %d completed: %s", pass_number, progress_info)
                    break

                current_time = time.time()
                if current_time - last_log_time >= self.progress_interval:
                    progress_queue.put(("update", progress_info))
                    self.logger.info("Pass %d progress: %s", pass_number, progress_info)
                    last_log_time = current_time

    def _run_ffmpeg_pass(
        self, stream: ffmpeg.Stream, passlogfile: str | None = None, progress_pipe: int | None = None
    ) -> subprocess.Popen:
        """
        Run a single FFmpeg pass

        Args:
            stream: Configured FFmpeg stream
            passlogfile: Path to passlog file for 2-pass encoding
            progress_pipe: File descriptor for progress pipe

        Returns:
            subprocess.Popen: The running FFmpeg process

        Raises:
            FFmpegError: If FFmpeg process fails
        """
        cmd = stream.compile()
        if passlogfile:
            cmd.extend(["-passlogfile", str(passlogfile)])

        cmd.extend(
            [
                "-loglevel",
                "error",
                "-stats_period",
                "1",
            ]
        )

        if progress_pipe is not None:
            cmd.extend(["-progress", f"pipe:{progress_pipe}"])

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            pass_fds=(progress_pipe,) if progress_pipe is not None else (),
        )

        return process

    def _create_upload_parts(
        self, process: subprocess.Popen, upload_id: str, key: str
    ) -> Generator[dict[str, Any], None, None]:
        """
        Create and upload parts for multipart upload

        Args:
            process: FFmpeg subprocess with stdout pipe
            upload_id: S3 multipart upload ID
            key: S3 object key

        Yields:
            Dict containing PartNumber and ETag for each uploaded part
        """
        buffer = BytesIO()
        part_number = 1

        while True:
            chunk = process.stdout.read(8192)  # 8KB chunks
            if not chunk:
                break

            buffer.write(chunk)

            if buffer.tell() >= self.MIN_PART_SIZE:
                buffer.seek(0)
                part = self.s3.upload_part(
                    Bucket=self.target_bucket,
                    Key=key,
                    PartNumber=part_number,
                    UploadId=upload_id,
                    Body=buffer.getvalue(),
                )

                yield {"PartNumber": part_number, "ETag": part["ETag"]}

                part_number += 1
                buffer = BytesIO()

        # Upload final part if there's any data left
        if buffer.tell() > 0:
            buffer.seek(0)
            part = self.s3.upload_part(
                Bucket=self.target_bucket,
                Key=key,
                PartNumber=part_number,
                UploadId=upload_id,
                Body=buffer.getvalue(),
            )

            yield {"PartNumber": part_number, "ETag": part["ETag"]}

    def _get_presigned_url(self, bucket: str, key: str, expiry: int = 3600) -> str:
        """
        Get a pre-signed URL for S3 object

        Args:
            bucket: S3 bucket name
            key: S3 object key
            expiry: URL expiry time in seconds (default: 1 hour)

        Returns:
            Pre-signed URL for the S3 object
        """
        return self.s3.generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=expiry)

    def _get_media_info_from_key(self, input_descriptor: S3Record) -> tuple[UUID, UUID]:
        data = input_descriptor.key.split("/")
        return UUID(data[2]), UUID(data[4])

    def process_video(self, input_descriptor: S3Record) -> tuple[UUID, str]:
        """
        Process video from S3 using streaming

        Args:
            input_descriptor: S3 record containing input video information

        Returns:
            bool: True if processing was successful

        Raises:
            FFmpegError: If video processing fails
            BotoCoreError: If S3 operations fail
        """

        user_id, media_id = self._get_media_info_from_key(input_descriptor)

        self.logger.info("Starting video processing")

        source_media_key = input_descriptor.key
        target_media_key = re.sub(r"^uploads", "media", input_descriptor.key)

        # Generate pre-signed URL for input
        input_url = self._get_presigned_url(input_descriptor.bucket, source_media_key)
        output_path = f"s3://{self.target_bucket}/{target_media_key}"

        with ExitStack() as stack:
            temp_dir = stack.enter_context(TemporaryDirectory())
            progress_queue = Queue()

            passlogfile_dir = Path(temp_dir) / "passes"
            passlogfile_dir.mkdir(exist_ok=True)
            passlogfile = passlogfile_dir / "ffmpeg2pass"

            try:
                # Generate and upload thumbnail
                self.logger.info("Generating thumbnail")
                thumbnail_path = Path(temp_dir) / "thumbnail.jpg"
                extract_thumbnail(input_url, str(thumbnail_path), width=270, height=150)

                # Create thumbnail key with prefix
                thumbnail_key = f"{os.path.dirname(target_media_key)}/thumbnail_270_150_{media_id}.jpg"

                # Upload thumbnail to S3
                self.logger.info(f"Uploading thumbnail to {self.target_bucket}/{thumbnail_key}")
                with open(thumbnail_path, "rb") as thumbnail_file:
                    self.s3.upload_fileobj(
                        thumbnail_file, self.target_bucket, thumbnail_key, ExtraArgs={"ContentType": "image/jpeg"}
                    )
                self.logger.info("Thumbnail uploaded successfully")

                # First pass with progress monitoring
                self.logger.info("Starting first pass")
                progress_r1, progress_w1 = os.pipe()
                os.set_inheritable(progress_w1, True)

                # Start progress monitoring thread for first pass
                progress_thread1 = threading.Thread(
                    target=self._monitor_progress, args=(progress_r1, progress_queue, 1), daemon=True
                )
                progress_thread1.start()

                stream_pass1 = (
                    ffmpeg.input(input_url, protocol_whitelist="https,tls,tcp,file")
                    .filter("scale", -1, self.target_height)
                    .filter("fps", fps=30, round="down")
                    .output("pipe:", **self._get_codec_settings(VideoCodec.H264, pass_number=1))
                )

                process1 = self._run_ffmpeg_pass(stream_pass1, str(passlogfile), progress_w1)

                # Close write end in parent
                os.close(progress_w1)

                # Wait for first pass to complete
                stderr_output = process1.stderr.read().decode()
                return_code = process1.wait()
                progress_thread1.join()

                if return_code != 0:
                    raise FFmpegError(f"First pass failed with code {return_code}: {stderr_output}")

                self.logger.info("First pass completed successfully")

                # Second pass with progress monitoring
                self.logger.info("Starting second pass")
                progress_r2, progress_w2 = os.pipe()
                os.set_inheritable(progress_w2, True)

                # Start progress monitoring thread for second pass
                progress_thread2 = threading.Thread(
                    target=self._monitor_progress, args=(progress_r2, progress_queue, 2), daemon=True
                )
                progress_thread2.start()

                stream_pass2 = (
                    ffmpeg.input(input_url, protocol_whitelist="https,tls,tcp,file")
                    .filter("scale", -1, self.target_height)
                    .filter("fps", fps=30, round="down")
                    .output("pipe:", **self._get_codec_settings(VideoCodec.H264, pass_number=2))
                )

                process2 = self._run_ffmpeg_pass(stream_pass2, str(passlogfile), progress_w2)

                # Close write end in parent
                os.close(progress_w2)

                # Initialize multipart upload
                self.logger.info(f"Initiating multipart upload to {output_path}")
                upload = self.s3.create_multipart_upload(
                    Bucket=self.target_bucket, Key=target_media_key, ContentType="video/mp4"
                )

                # Upload parts
                parts = list(self._create_upload_parts(process2, upload["UploadId"], target_media_key))

                # Complete upload
                self.s3.complete_multipart_upload(
                    Bucket=self.target_bucket,
                    Key=target_media_key,
                    UploadId=upload["UploadId"],
                    MultipartUpload={"Parts": parts},
                )

                # Wait for process and thread
                stderr_output = process2.stderr.read().decode()
                return_code = process2.wait()
                progress_thread2.join()

                if return_code != 0:
                    raise FFmpegError(f"Second pass failed with code {return_code}: {stderr_output}")

                self.logger.info("Video processed successfully!")

            except (FFmpegError, BotoCoreError) as e:
                self.logger.error("Error processing video: %s", e)
                try:
                    self.s3.abort_multipart_upload(
                        Bucket=self.target_bucket, Key=input_descriptor.key, UploadId=upload["UploadId"]
                    )
                except Exception as abort_error:
                    self.logger.error("Error aborting multipart upload: %s", abort_error)
                raise e

        video_info = self._get_video_info(input_url)

        self.logger.info("Updating the media state in the database")
        update_video_status(
            media_id,
            target_media_key,
            thumbnail_key,
            frames_count=video_info["frame_count"],
            duration_sec=video_info["duration_seconds"],
        )
        self.logger.info(f"Status of media updated: {media_id}")

        return media_id, target_media_key
