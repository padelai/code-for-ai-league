import ffmpeg


def extract_thumbnail(input_url, output_path, width=270, height=150):
    """
    Extract a thumbnail from a video and save it to the specified path

    Args:
        input_url: URL or path to the input video
        output_path: Path to save the thumbnail
        width: Thumbnail width in pixels
        height: Thumbnail height in pixels

    Returns:
        Path to the saved thumbnail
    """
    try:
        (
            ffmpeg.input(input_url, protocol_whitelist="https,tls,tcp,file")
            .filter("scale", width, height)
            .output(output_path, vframes=1)
            .overwrite_output()
            .run(quiet=True)
        )
        return output_path
    except ffmpeg.Error as e:
        raise Exception(f"Failed to extract thumbnail: {e.stderr.decode() if e.stderr else str(e)}") from e
