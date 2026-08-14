# Industry Analysis section for the Local File — slice tracker

Source: the `/to-issues` breakdown of the "Industry Analysis section" feature (Jayesh's requirement — a
contemporaneous, entity-specific industry analysis that gives context for the tested party's profitability,
positioned after Business Strategy, with a structured "research result" card + expandable sources).

## Scope (decided with the user)
- **Full real pipeline** (real web-research-backed section), added to all 3 demo jurisdictions
  (UAE/Singapore/South Africa) as a shared BPO/GCC analysis, with a research card + expandable sources.

## Open decision (blocks the real-research slices)
- **Research provider**: activate the dormant Anthropic Claude `web_search` path (needs `ANTHROPIC_API_KEY`)
  **vs** add Tavily/Serper + the current DeepSeek drafter. Unresolved → S3/S5/S6 are blocked.

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
| S2 | Provider decision + web-cited-paragraph spike | HITL | — | ⛔ BLOCKED (provider + `ANTHROPIC_API_KEY`) |
| S3 | Backend non-gating skeleton section injection + `research` column | AFK | S1 (+ S2 in practice) | ⏸ PAUSED — see note |
| S4 | Real web-research generation for the section | AFK | S2, S3 | ⛔ BLOCKED (via S2) |
| S5 | Quality guardrails (contemporaneous, specific, sourced) | AFK | S4 | ⛔ BLOCKED (via S4) |

> Ordering note: the demo/UI slice (S1) is independent of the backend and the provider decision, so it runs
> first. The real-pipeline slices (S3→S4→S5) follow; S2/S4/S5 are blocked until the provider decision + a key
> are provided. The loop works the eligible AFK slices and stops at the blocker.

## Status / verification log

- [x] **S1 — Demo Industry Analysis section + research card** — DONE.
  - `lib/api.ts`: added `ResearchSummary`/`ResearchSource` types and an optional `research` field on `DraftSection` (absent on real-backend sections; only the demo populates it).
  - `lib/demo-api.ts`: `Topic` gains `"industry"`; `body("industry")` writes the 8 labelled sub-sections (definition → market → FY2024 conditions → competitive landscape → value drivers → risks → tested-party position → profitability bridge to TNMM), contemporaneous and entity-specific (no generic filler). `elementsFor()` now inserts `INDUSTRY_ELEM` **after Business Strategy** (or after the profile where there's no strategy element, e.g. Singapore) and renumbers, so Requirements + Draft stay consistent. The element carries a `INDUSTRY_RESEARCH` card (industry/market/period/trend/risk/competitors/impact + 7 web sources). `sections()` passes `research` through.
  - `components/steps/DraftDocument.tsx`: `ResearchCard` renders above the prose when `section.research` is present, with the labelled fields and an expandable "7 verified sources" list of clickable links. Real-app sections (no `research`) are unaffected.
  - **Verification:** `npx tsc --noEmit` clean; `pnpm build` clean; `pnpm test` **23/23** (3 new tests in `lib/demo-api.test.ts`: section position after Business Strategy, Singapore fallback after profile, 7-source card, contemporaneous "wage inflation" content, research attached only to Industry Analysis); production `/demo` serves 200.
  - Not covered by S1 (intentional): the card does not render during the draft's type-out preview (only in the final document view); real (non-demo) generation is S3–S5.

- **⏸ Loop paused after S1.** S2 (research provider) is a HITL decision that also needs a missing `ANTHROPIC_API_KEY` (or a Tavily/Serper key) — a credential/decision the loop cannot safely infer. S3 is technically eligible (dep S1 satisfied), but it's meaningful surgery on the strict, validated drafting pipeline **and** a DB schema change (`research` column; `create_all` won't ALTER the existing prod table), and its only consumer — S4's real generation — is blocked by S2, which will also shape the exact `research` shape. Building S3 now risks rework. Per the loop's stop conditions (blocked by an un-inferable decision / missing credential), the loop stops here pending the S2 provider decision.
