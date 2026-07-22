# Veritax Backend — Sources stage

FastAPI + Postgres (pgvector) + MinIO. Persists the Planning "Sources" stage: entity + jurisdictions,
uploaded documents (bytes → object storage, metadata → relational Postgres, text → pgvector for
search), and a stubbed connector registry.

## Requirements

- Python 3.11+
- A Postgres instance with the **pgvector** extension available (you provide this)
- Docker (for MinIO object storage locally)
- A Voyage API key (`voyage-law-2` embeddings)

## Setup

```bash
cd backend
python -m venv .venv
./.venv/Scripts/python -m pip install -e ".[dev]"   # Windows
# source .venv/bin/activate && pip install -e ".[dev]"   # macOS/Linux

cp .env.example .env    # then edit DATABASE_URL + VOYAGE_API_KEY
```

### Object storage (MinIO)

With the Docker Compose plugin:

```bash
docker compose up -d minio
```

Without it (this machine), use plain `docker run`:

```bash
docker run -d --name veritax-minio -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

The `veritax-sources` bucket is created automatically on startup (or make it in the console at
http://localhost:9001).

### Run

```bash
./.venv/Scripts/python -m uvicorn app.main:app --reload   # http://localhost:8000
```

Tables + the pgvector extension + connector seed are created on startup (`init_db`). Point the
frontend at it with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.

## Tests

Tests need a pgvector Postgres and use a **fake** embedder + in-memory storage (no Voyage key / no
MinIO needed).

```bash
docker run -d --name veritax-testpg -p 5434:5432 \
  -e POSTGRES_USER=veritax -e POSTGRES_PASSWORD=veritax -e POSTGRES_DB=veritax_test \
  pgvector/pgvector:pg16

TEST_DATABASE_URL="postgresql+asyncpg://veritax:veritax@localhost:5434/veritax_test" \
  ./.venv/Scripts/python -m pytest -q
```

## API

| Method | Path | Purpose |
|--------|------|---------|
| POST   | `/engagements` | create a planning session → `{id}` |
| GET    | `/engagements/{id}` | full aggregate (entity, jurisdictions, sources+documents) |
| PATCH  | `/engagements/{id}` | set entity_name / jurisdictions / website_url |
| POST   | `/engagements/{id}/documents` | multipart `kind` + `files[]`; store + background embed |
| GET    | `/documents/{id}` | poll status (`uploaded`→`embedding`→`embedded`/`failed`) |
| DELETE | `/documents/{id}` | remove a document |
| POST   | `/engagements/{id}/sources` | connected stub (`connector_provider`) or public `reference` (`url`) |
| GET    | `/connectors` | seeded registry (8 providers, all `available`) |
| GET    | `/search?q=&engagement_id=` | minimal cosine kNN over chunks — findability only, NOT RAG |

## Scope / notes

- Vectorization is for **findability**, not requirement-checking; later stages read documents
  directly. No retrieve-and-stuff RAG here.
- Connectors are **model + registry only** — no OAuth. `connector_selected_files` exists (unused)
  for the future "pick specific files, not the whole account" flow.
- `ponytail:` schema via `create_all` (not Alembic yet), FastAPI `BackgroundTasks` (not Celery),
  naive word-window chunker. Upgrade paths noted in code. Single-tenant, no auth.
