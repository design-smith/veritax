# S10 — PostHog build-out + QA (HITL execution guide)

This is the step-by-step to finish **S10** in the PostHog UI. Everything the app emits (S02–S09) is
already shipped; this doc only covers what you click in PostHog plus the real-session validation that
can't be done headlessly. Project: **id `551932`, US Cloud, `https://us.i.posthog.com`**.

The north-star question is not traffic. It's: **does experiencing the demo make a prospect want the real
product?** So the two KPIs that matter most are CTA-click conversion **among people who saw the CTA** and
**among people who reached Risks** — see [§6](#6-kpi-definitions).

---

## 0. Prerequisites (turn it on + confirm events land)

1. In production (Vercel), set the env vars so analytics actually runs:
   - `NEXT_PUBLIC_POSTHOG_KEY` = the demo project client token (already in gitignored `.env.local`)
   - `NEXT_PUBLIC_POSTHOG_HOST` = `https://us.i.posthog.com`
   - `NEXT_PUBLIC_POSTHOG_ENABLED` = `true`
   - (optional, dev only) `NEXT_PUBLIC_ANALYTICS_DEBUG` = `true` to log every capture to the console
2. Redeploy. Analytics initializes **only** on `/demo` and `/signup` (by design — keeps this project clean).
3. **Confirm live delivery** (this is the S02–S09 "live event" verification that was deferred to here):
   open `/demo` in a normal browser, then PostHog → **Activity** (live events). You should see `demo_started`,
   `$pageview`, `$autocapture`, and stage events streaming in with `demo_version = 2026-08-v1` and
   `product_surface = demo`. Walk the full demo through `/signup` and watch each custom event appear.

Until step 3 shows events arriving, **do not build tiles** — you'd be building on an empty dataset.

---

## 1. Event catalog (what the app emits)

Every custom event below also carries these **common props** (set in `commonProps()`):
`demo_version`, `product_surface="demo"`, `demo_run_id`, `stage`, `previous_stage`, `is_returning_visitor`,
`viewport_category`, and acquisition props `utm_*`, `campaign`, `entry_source`, `lead_id`, `referrer`.

| Event | Key props (beyond common) | Cardinality |
|-------|---------------------------|-------------|
| `demo_started` | `entry_stage` | once/run |
| `demo_stage_entered` | (stage/previous_stage from common) | per transition |
| `demo_stage_completed` | `active_time_ms`, `elapsed_time_ms`, `interaction_count`, `stage` | per stage exit |
| `stage_scroll_depth_reached` | `stage`, `depth_percent` (25/50/75/90/100) | once per depth/stage/run |
| `evidence_document_opened` | `document_type`, `document_category`, `document_id` | per open |
| `evidence_source_viewed` | `document_type`, `locator_type`, `fact_type?` | per view |
| `evidence_fact_inspected` | `fact_type`, `scope_level`, `document_type` | per inspect (demo facts are `[]`, rare) |
| `evidence_filter_used` | `filter_type`, `filter_value` | per change |
| `requirements_country_selected` | `country_code`, `previous_country_code` | per switch |
| `requirement_opened` | `country_code`, `requirement_category`, `requirement_status`, `criticality` | per open |
| `requirement_evidence_opened` | + `document_type` | per open |
| `jurisdiction_comparison_used` | `country_codes`, `country_count` | once/run (≥2 distinct) |
| `local_file_generation_started` | — | per jurisdiction/run |
| `local_file_generation_completed` | `section_count`, `generation_duration_ms` | per jurisdiction |
| `local_file_section_started` | `section_key`, `section_index` | per section |
| `local_file_section_completed` | + `generation_duration_ms` | per section |
| `local_file_section_viewed` | `section_key`, `section_index` | once per section/run |
| `local_file_citation_opened` | `section_key`, `citation_source_type` | **DORMANT** (S06 blocked — no citation UI) |
| `risks_viewed` | — | once/run |
| `risk_opened` | `risk_type`, `severity`, `risk_category` | per open |
| `risk_evidence_opened` | + `evidence_type` | per open |
| `risk_recommendation_opened` | `risk_type`, `severity`, `risk_category` | per open |
| `access_veritax_cta_viewed` | `active_demo_time_ms` | once/run (IO ≥50%) |
| `access_veritax_clicked` | `active_demo_time_ms`, `elapsed_demo_time_ms` | per click |
| `waitlist_started` | — | once/run |
| `waitlist_completed` | — (+ triggers `identify()`) | once/run |
| `waitlist_submission_failed` | — | per failure |

Plus autocapture: `$pageview`, `$pageleave`, `$autocapture`, session recordings, heatmaps.

**Identify person props** (set on `waitlist_completed`, keyed by opaque `waitlist_user_id`, never email):
`waitlist_status="requested"`, `first_demo_date`, `acquisition_source`, `campaign`.

> Note on run-scoping: most funnel steps are **once per `demo_run_id`**. For funnel insights, aggregate the
> funnel **by `demo_run_id`** (not by person) — anonymous visitors have no person until they hit the waitlist,
> so person-level aggregation understates the top of the funnel.

---

## 2. Primary funnel (build first)

Insights → **New insight** → **Funnel**. Aggregating by **`demo_run_id`**. Conversion window: **30 minutes**
(one sitting). Steps, in order:

1. `demo_started`
2. `demo_stage_entered` where `stage = evidence`
3. `demo_stage_entered` where `stage = requirements`
4. `local_file_generation_started`
5. `local_file_generation_completed`
6. `risks_viewed`
7. `access_veritax_cta_viewed`
8. `access_veritax_clicked`
9. `waitlist_started`
10. `waitlist_completed`

Save as **"Demo → Waitlist (primary funnel)"**. This single insight gives you the whole drop-off story.
Add a **breakdown by `entry_source`** (and duplicate with breakdown by `viewport_category`) to see which
channels and devices convert.

---

## 3. Dashboard tiles ("Veritax Demo")

Create a dashboard **"Veritax Demo"** and add these insights. Each line = one insight; the type is in brackets.

**Activation & reach**
- [Funnel] the primary funnel from §2 (pin it top-left).
- [Trends] `demo_started` — count, by day. Add breakdown by `is_returning_visitor` and by `entry_source`.
- [Trends] Unique `demo_run_id` reaching each stage: series for `demo_stage_entered` broken down by `stage`.

**Stage drop-off & depth**
- [Funnel] stage-only funnel: `demo_stage_entered(evidence)` → `(requirements)` → `local_file_generation_completed` → `risks_viewed`.
- [Trends] median `active_time_ms` from `demo_stage_completed`, broken down by `stage` (property value → **median**). This is the **active** engagement number, not elapsed.
- [Trends] `stage_scroll_depth_reached` broken down by `stage` + `depth_percent` — how far people actually read each stage.

**Content engagement (what they inspect = intent signal)**
- [Trends] `risk_opened` broken down by `risk_category` — the "most-opened risks" (opaque ids, useful ranking).
- [Trends] `requirement_opened` broken down by `country_code` and by `requirement_status`.
- [Trends] `requirements_country_selected` broken down by `country_code` — most-explored jurisdictions.
- [Trends] `evidence_document_opened` broken down by `document_type` — which evidence types draw clicks.
- [Trends] `jurisdiction_comparison_used` count — how many runs actually compare ≥2 jurisdictions.

**Friction**
- [Trends] `waitlist_submission_failed` — count by day (should be ~0; a spike = backend/CORS problem).
- [Funnel] `waitlist_started` → `waitlist_completed` — form abandonment.
- [Trends] `$pageleave` on `/signup` without a following `waitlist_completed` (or read it off the funnel above).

**Conversion (the KPIs)**
- [Funnel] `access_veritax_cta_viewed` → `access_veritax_clicked` (CTA-viewer conversion).
- [Funnel] `risks_viewed` → `access_veritax_clicked` (Risks-reacher conversion).
- [Trends] `waitlist_completed` count by day, breakdown by `acquisition_source`.

---

## 4. Cohorts

People → Cohorts → **New cohort** (behavioral, not static). Because pre-waitlist visitors are anonymous, use
these mainly for replay filtering and post-hoc analysis of identified waitlist users.

- **`reached_risks`** — performed `risks_viewed` in the last 30 days.
- **`viewed_cta_no_click`** — performed `access_veritax_cta_viewed` **and did not perform** `access_veritax_clicked`. These are the warm-but-unconverted; the best replay-watching cohort.
- **`completed_waitlist`** — performed `waitlist_completed` (identified people; `waitlist_status = requested`).
- **`high_intent`** — performed `risk_opened` **or** `requirement_evidence_opened` at least twice. Deep inspectors.
- **`bounced_early`** — performed `demo_started` but **not** `demo_stage_entered(requirements)`.

For replay triage, open **Session Replay** and filter by the `viewed_cta_no_click` cohort — that's where the
qualitative "why didn't they click?" answer lives.

---

## 5. Session replay / heatmaps / privacy validation (real-session)

This is the part that genuinely needs a human at the PostHog UI. Do a full real run first (§0.3), then:

- [ ] **Replay exists** — Session Replay lists your run; scrub it end to end.
- [ ] **Input masking works** — on the `/signup` recording, the name/country/email/company fields render as
      masked blocks, **not** the text you typed (`maskAllInputs: true`). This is the hard privacy gate.
- [ ] **Heatmaps/clickmaps** — open the toolbar heatmap on `/demo`; clicks register on the tabs, rows, and the
      "Access Veritax Live" CTA. Scrollmap shows fold depth.
- [ ] **Autocapture** — `$autocapture` clicks are present alongside the custom events.

---

## 6. KPI definitions

Compute from the funnels above (all aggregated by `demo_run_id` except the identified-person ones).

| KPI | Formula | Where |
|-----|---------|-------|
| **CTA-viewer conversion** (north star) | `access_veritax_clicked` / `access_veritax_cta_viewed` | §3 Conversion funnel #1 |
| **Risks-reacher conversion** (north star) | `access_veritax_clicked` / `risks_viewed` | §3 Conversion funnel #2 |
| Demo → waitlist | `waitlist_completed` / `demo_started` | §2 primary funnel end-to-end |
| Stage completion (per stage) | `demo_stage_entered(next)` / `demo_stage_entered(this)` | §3 stage funnel |
| Form completion | `waitlist_completed` / `waitlist_started` | §3 Friction |
| Median active demo time | median `active_time_ms` summed across `demo_stage_completed` | §3 depth tile |
| Generation completion | `local_file_generation_completed` / `local_file_generation_started` | §2 steps 4→5 |

---

## 7. End-to-end QA checklist (S10 acceptance)

Run one clean demo (fresh browser / cleared storage), then confirm in **Activity**:

- [ ] **No-PII** — spot-check payloads of `waitlist_completed`, `requirement_opened`, `risk_opened`,
      `evidence_document_opened`: only ids/categories/types, **no** names, emails, filenames, quotes, risk
      narrative, or form field contents. `identify` distinct_id is `waitlist_<uuid>`, never an email.
- [ ] **Dedupe / once-per-run** — `demo_started`, `risks_viewed`, `jurisdiction_comparison_used`,
      `access_veritax_cta_viewed`, `waitlist_started`, `waitlist_completed` each appear **once** for the run's
      `demo_run_id`, even after a page reload.
- [ ] **CTA gate** — `access_veritax_cta_viewed` fires only when the CTA is actually ≥50% on-screen, **not** on
      mount / while below the fold.
- [ ] **Active vs elapsed** — background the tab mid-stage; `active_time_ms` on the next `demo_stage_completed`
      excludes the hidden time while `elapsed_time_ms` includes it.
- [ ] **Run continuity** — `demo_run_id` is identical across `/demo` and `/signup` in the same run.
- [ ] **Identify** — after submitting the waitlist, the anonymous person becomes identified with
      `waitlist_status=requested`, `first_demo_date`, `acquisition_source`, `campaign`.
- [ ] **Funnel sanity** — the primary funnel (§2) shows a monotonic drop with non-zero conversion at each step.

When every box is checked, mark **S10 DONE** in [README.md](README.md) and note "live event delivery for
S02–S09 confirmed" (that closes the only remaining verification gap from those slices).

---

## 8. Still-open decision (carried from S06)

`local_file_citation_opened` is shipped but **dormant** — the demo draft renders no citation UI
(`DraftSection.citations` is unused; `demo-api` returns `citations: []`). To light it up you'd add canned
citations to the demo data plus a "Sources" affordance in `DraftDocument`, then the existing helper fires.
That's a demo-UI/product change, out of scope for S10. Decide separately: **add the citation surface**, or
**accept `citation_opened` as dormant** and drop its tile from this dashboard.
