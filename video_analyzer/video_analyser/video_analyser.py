import logging
from dataclasses import dataclass
from io import BytesIO
from math import ceil
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from lib.player_heatmap.player_heatmap import get_heatmap
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.spatial.distance import pdist
from tqdm.auto import tqdm
from ultralytics import YOLO


@dataclass
class ZoneStats:
    defence_share: float
    transition_share: float
    volley_share: float


@dataclass
class Player:
    id: int
    heatmap: list[tuple[tuple[int, int], int]]
    zone_stats: ZoneStats


@dataclass
class Detection:
    rally_id: int
    start_frame: int
    end_frame: int
    start_time: int
    end_time: int
    duration: int
    detection_count: int
    cluster_id: int
    players: dict[int, Player]


def detect_rallies_clustering(df_detections, min_detections=5, distance_threshold=2.0) -> list[Detection]:
    if len(df_detections) < min_detections:
        return []

    detections_sorted = df_detections.sort_values("timestamp_sec").reset_index(drop=True)

    X = detections_sorted[["timestamp_sec"]].values
    distances = pdist(X, metric="euclidean")
    Z = linkage(distances, method="single")
    cluster_labels = fcluster(Z, t=distance_threshold, criterion="distance")

    detections_sorted["cluster"] = cluster_labels
    cluster_counts = detections_sorted["cluster"].value_counts()
    valid_clusters = cluster_counts[cluster_counts >= min_detections].index.tolist()

    rallies = []
    for i, cluster_id in enumerate(valid_clusters):
        cluster_data = detections_sorted[detections_sorted["cluster"] == cluster_id]

        start_time = cluster_data["timestamp_sec"].min()
        end_time = cluster_data["timestamp_sec"].max()
        start_frame = cluster_data["frame"].min()
        end_frame = cluster_data["frame"].max()
        duration = end_time - start_time

        if duration < 3.0:
            # TODO: need some better limit
            continue

        rallies.append(
            Detection(
                rally_id=i + 1,
                start_frame=int(start_frame),
                end_frame=int(end_frame),
                start_time=int(start_time),
                end_time=int(ceil(end_time)),
                duration=int(ceil(end_time - start_time)),
                detection_count=len(cluster_data),
                cluster_id=cluster_id,
                players={},
            )
        )

    rallies.sort(key=lambda x: x.start_frame)
    for idx, _ in enumerate(rallies):
        rallies[idx].rally_id = idx + 1

    return rallies


