# Vercel Demo Deployment

## Goal

Serve the clickable Veritax demo at:

`https://veritaxai.com/demo`

The existing `veritax.com/demo` landing page should stay separate.

## Repo Setup

- Vercel install command: `pnpm install --frozen-lockfile`
- Vercel build command: `pnpm build`
- Root `/` redirects to `/demo`
- `/demo` renders the Briefing start screen
- The clickable demo nav is limited to Briefing, Graph, Findings, Library, and Gathering

## Vercel Project Setup

1. Import or link this repository as its own Vercel project.
2. In the Vercel project, open Settings -> Domains.
3. Add `veritaxai.com`.
4. Configure the DNS records Vercel asks for at the domain registrar.
5. Wait for Vercel to mark the domain valid.
6. Deploy production from the intended branch.
7. Smoke-test `https://veritaxai.com/demo`.

## Smoke Checks

Expected `200`:

- `/demo`
- `/demo/briefing`
- `/demo/graph`
- `/demo/findings`
- `/demo/library`
- `/demo/gathering`

Expected `404` for removed Friday-cut pages:

- `/demo/factory`
- `/demo/monitor`
- `/demo/calendar`
- `/benchmark`

## Local Verification

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm test -- --reporter=dot
pnpm exec next dev -p 3001
```
