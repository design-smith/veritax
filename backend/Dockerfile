# Veritax backend — FastAPI + async SQLAlchemy + pgvector. Runs on Render (or any Docker host).
FROM python:3.12-slim

WORKDIR /app

# Install from project metadata (main deps only — no dev extras). Copy metadata + source, then build.
COPY pyproject.toml ./
COPY app ./app
RUN pip install --no-cache-dir .

# Render injects $PORT; bind to it (fall back to 8000 for local `docker run`).
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
