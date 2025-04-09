import logging
from collections import defaultdict

import cv2
import numpy as np
from tqdm.auto import tqdm
from ultralytics import RTDETR

from .find_homography import find_homography
from .player_tracker import PlayerTracker

logger = logging.getLogger(__name__)

PLAYER_MODEL_PATH = "./models/player_rtdetr.pt"


def _filter_tracks(xs):
    known_idx = {}
    mappings = {}
    filtered_dets = []

    for entry in xs:
        frame_n = entry["frame"]
        dets = {mappings.get(x, x): y for x, y in entry.items() if x != "frame"}
        dets = {k: v for k, v in dets.items() if k is not None}

        new_dets = set(dets.keys()) - set(known_idx.keys())
        if len(known_idx) + len(new_dets) == 4:
            for d in new_dets:
                known_idx[d] = d

        elif len(new_dets) == 1:
            current_key = next(iter(new_dets))

            known_key_to_map = set(known_idx.keys()) - set(dets.keys())
            if known_key_to_map:
                known_key = next(iter(known_key_to_map))

                mappings[current_key] = known_key
            else:
                mappings[current_key] = None

            dets = {mappings.get(x, x): y for x, y in entry.items() if x != "frame"}
            dets = {k: v for k, v in dets.items() if k is not None}

        else:
            print(f"{frame_n} -> {new_dets}")
            assert False, "Not implemented"

        dets["frame"] = frame_n
        filtered_dets.append(dets)
    return filtered_dets


def get_heatmap(media_url: str):
    logger.info("Preparing media heatmap")

    logger.info("Getting field homography")
    homography_matrix, field_points, video_dims = find_homography(media_url)

    logger.info("Processing player positions and building tracks")

    model = RTDETR(PLAYER_MODEL_PATH)
    _ = model.to("cuda")

    tracker = PlayerTracker(
        det_thresh=0.5,
        max_age=60 * 30,
        min_hits=3,
        iou_threshold=0.3,
        delta_t=3,
        asso_func="giou",
        inertia=0.2,
        use_byte=True,
    )

    cap = cv2.VideoCapture(media_url)
    if not cap.isOpened():
        raise ValueError(f"Failed to open video stream from {media_url}")

    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))

    logger.info(f"Video dimensions: w={frame_width}, h={frame_height}, fps={fps}, frames={total_frames}")

    track_history = defaultdict(list)

    detection_history = []

    with tqdm(total=total_frames, desc="Detecting player positions") as progress_bar:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                print("End of video or cannot read frame.")
                break

            frame_number = int(cap.get(cv2.CAP_PROP_POS_FRAMES))

            results = model.predict(frame, conf=0.5, verbose=False, classes=[2])  # Only getting players

            result = results[0]
            tracked_players = tracker.update(result)

            detections = {"frame": frame_number}

            for track in tracked_players:
                estimated_player_coord = (
                    int(track.x1 + (track.x2 - track.x1) / 2),
                    int(track.y2 - (track.y2 - track.y1) * 0.1),
                )
                transformed_player_coord = cv2.perspectiveTransform(
                    np.array([estimated_player_coord], dtype=np.float32).reshape(-1, 1, 2), homography_matrix
                )
                track_history[track.id].append(
                    (int(transformed_player_coord[0, 0, 0]), int(transformed_player_coord[0, 0, 1]))
                )

                detections[track.id] = (int(transformed_player_coord[0, 0, 0]), int(transformed_player_coord[0, 0, 1]))

            detection_history.append(detections)

            progress_bar.update(1)

    return _filter_tracks(detection_history)
