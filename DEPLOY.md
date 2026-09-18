# Deploy Veritax

Two services + two managed deps. Do the steps in order.

| Layer | Host | URL |
|---|---|---|
| UI | Vercel | `https://app.veritaxai.com` |
| API | Fly.io (`backend/`) | `https://api.veritaxai.com` |
| Auth + Postgres + pgvector | Supabase (existing project) | — |
| Files | Cloudflare R2 | S3-compatible |

Do **not** use Render free (sleeps, ephemeral disk) or put the FastAPI/OCR process on Vercel.

---

## 1. Supabase — DB + Auth

Docs: [Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres), [pgvector](https://supabase.com/docs/guides/database/extensions/pgvector), [auth-setup](docs/auth-setup.md).

1. Dashboard → **Database → Extensions** → enable **`vector`**.
2. Click **Connect**. Copy the **Session pooler** URI (port **5432**, host like `aws-0-<region>.pooler.supabase.com`). Not the direct `db.*.supabase.co` host (IPv6-only unless you bought the IPv4 add-on) and not transaction mode on **6543** (asyncpg prepared statements).
3. Prefix the scheme with `+asyncpg`. URL-encode any special characters in the password:

   ```
   postgresql+asyncpg://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```

   That string is **`DATABASE_URL`**.
4. **Authentication → URL Configuration**
   - Site URL: `https://app.veritaxai.com`
   - Redirect URLs: `https://app.veritaxai.com/**`, `http://localhost:3000/**`, plus any `*.vercel.app` preview hosts you still use.
5. Keep using the same project URL + anon key already in `docs/auth-setup.md`. Tables are created on API boot (`create_all`); an empty DB is fine.

---

## 2. Cloudflare R2 — files

Docs: [R2 S3 API](https://developers.cloudflare.com/r2/get-started/s3/), [R2 tokens](https://developers.cloudflare.com/r2/api/tokens/).

1. R2 → create bucket `veritax-sources` (do this in the dashboard; the API `CreateBucket` call often fails on R2).
2. **Manage R2 API tokens → Create API token** → Object Read & Write, scoped to that bucket.
3. Copy **Access Key ID**, **Secret Access Key**, and the account endpoint:

   ```
   https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   ```

---

## 3. Fly.io — API

Docs: [Deploy a Dockerfile](https://fly.io/docs/languages-and-frameworks/dockerfile/), [fly.toml](https://fly.io/docs/reference/configuration/), [secrets](https://fly.io/docs/apps/secrets/), [custom domains](https://fly.io/docs/networking/custom-domain/).

Install [flyctl](https://fly.io/docs/flyctl/install/), then from `backend/` (so the Docker context is this folder, not the Next.js repo):

```bash
fly auth login
fly launch --no-deploy
```

Keep the committed `fly.toml` (app `veritax-api`, region `iad`, port **8000**). Do **not** add Fly Postgres. Then:

```bash
fly secrets set \
  DATABASE_URL='postgresql+asyncpg://…' \
  SUPABASE_URL='https://<project>.supabase.co' \
  VOYAGE_API_KEY='…' \
  DEEPSEEK_API_KEY='…' \
  S3_ENDPOINT_URL='https://<ACCOUNT_ID>.r2.cloudflarestorage.com' \
  S3_ACCESS_KEY='…' \
  S3_SECRET_KEY='…'

fly deploy
```

`S3_BUCKET` / `S3_REGION=auto` / `PORT=8000` are already in `fly.toml`. Add `SUPABASE_JWT_SECRET` only if API calls 401 with that message (legacy HS256). CORS for `*.veritaxai.com` and `*.vercel.app` is already in the image.

```bash
# https://<app>.fly.dev/health  →  {"ok":true}
# https://<app>.fly.dev/health/db  →  {"ok":true,"db":true}

fly certs add api.veritaxai.com
fly certs setup api.veritaxai.com
```

At your DNS host, add the **CNAME** (or A/AAAA) `fly certs setup` prints. Wait until `fly certs check api.veritaxai.com` is ready.

`auto_stop_machines` is **off** on purpose — OCR/embed/draft run in-process after the HTTP response.

---

## 4. Vercel — UI

Docs: [Environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables), [Add a domain](https://vercel.com/docs/domains/add-a-domain). `NEXT_PUBLIC_*` is inlined at **build** time ([Next.js env](https://nextjs.org/docs/app/guides/environment-variables)) — save vars, then **redeploy**.

1. Import this GitHub repo (root = Next.js app) if it is not already a Vercel project. Production branch: `main`.
2. Project → **Settings → Environment Variables** (Production + Preview):

   | Env | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public key |
   | `NEXT_PUBLIC_API_BASE_URL` | `https://api.veritaxai.com` |
   | `NEXT_PUBLIC_POSTHOG_KEY` | existing write-only token, or leave unset |
   | `NEXT_PUBLIC_POSTHOG_HOST` | `https://us.i.posthog.com` |
   | `NEXT_PUBLIC_POSTHOG_ENABLED` | `true` only if you want analytics live |

3. **Settings → Domains → Add** `app.veritaxai.com`. Add the **CNAME** Vercel shows (subdomains use CNAME, not an A record). Wait for **Valid Configuration**.
4. Redeploy Production.

---

## 5. Smoke

1. `https://api.veritaxai.com/health` and `/health/db`
2. Open `https://app.veritaxai.com` → sign up / OTP → land on company search
3. New engagement → upload a PDF → status reaches embedded
4. Planning → Draft produces text

If upload works but embed fails, check `fly logs` (Voyage key or R2 creds). If login works but API 401s, `SUPABASE_URL` on Fly does not match the frontend project.

---

Fallback if you skip Fly: Render **Starter** (not free) via `render.yaml`, then set the same secrets plus the `S3_*` vars and point `NEXT_PUBLIC_API_BASE_URL` at the Render URL.
