# Veritax backend — FastAPI + async SQLAlchemy + pgvector. Runs on Fly.io (or any Docker host).
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ocrmypdf tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

# Install from project metadata (main deps only — no dev extras). Copy metadata + source, then build.
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .

# The `regulatory` package is a sibling top-level package (the deterministic rules registry). It runs from
# source and carries JSON data files, so copy the whole tree; PYTHONPATH=/app makes both `app` and `regulatory`
# importable from the copied source (not the shadowed wheel).
COPY regulatory ./regulatory
ENV PYTHONPATH=/app

# Host injects $PORT; bind to 0.0.0.0 (Fly internal_port must match). Local docker: 8000.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
