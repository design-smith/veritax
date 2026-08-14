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
| S3 | Backend non-gating skeleton section injection + `research` column | AFK | S1, S2 | ▶ NEXT |
| S4 | Real web-research generation for the section | AFK | S2, S3 | blocked by S3 |
| S5 | Quality guardrails (contemporaneous, specific, sourced) | AFK | S4 | blocked by S4 |

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

- **▶ Continuing to S3** (backend non-gating skeleton section injection + `research` column). Needs the pgvector
  test DB (`:5544`) for verification. Architectural note: Industry Analysis will be a **research element** in
  `resolve_requirements()` flagged so coverage/assessment skip it (not doc-gated, never blocks the draft), and
  the draft router routes it to the web path (S4) instead of document retrieval.
