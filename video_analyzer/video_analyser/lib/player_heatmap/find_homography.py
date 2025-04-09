from pathlib import Path

import cv2
import numpy as np

from .field_detector import detect_field

PADDING = 20
WIDTH = 250
HEIGHT = 500
SL_MARGIN = 50

EXPECTED_FIELD_POINTS = (
    np.array(
        [
            [0, HEIGHT],
            [WIDTH, HEIGHT],
            [0, HEIGHT - SL_MARGIN],
            [WIDTH // 2, HEIGHT - SL_MARGIN],
            [WIDTH, HEIGHT - SL_MARGIN],
            [0, HEIGHT // 2],
            [WIDTH // 2, HEIGHT // 2],
            [WIDTH, HEIGHT // 2],
            [0, SL_MARGIN],
            [WIDTH // 2, SL_MARGIN],
            [WIDTH, SL_MARGIN],
            [0, 0],
            [WIDTH, 0],
        ]
    )
    + PADDING
)


def _get_processing_dimensions(video_width: int, video_height: int) -> tuple[int, int]:
    # TODO: do I still need that?
    TARGET_WIDTH = 1280
    TARGET_HEIGHT = 720

    aspect = video_width / video_height
    target_aspect = TARGET_WIDTH / TARGET_HEIGHT

    if aspect > target_aspect:
        new_width = TARGET_WIDTH
        new_height = int(new_width / aspect)
    else:
        new_height = TARGET_HEIGHT
        new_width = int(new_height * aspect)

    return (new_width, new_height)


def _find_points(image_dim, field_points) -> tuple[np.array, np.array]:
    mask = [x != 0.0 and y != 0.0 for x, y in field_points]
    return field_points * image_dim, mask


def _find_homography(image_dimensions: tuple[int, int], field_points: np.array) -> tuple[np.array, np.array]:
    absolute_points, mask = _find_points(image_dimensions, field_points)

    homography_src = absolute_points[mask]
    homography_dst = EXPECTED_FIELD_POINTS[mask]

    homography_matrix, status = cv2.findHomography(homography_src, homography_dst, method=cv2.USAC_ACCURATE)

    return homography_matrix, absolute_points


def find_homography(file_path: Path | str) -> tuple[np.array, np.array, tuple[int, int]]:
    field_points_rel, video_dims = detect_field(file_path)
    processing_dimensions = _get_processing_dimensions(*video_dims)

    homography_matrix, absolute_points = _find_homography(processing_dimensions, field_points_rel)

    return homography_matrix, absolute_points, processing_dimensions
