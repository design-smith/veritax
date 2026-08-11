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
- [x] **S04 — Evidence interactions** — DONE.
  - `lib/analytics/events.ts`: pure category builders (`documentType`, `documentCategory`, `scopeFilterValue`) so filenames/scope never reach analytics; `lib/analytics/index.ts` adds `evidenceDocumentOpened`, `evidenceSourceViewed`, `evidenceFactInspected`, `evidenceFilterUsed` (each notes an interaction for stage `interaction_count`).
  - Wired to the real inspection surfaces: Risks source preview (`openSource` → `evidence_document_opened` + `evidence_source_viewed`; copy-only path → `evidence_source_viewed`; `selectSourceFact` → `evidence_fact_inspected`) and the Planning per-file / per-connection scope dropdown (`evidence_filter_used` with `document_scope`/`connection_scope`).
  - **Mapping note (transparency, not a PRD change):** the demo has no standalone Evidence screen; the §10 evidence-depth events fire where documents/facts/quotes are actually inspected (Risks preview) and where evidence is filtered (Planning scope). These are distinct from S05 `requirement_evidence_opened` / S07 `risk_evidence_opened`, consistent with the PRD listing them as separate events (§24). Facts are `[]` in the demo dataset, so `evidence_fact_inspected` is instrumented but only fires if facts exist.
  - Verification: `pnpm test` **15/15 pass** (added builder tests incl. no-content assertions); `tsc` clean; `pnpm build` clean; `/demo` + `/signup` serve 200.
- [x] **S05 — Requirements + jurisdiction comparison** — DONE.
  - `lib/analytics/events.ts`: `trackJurisdictionComparison` (pure, fires once when ≥2 distinct jurisdictions inspected). `lib/analytics/index.ts` adds `requirementsCountrySelected`, `requirementOpened`, `requirementEvidenceOpened`, `jurisdictionComparisonUsed`.
  - Wired in `requirements.tsx`: `selectJurisdiction` → `requirements_country_selected` (+ seeds/uses the comparison tracker → `jurisdiction_comparison_used` once); opening a requirement row → `requirement_opened` (`requirement_category`=requirement_key, `criticality`=conditional/required) and, when the row has evidence, `requirement_evidence_opened` (document_type category).
  - Verification: `pnpm test` **16/16 pass** (added comparison-threshold test: fires on 2nd distinct jurisdiction, not the 1st, once per run); `tsc` clean; `pnpm build` clean; `/demo` + `/signup` 200.
- [~] **S06 — Local File generation + sections + citations** — MOSTLY DONE (5/6 events); `citation_opened` blocked on a demo-UI decision.
  - `lib/analytics/events.ts`: pure `sectionLifecycle` (ordered per-section payloads + even duration split). `lib/analytics/index.ts` adds `localFileGenerationStarted/Completed`, `localFileSectionStarted/Completed/Viewed`, `localFileCitationOpened`.
  - `draft.tsx`: `local_file_generation_started` once per jurisdiction/run in `startJurisdiction`; a completion effect emits `local_file_section_started/completed` (via `sectionLifecycle`) + `local_file_generation_completed` once per jurisdiction. `DraftDocument.tsx`: `local_file_section_viewed` fired from the IntersectionObserver (threshold 0.18 + rootMargin band → meaningful visibility, not below-fold/on-mount for off-screen sections), deduped per `jurisdiction:section`.
  - **BLOCKED — `local_file_citation_opened` + `local_file_section_expanded`:** the demo draft renders **no citation UI** (`DraftSection.citations` is unused and demo-api returns `citations: []`) and sections aren't collapsible. The helper exists and is ready, but there's no clickable citation to wire it to. Adding a citations surface (data in `demo-api` + a citation chip in `DraftDocument`) is a demo-UI/product change — **decision needed** (add a citations surface, or accept `citation_opened` as dormant). Not marking S06 fully complete.
  - Verification (implemented events): `pnpm test` **18/18 pass** (added `sectionLifecycle` order/duration/empty tests); `tsc` clean; `pnpm build` clean; `/demo` + `/signup` 200.
