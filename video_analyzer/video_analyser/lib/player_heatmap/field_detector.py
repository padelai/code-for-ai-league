from pathlib import Path

import cv2
import numpy as np
import torch
from tqdm import tqdm
from ultralytics import YOLO

model_path = "./models/field_yolo_11s.pt"

# Full mapping of feature names to the dataset ids
feature_map = {
    "field-near-left": 0,
    "field-near-right": 1,
    "svc-near-left": 2,
    "svc-near-mid": 3,
    "svc-near-right": 4,
    "net-left": 5,
    "net-mid": 22,
    "net-right": 6,
    "svc-far-left": 7,
    "svc-far-mid": 8,
    "svc-far-right": 9,
    "field-far-left": 10,
    "field-far-right": 11,
    "net-left-top": 13,
    "net-right-top": 12,
    "door-left-near-bottom": 14,
    "door-left-near-top": 15,
    "door-left-far-top": 16,
    "door-left-far-bottom": 17,
    "door-right-near-bottom": 18,
    "door-right-near-top": 19,
    "door-right-far-top": 20,
    "door-right-far-bottom": 21,
}

# Ordered list of relevant features
relevant_features = [
    "field-near-left",
    "field-near-right",
    "svc-near-left",
    "svc-near-mid",
    "svc-near-right",
    "net-left",
    "net-mid",
    "net-right",
    "svc-far-left",
    "svc-far-mid",
    "svc-far-right",
    "field-far-left",
    "field-far-right",
]

relevant_feature_ids = [feature_map[x] for x in relevant_features]


def detect_field(video_path: Path | str) -> tuple[np.array, tuple[int, int]]:
    model = YOLO(model_path)
    # model.to('mps')

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError("Error: Cannot open video file.")

    video_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    video_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    sampling_rate = max(1, total_frames // 10)  # Adjust this value as needed

    keypoints = []

    with tqdm(total=total_frames, desc="Processing video frames") as pbar:
        # Read and display the video frame by frame
        while cap.isOpened():
            ret, frame_orig = cap.read()
            if not ret:
                print("End of video or cannot read frame.")
                break

            frame_number = int(cap.get(cv2.CAP_PROP_POS_FRAMES))
            if frame_number % sampling_rate != 0:
                continue

            frame = frame_orig
            # results = model.predict(frame, imgsz=640, conf=0.5)
            results = model.predict(frame, conf=0.5, verbose=False)

            prediction = results[0]

            features = prediction.keypoints.xyn.squeeze(0)[relevant_feature_ids]
            keypoints.append(features)

            pbar.update(sampling_rate)

    keypoint_sets = [k for k in keypoints if len(k) > 0]

    if not keypoint_sets:
        raise ValueError("Failed to detect field")

    keypoints_tensor = torch.stack(keypoint_sets)
    median_values, _ = torch.median(keypoints_tensor, dim=0)

    return median_values.numpy(), (video_width, video_height)
