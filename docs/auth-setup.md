# Authentication setup (Supabase Auth — email OTP)

Login is **passwordless email OTP** via Supabase Auth (same project as the DB). **Sign up** collects a
name + email; **log in** is just an email. Both verify a **6-digit code** emailed to the address. The
Next.js frontend logs in; the FastAPI API verifies the access-token JWT on every request and scopes every
engagement to its owner (`user_id`). No social providers. These are the one-time dashboard + env steps.

Project: `https://rosgldmxgxlujoziztey.supabase.co`

## 1. URL configuration (Authentication → URL Configuration)

- **Site URL:** `https://app.veritaxai.com`.
- **Redirect URLs:** add `https://app.veritaxai.com/**`, any Vercel preview URLs you still use, and `http://localhost:3000/**`.

## 2. Email OTP as a 6-digit code (Authentication → Email Templates → "Magic Link")

By default Supabase emails a magic *link*. To send a **code** instead, edit the **Magic Link** template
body to include the token, e.g.:

```
Your Veritax sign-in code is: {{ .Token }}
```

The app calls `verifyOtp({ type: "email" })` with the code. (Built-in email has low send limits — fine
for a trial; configure custom SMTP for production.)

## 3. (Optional) Restrict sign-ups

Log-in only sends a code to existing accounts; sign-up creates the account (storing `full_name` in the
user's metadata). If you want to stop new self-serve accounts entirely, turn off
**Authentication → Sign In / Providers → Email → "Allow new users to sign up"** — but then create users
manually in the dashboard.

## 4. Keys / env

**Frontend** (`.env.local`, and Vercel → Settings → Environment Variables):

```
NEXT_PUBLIC_SUPABASE_URL=https://rosgldmxgxlujoziztey.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/public key from Settings → API>
```

**Backend** (`backend/.env`, and Render → Environment):

```
SUPABASE_URL=https://rosgldmxgxlujoziztey.supabase.co     # drives JWKS + issuer check
# Only if the project uses the LEGACY HS256 signing secret (Settings → API → JWT Settings):
SUPABASE_JWT_SECRET=<JWT secret>
```

The API auto-detects the signing scheme per token: modern projects use asymmetric keys (verified via
`{SUPABASE_URL}/auth/v1/.well-known/jwks.json` — no secret needed); legacy projects use the HS256
`SUPABASE_JWT_SECRET`. Set `SUPABASE_URL` in both cases; leave the secret blank first and only add it if
backend calls 401 with "SUPABASE_JWT_SECRET is not configured".

## 5. Verify

- Visit the app → redirected to `/login`. **Sign up** (name + email) → enter the emailed code → the
  workflow loads. **Sign out** → **Log in** with the same email → code → back in.
- API calls carry `Authorization: Bearer …` (Network tab); a second account can't open the first's
  engagement (404).

## Notes

- The person's name is stored in Supabase user metadata (`full_name`) at sign-up — no extra DB table.
- Pre-auth engagements have `user_id = NULL` and are invisible to everyone.
- Enforcement is in FastAPI (not Supabase RLS) — the frontend never queries Supabase directly for app data.
