FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN pip install --no-cache-dir uv

# Copy project files
COPY pyproject.toml uv.lock .
COPY README.md .
COPY ballskicker_api ballskicker_api/

# Install dependencies
RUN uv pip install --system hatchling
RUN uv pip install --system .

# Final stage
FROM python:3.12-slim

WORKDIR /app

# Create non-root user
RUN useradd -m -u 1000 appuser

# Copy only necessary files from builder
COPY --from=builder /usr/local/bin/ /usr/local/bin/
COPY --from=builder /usr/local/lib/python3.12/site-packages/ /usr/local/lib/python3.12/site-packages/
COPY --from=builder /app/ballskicker_api ./ballskicker_api/

# Set ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

EXPOSE 8080

# Use uvicorn with recommended production settings
CMD ["uvicorn", "ballskicker_api.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--workers", "2"]
