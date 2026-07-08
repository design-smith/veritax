# Veritax Demo

Clickable frontend demo for the Veritax practitioner review.

The production target is:

`https://veritaxai.com/demo`

The existing landing page at `veritax.com/demo` is separate and should remain separate.

## Demo Scope

This repo ships the five-page Friday demo cut:

- Briefing
- Graph
- Findings
- Library / Document viewer
- Gathering

The demo is frontend-only. It uses fixture-backed data and local demo state, with no backend dependency.

## Routes

Primary demo routes:

- `/demo`
- `/demo/briefing`
- `/demo/graph`
- `/demo/findings`
- `/demo/library`
- `/demo/gathering`

Trust-moment detail routes:

- `/demo/findings/[id]`
- `/demo/library/[id]`

Removed Friday-cut routes should stay absent, including:

- `/demo/factory`
- `/demo/monitor`
- `/demo/calendar`
- `/benchmark`

## Local Development

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open:

`http://localhost:3000/demo`

If port 3000 is occupied:

```powershell
pnpm exec next dev -p 3001
```

## Verification

```powershell
pnpm build
pnpm test -- --reporter=dot
```

Expected smoke checks:

- `/demo` returns `200`
- `/demo/briefing` returns `200`
- `/demo/graph` returns `200`
- `/demo/findings` returns `200`
- `/demo/library` returns `200`
- `/demo/gathering` returns `200`
- `/demo/factory` returns `404`
- `/benchmark` returns `404`

## Vercel Deployment

This repo includes `vercel.json` with:

- install command: `pnpm install --frozen-lockfile`
- build command: `pnpm build`
- root redirect: `/` -> `/demo`

To deploy:

1. Import or link this repository as a Vercel project.
2. Add `veritaxai.com` in Vercel Project Settings -> Domains.
3. Configure the DNS records Vercel provides at the domain registrar.
4. Deploy production from `main`.
5. Smoke-test `https://veritaxai.com/demo`.

More detailed deployment notes live in `docs/vercel-demo-deploy.md`.
