# Industry Analysis section for the Local File — slice tracker

Source: the `/to-issues` breakdown of the "Industry Analysis section" feature (Jayesh's requirement — a
contemporaneous, entity-specific industry analysis that gives context for the tested party's profitability,
positioned after Business Strategy, with a structured "research result" card + expandable sources).

## Scope (decided with the user)
- **Full real pipeline** (real web-research-backed section), added to all 3 demo jurisdictions
  (UAE/Singapore/South Africa) as a shared BPO/GCC analysis, with a research card + expandable sources.

## Resolved decision
- **Research provider = Anthropic Claude `web_search`** (user chose it + provided `ANTHROPIC_API_KEY`, stored in
  gitignored `backend/.env`). General drafter stays DeepSeek; only the Industry Analysis path uses Anthropic.
  Validated live in S2 (see log). Tavily/Serper path not needed.

## Key facts (from exploration)
- Draft sections are 1:1 with `resolve_requirements()`, drafted strictly from retrieved uploaded docs with
  strong citation/number validation (`backend/app/routers/draft.py:_validate_draft_result`). Industry Analysis
  needs a **distinct, web-enabled, non-gating** path.
- `DraftCitation` already supports `kind="web"` + `url` end-to-end.
- Active drafter is **DeepSeek** (no web search); `AnthropicDrafter` scaffolds web search but is dormant
  (`SYSTEM_PROMPT` is `web=False`, no `web_search` tool passed, no key).

## Slices

| # | Title | Type | Blocked by | Status |
|---|-------|------|-----------|--------|
| S1 | Demo Industry Analysis section + research card (frontend/demo, incl. `research` type) | AFK | — | ✅ DONE |
| S2 | Provider decision + web-cited-paragraph spike | HITL | — | ✅ DONE |
| S3 | Backend non-gating skeleton section injection + `research` column | AFK | S1, S2 | ✅ DONE |
| S4 | Real web-research generation for the section | AFK | S2, S3 | ✅ DONE |
| S5 | Quality guardrails (contemporaneous, specific, sourced) | AFK | S4 | ✅ DONE |

## Status / verification log