- [x] **S07 — Risks interactions** — DONE.
  - `lib/analytics/events.ts`: pure `riskProps` (risk_type=kind, risk_category=opaque finding id — good for "most opened risks", severity; never title/description/exposure text). `lib/analytics/index.ts`: reusable `firedOncePerRun` guard (also refactored `trackDemoStarted` onto it); `risksViewed` (once per run), `riskOpened`, `riskEvidenceOpened`, `riskRecommendationOpened`.
  - `risks.tsx`: `risks_viewed` fired from an IntersectionObserver on the risks root (threshold 0.25 → only when the screen is actually on-screen, not merely mounted; once per run). Finding row open → `risk_opened` + `risk_recommendation_opened` (when the finding has recommendations, which the panel shows on open). `openSource` → `risk_evidence_opened` (high-intent, on the open/copy of a finding's evidence). No narrative/exposure text in any payload.
  - Verification: `pnpm test` **19/19 pass** (added `riskProps` no-content test); `tsc` clean; `pnpm build` clean; `/demo` + `/signup` 200.
- [x] **S08 — Waitlist request-access backend + /signup wiring** — DONE.
  - **No persistence decision needed:** the backend uses `Base.metadata.create_all` on startup (no Alembic — `db.py` says so), so a new model auto-creates its table.
  - Backend: `WaitlistRequest` model (`waitlist_requests`: name/country/email/company + `lead_id` + `attribution` JSONB + `created_at`); `WaitlistRequestCreate`/`WaitlistResponse` schemas (required fields via `Field(min_length=1)`); **public** `POST /waitlist` router (`routers/waitlist.py`) registered in `main.py` **without** `get_current_user`; returns opaque `waitlist_user_id = "waitlist_<uuid>"` (never the email).
  - Frontend: `api.submitWaitlist` in `lib/api.ts`; `/signup` now POSTs on **Access** (busy state, friendly error that preserves input, existing success screen on 2xx), sending `lead_id`/`utm_*` attribution parsed from the URL (no PII in the URL).
  - Verification: backend `pytest tests/test_waitlist.py` **3/3 pass** (public/no-token access, opaque id ≠ email, missing+blank fields → 422) against the pgvector test DB (`:5544`); frontend `pnpm test` 19/19, `tsc` clean, `pnpm build` clean; `/demo` + `/signup` 200.
- [x] **S09 — CTA exposure/click + waitlist analytics + identify** — DONE.
  - `lib/analytics/events.ts`: pure `waitlistPersonProps` (identify person props — no email/name). `lib/analytics/index.ts`: `accessVeritaxCtaViewed` (once/run), `accessVeritaxClicked` (active+elapsed demo time), `waitlistStarted`/`waitlistCompleted`/`waitlistSubmissionFailed`, `identifyWaitlistUser` (posthog.identify by opaque `waitlist_user_id`, never email). Records `demoStartAt` (for elapsed) in `trackDemoStarted` and `firstDemoDate` on first demo load.
  - `risks.tsx`: the "Access Veritax Live" CTA fires `access_veritax_cta_viewed` via IntersectionObserver at ≥50% visibility (never on mount/below-fold, once per run) and `access_veritax_clicked` on click. `app/signup/page.tsx`: `waitlist_started` on form open, `waitlist_completed` + `identify()` on successful submit (using S08's returned id), `waitlist_submission_failed` on error. No form field contents sent to analytics.
  - Verification: `pnpm test` **20/20 pass** (added `waitlistPersonProps` no-PII test); `tsc` clean; `pnpm build` clean; `/demo` + `/signup` 200.
- [ ] **S10 — Dashboard + cohorts + KPIs + QA (HITL)** — NOT STARTED (requires the PostHog UI + real-session observation; loop stops here).
