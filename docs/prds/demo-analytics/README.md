# Veritax Demo Analytics & PostHog — Issue Breakdown (parent)

Source: **PRD "Veritax Demo Analytics & PostHog Instrumentation"**.

## Goal

Not website analytics. The one question: **does experiencing the demo make a prospect want the real product?**
So we instrument the conversion funnel and the high-intent inspection behavior that predicts intent, measure
**active** (not elapsed) engagement, and turn on replay/heatmaps for qualitative review. North-star KPIs are
CTA-click conversion **among CTA viewers** and **among Risks reachers** — not traffic.

## Decisions (resolved with product)

- **Evidence stage = the Planning tab.** Canonical stage 1 is `evidence`; the `evidence_*` inspection events
  fire on the Planning source rows/cards and the source-preview surfaces in Risks/Requirements.
- **Dedicated PostHog project** for the public demo (separate from any future production project).
- **Real backend waitlist endpoint.** `/signup` POSTs to a backend endpoint that persists the request and
  returns an opaque `waitlist_user_id`, used for `identify()`.

## Canonical stage names

```
evidence · requirements · local_file · risks · access_veritax · waitlist
```

Demo tab → stage: Planning→`evidence`, Requirements→`requirements`, Draft→`local_file`, Risks→`risks`.

## Primary funnel

```
demo_started → demo_stage_entered(evidence) → demo_stage_entered(requirements)
→ local_file_generation_started → local_file_generation_completed → risks_viewed
→ access_veritax_cta_viewed → access_veritax_clicked → waitlist_started → waitlist_completed
```

## Slice index

| # | Title | Type | Blocked by |
|---|-------|------|-----------|
| S01 | Provision dedicated demo PostHog project + env/secrets | HITL | — |
| S02 | Analytics foundation: init + central module + common props + `demo_started` | AFK | S01 |
| S03 | Stage lifecycle + active-time engine + scroll depth | AFK | S02 |
| S04 | Evidence interactions (Planning sources + source previews) | AFK | S03 |
| S05 | Requirements + jurisdiction comparison | AFK | S03 |
| S06 | Local File generation + sections + citations | AFK | S03 |
| S07 | Risks interactions | AFK | S03 |
| S08 | Waitlist request-access backend + /signup wiring | AFK | — |
| S09 | CTA exposure/click + waitlist analytics + `identify()` | AFK | S03, S08 |
| S10 | PostHog dashboard + funnels + cohorts + KPIs + end-to-end QA | HITL | S04–S09 |

Per-slice tests (PRD §39) and privacy checks (§30) live inside each slice's acceptance criteria, so every
slice stays a true vertical. `demo_version`, `product_surface="demo"`, and acquisition/returning/viewport
common props are established in S02 and inherited by every later event. S04–S07 depend only on S03 and can be
built in parallel.

## Status / verification log

- [x] **S01 — Provision PostHog project + env/secrets** — DONE.
  - Dedicated demo PostHog project provided (id `551932`, US Cloud, host `https://us.i.posthog.com`); client write-token stored in gitignored `.env.local`.
  - `.env.example` created documenting `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` / `NEXT_PUBLIC_POSTHOG_ENABLED` / `NEXT_PUBLIC_ANALYTICS_DEBUG`, defaulting `ENABLED=false` (disabled by default in dev).
  - Replay input-masking + autocapture/heatmaps are enforced in the SDK init config in S02 (`maskAllInputs`, session recording, autocapture).
  - Verification: config-only slice (no app code); `.env.example` present and documents all four vars; existing `pnpm build` remains green (unchanged by this slice).
- [x] **S02 — Analytics foundation + `demo_started`** — DONE.
  - Installed `posthog-js` + `vitest`. `lib/analytics/core.ts` = pure, injectable core (gating, dedupe, debug logging, common-prop merge, error-swallow — the only place events are shaped). `lib/analytics/index.ts` = browser singleton: env-gated `initAnalytics` (autocapture, `capture_pageview`/`pageleave`, `enable_heatmaps`, `session_recording.maskAllInputs`, `person_profiles: identified_only`), common props (`demo_version="2026-08-v1"`, `product_surface="demo"`, `demo_run_id` persisted in sessionStorage so it survives reload + /demo→/signup, UTM/referrer/lead_id attribution, `is_returning_visitor`, `viewport_category`).
  - `components/AnalyticsProvider.tsx` mounted in the root layout initializes **only** on `/demo` + `/signup` (keeps the demo project clean) and fires `demo_started` once per `demo_run_id` (sessionStorage guard across reloads + in-memory dedupe across rerenders).
  - Verification: `pnpm test` **7/7 pass** (fires-once, disabled-safe, debug-logs-without-sending, error-swallow, common-prop merge, no-PII payload, demo_started once-per-run); `npx tsc --noEmit` clean; `pnpm build` clean; production `next start` serves `/demo` + `/signup` 200 (`/` still 307→login) with no runtime errors.
  - Not observed here: live event arrival in PostHog (needs a browser + the PostHog UI) — deferred to S10 (HITL).
- [x] **S03 — Stage lifecycle + active-time + scroll depth** — DONE.
  - `lib/analytics/activeTime.ts`: pure `ActiveTimer` (visibility-gated total + per-stage ms + per-stage interaction counts) and `newlyCrossed` scroll-threshold helper.
  - `lib/analytics/index.ts`: `stageEntered`/`stageCompleted` (canonical `evidence/requirements/local_file/risks`; `demo_stage_entered` gets stage/previous_stage/demo_run_id from common props; `demo_stage_completed` carries `active_time_ms`, `elapsed_time_ms`, `interaction_count`); `startEngagementTracking` wires visibility/focus (pause/resume) + one capture-phase `scroll` listener that fires `stage_scroll_depth_reached` at 25/50/75/90/100 once per stage per run; sink now self-inits so event/provider ordering can't drop events. Common props extended with `stage`/`previous_stage`.
  - `components/AnalyticsProvider.tsx` starts engagement tracking on demo surfaces; `app/page.tsx` fires stage transitions (demo-only, ref-guarded so rerenders/StrictMode don't duplicate; re-entry re-fires → backtracking derivable).
  - Verification: `pnpm test` **11/11 pass** (added ActiveTimer hidden-time-excluded, per-stage buckets, interaction counts, scroll thresholds); `tsc` clean; `pnpm build` clean; `/demo` + `/signup` serve 200.
- [ ] S04 — Evidence interactions
- [ ] S05 — Requirements + jurisdiction comparison
- [ ] S06 — Local File generation + sections + citations
- [ ] S07 — Risks interactions
- [ ] S08 — Waitlist backend + /signup wiring
- [ ] S09 — CTA exposure/click + waitlist analytics + identify
- [ ] S10 — Dashboard + cohorts + KPIs + QA (HITL)