- [x] **S1 — Demo Industry Analysis section + research card** — DONE.
  - `lib/api.ts`: added `ResearchSummary`/`ResearchSource` types and an optional `research` field on `DraftSection` (absent on real-backend sections; only the demo populates it).
  - `lib/demo-api.ts`: `Topic` gains `"industry"`; `body("industry")` writes the 8 labelled sub-sections (definition → market → FY2024 conditions → competitive landscape → value drivers → risks → tested-party position → profitability bridge to TNMM), contemporaneous and entity-specific (no generic filler). `elementsFor()` now inserts `INDUSTRY_ELEM` **after Business Strategy** (or after the profile where there's no strategy element, e.g. Singapore) and renumbers, so Requirements + Draft stay consistent. The element carries a `INDUSTRY_RESEARCH` card (industry/market/period/trend/risk/competitors/impact + 7 web sources). `sections()` passes `research` through.
  - `components/steps/DraftDocument.tsx`: `ResearchCard` renders above the prose when `section.research` is present, with the labelled fields and an expandable "7 verified sources" list of clickable links. Real-app sections (no `research`) are unaffected.
  - **Verification:** `npx tsc --noEmit` clean; `pnpm build` clean; `pnpm test` **23/23** (3 new tests in `lib/demo-api.test.ts`: section position after Business Strategy, Singapore fallback after profile, 7-source card, contemporaneous "wage inflation" content, research attached only to Industry Analysis); production `/demo` serves 200.
  - Not covered by S1 (intentional): the card does not render during the draft's type-out preview (only in the final document view); real (non-demo) generation is S3–S5.

- [x] **S2 — Provider decision + web-cited-paragraph spike** — DONE.
  - Decision: **Anthropic Claude `web_search`** (user provided the key; added to gitignored `backend/.env`).
    `settings.resolved_llm_provider()` still returns `deepseek` (general drafter unchanged); only the research
    path will use Anthropic + `draft_model=claude-sonnet-4-6`.
  - **Live spike** (`claude-sonnet-4-6`, one call): `web_search_20260209` tool + a `write_section` tool with
    `tool_choice:{"type":"auto"}`. **17 web searches ran server-side**, then the model called `write_section`
    with ~2,900 chars of prose, inline markers [1]–[5], and **5 web citations each carrying a real source URL**
    (Market Research Future, Ken Research, Qatar NPC NDS3, Gulf Times/QFC Dec-2024 PMI). Contemporaneous, specific
    FY2024 data (GCC BPO USD 8.23B in 2024, ~9.1% CAGR, Qatar ~USD 260M, PMI wage growth) — not generic filler.
  - **Validated parameters for S4:** model `claude-sonnet-4-6`; tools `[{"type":"web_search_20260209","name":"web_search","max_uses":N}, write_section]`; `tool_choice:{"type":"auto"}` (forcing the custom tool skips search); loop while `stop_reason=="pause_turn"` (server-tool budget) re-sending the assistant content. No beta header. Web citations already flow through `DraftCitation(kind="web", url=...)` end to end.
  - Verification: live API call passed its asserts (non-empty content, ≥1 web citation with URL, inline markers present). Spike script kept in the session scratchpad (throwaway proof); the durable drafter path is S4.

- [x] **S3 — Backend non-gating skeleton section injection + `research` column** — DONE.
  - **Seam (contained to the draft router):** Industry Analysis is injected ONLY into a new draft-only
    `draft_elements(country)` (statutory `resolve_requirements` + the research element), so coverage / assessment
    / matching are **untouched** and it never creates a `RequirementCoverage` row. Since `draft_readiness_for_rows`
    gates purely on coverage rows, a section with no coverage row **cannot block the draft**.
  - `requirements.py`: `ResolvedElement.research: bool`; `_industry_element()` (`requirement_key=f"{c}:industry_analysis"`, distinct — no key collision) + `draft_elements()` inserting it after the business-strategy element (or after the profile where none, e.g. Singapore) and renumbering display `order` while **preserving statutory `requirement_key`s** (coverage↔draft linkage intact).
  - `draft.py`: uses `draft_elements` at the draft-owned sites (start/run/docx/regenerate); research sections draft via `_draft_research_stub` (no document retrieval — S4 replaces it with real web research); `_validate_draft_result` validates research sections on their `research` provenance (web-citation URLs) instead of requiring inline document citations; docx export exempts citation-less research sections.
  - `models.py` + `schemas.py` + `drafting.py`: `research` JSONB column on `DraftSection`, `research` on `DraftSectionRead` + `DraftResult` (round-trips to the frontend, which already renders the card from S1).
  - **Migration (prod):** `create_all` won't ALTER the existing prod `draft_sections` table — run `ALTER TABLE draft_sections ADD COLUMN research JSONB;` on Supabase before deploy. The test DB is dropped+recreated per run, so tests already exercise the new column.
  - **Verification:** backend `pytest` **full suite 228 passed** against the pgvector test DB (`:5544`), incl. 4 new pure `draft_elements` tests (`tests/test_industry_analysis.py`: position after Business Strategy, Singapore-after-profile fallback, `resolve_requirements` excludes the research element, empty for unknown jurisdiction) + a new integration test (section injected, drafted non-gating, `research` round-trips, docx exports "Industry Analysis") + updated section-count assertions in `test_draft.py`. `npx tsc --noEmit` clean; `pnpm build` clean.

- [x] **S4 — Real web-research generation** — DONE.
  - `drafting.py`: `AnthropicResearchDrafter` (real, Claude Sonnet + `web_search_20260209` + `WRITE_INDUSTRY_TOOL` returning content + web citations + the structured `research` card; `tool_choice:auto`; `pause_turn` loop) and `FakeResearchDrafter` (deterministic, offline — used by tests). A `ResearchDrafter` Protocol types both.
  - Injection mirrors the general drafter: `app.state.research_drafter` set in `main.py` (`AnthropicResearchDrafter` when an Anthropic key is present — **independent of the general provider, which stays DeepSeek** — else the offline fake), `get_research_drafter` dep, threaded through `run_draft` (via `jobs.py`) and the `regenerate` endpoint; conftest sets the fake so **CI never hits the paid API**. `_draft_research` replaces the S3 stub.
  - **Bug found + fixed by the live smoke:** at `max_tokens=3000` the long 8-paragraph `content` exhausted the budget and the trailing `citations`/`research` tool-JSON fields were truncated (0 citations, no card). Raised to **8000** → complete output. (The offline suite couldn't catch this — it exercises the fake, not the real Anthropic call — which is exactly why the guarded live smoke matters.)
  - **Verification:** offline **backend suite 229 passed** against the pgvector test DB (`:5544`) with `FakeResearchDrafter` (incl. a new pure `FakeResearchDrafter` test + the updated integration assertions: research section now carries a `kind="web"` citation with a URL and a populated card); `npx tsc --noEmit` clean; `pnpm build` clean. **Live smoke** (real `AnthropicResearchDrafter`, one paid call, kept out of the suite): `stop_reason=tool_use`, 7,557-char prose, **10 web citations with real URLs**, fully-populated card with contemporaneous FY2024 Qatar/GCC data (surfaced Qatar Law No. 22/2024 Pillar Two DMTT/IIR driving outsourced F&A demand; framed the tested party as limited-risk routine BPO for TNMM). **Latency:** ~7.7 min for the real call (10 searches + long generation) — acceptable but a candidate for later tuning (fewer `max_uses` / lower effort).

- [x] **S5 — Quality guardrails (contemporaneous, specific, sourced)** — DONE.
  - `drafting.py`: pure `validate_research(result, entity_name, fiscal_year)` — raises `RuntimeError` (surfaced as
    the section error) unless the analysis is **sourced** (≥2 cited web sources + `research.sources`), its claims
    are **marked** (≥2 inline `[n]`), it states **specific figures** (a digit outside citation markers — generic
    prose with no numbers is filler), it is **dated** (`research.period` set; and if the engagement has a fiscal
    year, it appears in the content/period), and it is **linked to the tested party** (the entity name or "tested
    party" in the content). Called in `_draft_research` before persisting. **Structural checks, not a keyword
    blocklist** — the real S4 smoke output itself contained "digital transformation", so a blocklist would
    false-positive; structural requirements are robust.
  - `FakeResearchDrafter` made guardrail-compliant (two cited web sources, a concrete figure, a set period) so
    the offline suite exercises a passing analysis; the gate is not weakened.
  - **Verification:** full backend suite **235 passed** against the pgvector test DB (`:5544`), incl. 6 new pure
    `validate_research` tests (accepts a compliant analysis + rejects: under-sourced, uncited claims, no figures,
    missing tested-party linkage, fiscal-year mismatch). `npx tsc --noEmit` clean; `pnpm build` clean.

## ✅ Loop complete — all 5 slices shipped, verified, and pushed
Commits: S1 `0f8c412` · S2 `45df4e5` · S3 `22e9547` · S4 `b17a3b4` · S5 (this).
**Operational follow-ups:** (1) prod migration — `ALTER TABLE draft_sections ADD COLUMN research JSONB;` on
Supabase (`create_all` won't add the column to the existing table); (2) the real research call takes ~7.7 min
(10 web searches + long generation) — tune later via fewer `max_uses`/effort if the drafting UX needs it.
**Demo vs real:** `/demo` shows canned Industry Analysis content (S1); the real backend now generates it live
via Anthropic `web_search` (S3–S5).
