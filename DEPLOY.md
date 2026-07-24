# Deploying Veritax

Two services:

- **Frontend** — Next.js on **Vercel** (already connected; auto-deploys on push to `main`).
- **Backend** — FastAPI on **Render** (this repo's `backend/`, via [`render.yaml`](render.yaml) + [`backend/Dockerfile`](backend/Dockerfile)).

Plus one managed dependency:

- **Database** — Supabase Postgres + `pgvector`.

**No object storage / S3 bucket is needed.** Uploaded files are written to the backend's local disk and read only once (during embedding, right after upload); everything after that reads from the database. On Render's free tier the disk is ephemeral, which is fine — by the time a file could be lost, its embeddings are already in the DB. (If you ever want durable file storage, set `S3_ENDPOINT_URL` + `S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET`/`S3_REGION` and it switches to S3/R2 automatically.)

Do the steps in order — the backend needs the DB values, and the frontend needs the backend URL.

---

## 1. Database — Supabase

1. Supabase → **Database → Extensions** → enable **`vector`**.
2. **Settings → Database → Connection string → Session pooler** (not the direct host — that's IPv6-only; the pooler is IPv4 and supports asyncpg's prepared statements). It looks like:
   ```
   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
3. Change the scheme to `postgresql+asyncpg://` — that's your **`DATABASE_URL`**:
   ```
   postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```

The backend creates its own tables on startup (`create_all`), so an empty database is fine.

---

## 2. Backend — Render

1. Render → **New → Blueprint** → connect this GitHub repo. It reads `render.yaml` and proposes the `veritax-backend` web service (free plan, Docker).
2. Fill in the environment variables (all `sync:false`, entered in the dashboard):

   | Env | Value |
   |---|---|
   | `DATABASE_URL` | from step 1 |
   | `DEEPSEEK_API_KEY` | your DeepSeek key |
   | `VOYAGE_API_KEY` | your Voyage key |
   | `CORS_ORIGINS` | your Vercel origin(s), e.g. `https://veritax.vercel.app` (comma-separated, **no trailing slash**) |

   No storage vars needed — the backend uses local disk unless you set the `S3_*` vars.

3. Deploy. The URL will be `https://veritax-backend.onrender.com`.
4. Verify: open `https://veritax-backend.onrender.com/health` → `{"ok": true}`.

---

## 3. Point the frontend at the backend — Vercel

Vercel → Project → **Settings → Environment Variables**:

| Env | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://veritax-backend.onrender.com` |
| `NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY` | your Syncfusion key |

`NEXT_PUBLIC_*` are inlined at build time, so **trigger a redeploy** after saving.

---

## Notes / gotchas

- **Cold starts**: the free Render service sleeps after ~15 min idle → the first request wakes it (~50 s). While the app is actively polling, it stays awake, so background jobs finish.
- **CORS** must match the Vercel origin exactly (scheme + host, no trailing slash). Add preview URLs too if you use them.
- If R2 rejects `CreateBucket` via the S3 API, just pre-create the `veritax-sources` bucket in the R2 dashboard — the app only needs it to exist.
- The backend is a **persistent** process on purpose: its assessment/draft jobs run in-process after the HTTP response, which serverless platforms would kill. Don't move it to Vercel functions / Cloud Run scale-to-zero.
