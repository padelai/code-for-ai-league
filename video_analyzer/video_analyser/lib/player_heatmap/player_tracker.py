import time
from dataclasses import dataclass

import numpy as np
from lib.tracker.ocsort import OCSort


@dataclass
class ModelDetection:
    pass


@dataclass
class PlayerTrack:
    id: int
    cls: int
    x1: int
    x2: int
    y1: int
    y2: int
    loc: tuple[int, int]


class PlayerTracker:
    def __init__(
        self,
        det_thresh=0.3,
        max_age=30 * 30,
        min_hits=1,
        iou_threshold=0.25,
        delta_t=3,
        asso_func="giou",
        inertia=0.15,
        use_byte=True,
    ):
        """
        Args:
            det_thresh: Detection confidence threshold
            max_age: Maximum frames to keep lost tracks
            min_hits: Minimum detections before track is initialized
            iou_threshold: IOU threshold for association
            delta_t: Time step for velocity calculation
            asso_func: Association metric: "iou", "giou", or "ciou"
            inertia: Motion inertia coefficient (lower for more responsive tracking)
            use_byte: Use ByteTrack association strategy
        """
        self.tracker = OCSort(
            det_thresh=det_thresh,
            max_age=max_age,
            min_hits=min_hits,
            iou_threshold=iou_threshold,
            delta_t=delta_t,
            asso_func=asso_func,
            inertia=inertia,
            use_byte=use_byte,
        )
        self.frame_size = None  # Will be set during first update
        self.frame_count = 0
        self.fps = 0
        self.start_time = time.time()

        # Debug tracking
        self.prev_track_count = 0
        self.debug_mode = False

    def _convert_detections(self, detections):
        """
        Convert different detection formats to OC-SORT compatible format.

        Args:
            detections: Either:
                - Ultralytics Results object from YOLO/RTDETR model
                - List of detections in format [x1, y1, x2, y2, score, class_id]
                - Numpy array of shape (N, 6) or (N, 5)

        Returns:
            Numpy array of shape (N, 5) with [x1, y1, x2, y2, score] format
            or empty array if no detections
        """
        # For frameinfo parameter
        if hasattr(detections, "orig_img") and self.frame_size is None:
            h, w = detections.orig_img.shape[:2]
            self.frame_size = (h, w)

        # Handle Ultralytics Results object
        if hasattr(detections, "boxes"):
            # For Ultralytics YOLO/RTDETR Results object
            boxes = detections.boxes
            if len(boxes) == 0:
                return np.array([])

            # Extract boxes in xyxy format and confidence scores
            # Convert normalized coordinates to absolute if needed
            if hasattr(boxes, "xyxy"):
                bboxes = boxes.xyxy.cpu().numpy()  # Already in absolute coordinates
            elif hasattr(boxes, "xywhn"):
                # Convert normalized xywh to absolute xyxy
                if hasattr(detections, "orig_shape"):
                    h, w = detections.orig_shape
                    xywhn = boxes.xywhn.cpu().numpy()
                    bboxes = np.zeros((len(xywhn), 4))
                    # Convert xywh to xyxy
                    bboxes[:, 0] = (xywhn[:, 0] - xywhn[:, 2] / 2) * w  # x1
                    bboxes[:, 1] = (xywhn[:, 1] - xywhn[:, 3] / 2) * h  # y1
                    bboxes[:, 2] = (xywhn[:, 0] + xywhn[:, 2] / 2) * w  # x2
                    bboxes[:, 3] = (xywhn[:, 1] + xywhn[:, 3] / 2) * h  # y2
                else:
                    # Fall back to xyxy if available
                    bboxes = boxes.xyxy.cpu().numpy() if hasattr(boxes, "xyxy") else np.array([])
            elif hasattr(boxes, "xyxyn"):
                # Convert normalized xyxy to absolute coordinates
                if hasattr(detections, "orig_shape"):
                    h, w = detections.orig_shape
                    xyxyn = boxes.xyxyn.cpu().numpy()
                    bboxes = np.zeros_like(xyxyn)
                    bboxes[:, 0] = xyxyn[:, 0] * w  # x1
                    bboxes[:, 1] = xyxyn[:, 1] * h  # y1
                    bboxes[:, 2] = xyxyn[:, 2] * w  # x2
                    bboxes[:, 3] = xyxyn[:, 3] * h  # y2
                else:
                    # Fall back to xyxy if available
                    bboxes = boxes.xyxy.cpu().numpy() if hasattr(boxes, "xyxy") else np.array([])

            # Get confidence scores
            if hasattr(boxes, "conf"):
                conf = boxes.conf.cpu().numpy()
                # Reshape to column vector if needed
                if len(conf.shape) == 1:
                    conf = conf.reshape(-1, 1)

                # Combine boxes and confidence
                if len(bboxes) > 0:
                    dets = np.hstack((bboxes[:, :4], conf))
                else:
                    dets = np.array([])
            else:
                # If no confidence available, use all 1.0 as confidence
                if len(bboxes) > 0:
                    conf = np.ones((len(bboxes), 1))
                    dets = np.hstack((bboxes[:, :4], conf))
                else:
                    dets = np.array([])

        elif isinstance(detections, list) and len(detections) > 0:
            # Convert list to numpy array if needed
            dets = np.array(
                [
                    [d[0], d[1], d[2], d[3], d[4] if len(d) >= 5 else 1.0]  # x1, y1, x2, y2, score
                    for d in detections
                ]
            )
        elif isinstance(detections, np.ndarray) and detections.shape[0] > 0:
            # If it's already a numpy array, ensure it has the right format
            if detections.shape[1] >= 6:  # If it includes class_id
                dets = detections[:, :5]  # Take only x1, y1, x2, y2, score
            elif detections.shape[1] >= 5:
                dets = detections[:, :5]
            elif detections.shape[1] >= 4:
                # Only bounding boxes, add confidence score of 1.0
                bboxes = detections[:, :4]
                conf = np.ones((len(bboxes), 1))
                dets = np.hstack((bboxes, conf))
            else:
                dets = np.array([])
        else:
            # No detections
            return np.array([])

        return dets

    def update(self, detections, frame=None) -> list[PlayerTrack]:
        """
        Update tracker with new detections.

        Args:
            detections: Either:
                - Ultralytics Results object from YOLO/RTDETR model
                - List of detections in format [x1, y1, x2, y2, score, class_id]
                - Numpy array of shape (N, 6) or (N, 5)
            frame: Optional frame for visualization

        Returns:
            List of tracked players with bbox and ID
        """
        # Increment frame counter for FPS calculation
        self.frame_count += 1

        # Calculate FPS every 30 frames
        if self.frame_count % 30 == 0:
            current_time = time.time()
            self.fps = 30 / (current_time - self.start_time)
            self.start_time = current_time

        class_ids = detections.boxes.cls.cpu().numpy()

        # Convert detections to standard format
        dets = self._convert_detections(detections)

        # Handle empty detections
        if len(dets) == 0:
            # Call update with empty detections to maintain track continuity
            empty_dets = np.zeros((0, 5))
            img_size = self.frame_size if self.frame_size is not None else (1080, 1920)
            self.tracker.update(empty_dets, img_info=img_size, img_size=img_size)
            return []

        if hasattr(detections, "orig_shape"):
            img_size = detections.orig_shape
            self.frame_size = img_size
        elif frame is not None:
            img_size = frame.shape[:2]  # h, w
            self.frame_size = img_size
        elif self.frame_size is not None:
            img_size = self.frame_size
        else:
            img_size = (720, 1280)
            self.frame_size = img_size

        # Debug print
        if self.debug_mode:
            if self.frame_count % 10 == 0:  # Print every 10 frames
                print(f"Frame {self.frame_count}: Found {len(dets)} detections")

        # Update tracker with required parameters
        try:
            tracks = self.tracker.update(dets, img_info=img_size, img_size=img_size)

            # Debug print
            if self.debug_mode and self.frame_count % 10 == 0:
                if len(tracks) != self.prev_track_count:
                    print(f"  Track count changed: {self.prev_track_count} -> {len(tracks)}")
                self.prev_track_count = len(tracks)
        except Exception as e:
            print(f"Error updating tracker: {e}")
            return []

        # Process tracking results
        tracked_players = []
        for t_idx, t in enumerate(tracks):
            x1, y1, x2, y2 = t[:4]
            track_id = int(t[4])  # ID
            class_id = int(class_ids[t_idx])

            estimated_player_coord = (int(x1 + (x2 - x1) / 2), int(y2 - (y2 - y1) * 0.1))

            tracked_players.append(
                PlayerTrack(
                    id=track_id,
                    cls=class_id,
                    x1=int(x1),
                    y1=int(y1),
                    x2=int(x2),
                    y2=int(y2),
                    loc=estimated_player_coord,
                )
            )

        return tracked_players
