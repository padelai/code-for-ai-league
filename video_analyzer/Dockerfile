FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock .
COPY README.md .
COPY video_analyser video_analyser/

# Install dependencies
RUN uv pip install --system hatchling
RUN uv pip install --system .

# Final stage
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN useradd -m -u 1000 appuser

COPY --from=builder /usr/local/bin/ /usr/local/bin/
COPY --from=builder /usr/local/lib/python3.12/site-packages/ /usr/local/lib/python3.12/site-packages/
COPY --from=builder /app/video_analyser ./video_analyser/

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

CMD ["python", "./video_analyser/main.py"]
