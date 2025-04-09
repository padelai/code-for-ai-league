FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN pip install --no-cache-dir uv

COPY pyproject.toml .
COPY uv.lock .
COPY README.md .
COPY video_processor video_processor/

# Install dependencies
RUN uv pip install --system hatchling
RUN uv pip install --system .

# Final stage
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    # libavcodec-extra \ # no need for av1 for now
    # Clean up to reduce image size
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-root user
RUN useradd -m -u 1000 appuser

# Copy only necessary files from builder
COPY --from=builder /usr/local/bin/ /usr/local/bin/
COPY --from=builder /usr/local/lib/python3.12/site-packages/ /usr/local/lib/python3.12/site-packages/
COPY --from=builder /app/video_processor ./video_processor/

# Set ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 8080

# Use uvicorn with recommended production settings
CMD ["python", "./video_processor/main.py"]