class VideoAnalyser:
    def __init__(self, s3_client, bucket: str):
        self.s3 = s3_client
        self.bucket = bucket
        self.logger = logging.getLogger(__name__)

        self.model = YOLO("./models/player_yolo_12s.pt")
        self.model.to("mps")

    def _get_presigned_url(self, bucket: str, key: str, expiry: int = 3600) -> str:
        return self.s3.generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=expiry)

    def generate_thumbnails(self, media_key: str, media_url: str, detections: list[Detection]) -> list[str]:
        path = Path(media_key)
        file_prefix = path.parent

        self.logger.info("Generating clip thumbnails")
        if not detections:
            return []

        cap = cv2.VideoCapture(media_url)
        if not cap.isOpened():
            raise ValueError(f"Failed to open video stream from {media_url}")

        detections = sorted(detections, key=lambda x: x.start_frame)
        frames = [x.start_frame for x in detections]
        thumbnails = []

        try:
            current_frame = 0

            # Process until we've extracted all requested frames
            for target_frame in frames:
                # If we need to skip frames, set the position
                if target_frame > current_frame:  # Configurable seeking behavior
                    cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
                    current_frame = target_frame

                # Read the frame
                ret, frame = cap.read()

                if not ret:
                    raise RuntimeError("Failed to extract frame")

                # Resize while preserving aspect ratio and ensure 270x150 output
                target_width, target_height = 270, 150

                # Get original dimensions
                h, w = frame.shape[:2]

                # Calculate target dimensions that preserve aspect ratio
                if w / h > target_width / target_height:  # Original is wider
                    new_w = target_width
                    new_h = int(h * (target_width / w))
                else:  # Original is taller
                    new_h = target_height
                    new_w = int(w * (target_height / h))

                # Resize the image preserving aspect ratio
                resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)

                # Create a black canvas of target size
                canvas = np.zeros((target_height, target_width, 3), dtype=np.uint8)

                # Calculate position to center the resized image
                y_offset = (target_height - new_h) // 2
                x_offset = (target_width - new_w) // 2

                # Place the resized image on the canvas
                canvas[y_offset : y_offset + new_h, x_offset : x_offset + new_w] = resized

                # Store the thumbnail
                thumbnails.append(canvas)

        finally:
            cap.release()

        thumbnail_keys = []
        for detection, thumbnail in zip(detections, thumbnails, strict=False):
            thumbnail_key = f"{file_prefix}/thumbnail_270_150_clip_{detection.rally_id}.jpg"
            thumbnail_keys.append(thumbnail_key)

            success, buffer = cv2.imencode(".jpg", thumbnail)
            if not success:
                raise RuntimeError("Failed to encode thumbnail!")

            thumbnail_bytes = BytesIO(buffer)

            self.s3.upload_fileobj(thumbnail_bytes, self.bucket, thumbnail_key, ExtraArgs={"ContentType": "image/jpeg"})

        self.logger.info("   Thumbnails are uploaded")

        return thumbnail_keys

    def _detect_rallies(self, media_url) -> list[Detection]:
        # Open the video stream
        cap = cv2.VideoCapture(media_url)
        if not cap.isOpened():
            raise ValueError("Failed to open video stream")

        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        self.logger.info(f"Video dimensions: w={frame_width}, h={frame_height}, fps={fps}, frames={total_frames}")

        full_clip_detection = Detection(
            rally_id=0,
            start_frame=0,
            end_frame=total_frames,
            start_time=0,
            end_time=int(total_frames / fps),
            duration=int(total_frames / fps),
            detection_count=0,
            cluster_id=0,
            players={},
        )

        detections = []
        with tqdm(total=total_frames, desc="Detecting ball position") as progress_bar:
            while cap.isOpened():
                frame_number = int(cap.get(cv2.CAP_PROP_POS_FRAMES))

                timestamp_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
                timestamp_sec = timestamp_ms / 1000.0

                ret, frame_orig = cap.read()

                if not ret:
                    self.logger.info(f"Processing finished at frame {frame_number} of {total_frames}")
                    break

                frame = frame_orig

                results = self.model.predict(frame, conf=0.5, verbose=False)

                ball_detected = False
                for result in results:
                    for box in result.boxes:
                        class_id = int(box.cls[0])
                        if class_id == 0:  # ball
                            ball_detected = True

                if ball_detected:
                    detections.append(
                        {
                            "frame": frame_number,
                            "timestamp_sec": timestamp_sec,
                            "timestamp": f"{int(timestamp_sec // 60):02d}:{timestamp_sec % 60:.3f}",
                        }
                    )

                progress_bar.update(1)

        self.logger.info(f"Feature extraction finished: detections={len(detections)}")

        df_detections = pd.DataFrame(detections)

        self.logger.info("Identify rallies")
        rallies = detect_rallies_clustering(df_detections)
        self.logger.info(f"   {len(rallies)} rallies identified")
        return [full_clip_detection] + rallies

    def _build_zone_stats(self, coordinates) -> ZoneStats:
        total_value = 0
        volley_value = 0
        defence_value = 0
        transition_value = 0

        for [[x, y], intensity] in coordinates:
            norm = abs(y - 25) / 25

            total_value += intensity
            if norm < 0.4:
                volley_value += intensity
            elif norm > 0.7:
                defence_value += intensity
            else:
                transition_value += intensity

        if total_value == 0:
            return ZoneStats(volley_share=0, transition_share=0, defence_share=0)

        return ZoneStats(
            volley_share=volley_value / total_value,
            transition_share=transition_value / total_value,
            defence_share=defence_value / total_value,
        )

    def _populate_players(self, tracks, rallies: list[Detection]) -> None:
        df = pd.DataFrame(tracks).set_index("frame")
        for rally in rallies:
            rally_points = df[(df.index >= rally.start_frame) & (df.index <= rally.end_frame)]
            for player_id, player_data in rally_points.items():
                binned_coordinates = pd.Series(
                    [(np.clip(x // 10, 0, 25), np.clip(y // 10, 0, 50)) for x, y in player_data.dropna()]
                ).value_counts()

                rally.players[player_id] = Player(
                    id=player_id,
                    heatmap=[(x, y) for x, y in binned_coordinates.items()],
                    zone_stats=self._build_zone_stats([(x, y) for x, y in binned_coordinates.items()]),
                )

    def analyse_video(self, media_key, *, generate_thumbnails=True) -> tuple[list[Detection], list[str | None]]:
        self.logger.info(f"Processing video: {media_key}")
        media_url = self._get_presigned_url(self.bucket, media_key)

        tracks = get_heatmap(media_url)

        rallies = self._detect_rallies(media_url)

        self._populate_players(tracks, rallies)

        if generate_thumbnails:
            thumbnail_keys = self.generate_thumbnails(media_key, media_url, rallies)
        else:
            thumbnail_keys = [None] * len(rallies)

        return rallies, thumbnail_keys
