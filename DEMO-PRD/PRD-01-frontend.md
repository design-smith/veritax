# PRD-01 — Veritax Frontend

**Status:** Draft v1 · **Owner:** NG · **References:** PRD-00 (System Constitution), PRD-02 (Record), PRD-05 (Runtime & Instructions), PRD-06 (Mirror), PRD-13 (Access)
**Explicitly out of scope per author:** visual design, tokens, typography, color, spacing (design system exists). This document specifies structure, behavior, data, and state only.

---

## 1. Purpose & users

The frontend is the operating surface for the Intercompany Record. It must let four altitudes of user do their work without translation layers:

| Persona | Altitude | Primary surfaces | Session shape |
|---|---|---|---|
| VP Tax / CTO | Decide & sign | Briefing, Findings (rollup), Gates, Board pack export | 5–10 min, 1–2×/day |
| TP Manager | Direct & promote | Findings, Factory, Runs, Graph, Monitor, Commitments | Hours, daily |
| Analyst / Preparer | Produce & propose | Verification Queue, Document Workspace, Findings (assigned), Library | Hours, daily |
| Adjacent (Legal/Treasury/Controller) | Consume & contribute | ICA Register, scoped artifacts, data requests | Minutes, weekly |

External personas (firm reviewer, local advisor, financial-statement auditor) are specified in §7 as Phase-2 portal chapters with separate auth contexts.

Design stance (from PRD-00, restated as UI law): **evidence-first** (no figure or claim renders without provenance affordance), **propose-don't-commit** (no control mutates the Record directly; everything routes through staging and gates), **exceptions-not-noise** (default views show deltas and breaches, never inventories), **edit-upstream** (record artifacts are modified in-app; exports are renderings).

## 2. Owns / Consumes / Emits

- **Owns:** UI state only — saved views, table layouts, panel sizes, draft (unsubmitted) instructions, local selection. No domain objects.
- **Consumes:** Record query API (objects, subgraphs, timelines), event stream (job progress, staleness, gate requests, digest items), document blob/viewer API, search/answer API, permissions context (per-session capability map from PRD-13).
- **Emits:** user intents as commands — `run_stage`, `submit_instruction`, `answer_verification`, `triage_finding`, `gate_decision`, `assign`, `export`, `connect_source`, `ask` — each carrying actor, scope, and idempotency key. The frontend never writes state; it requests it.

## 3. Scope & non-goals

**In scope:** application shell; all internal surfaces (§6); cross-cutting interaction patterns (§5); external-portal contracts (§7, spec-level); permissions-driven rendering (§8); telemetry (§9).
**Non-goals:** aesthetics; native mobile apps (responsive approvals-only view is P2); offline mode; in-app chat between users (comments/mentions only); marketing/site; report-builder customization (views are saved filters, not layout editors); Privileged Vault UI beyond entry-gating (P3, counsel-administered, separate spec addendum).

---

## 4. Global application frame

### 4.1 Shell & navigation
- **Left rail (collapsible):** Briefing · Graph · Findings · Documents · Monitor · Calendar · Library · Commitments · Runs · Connectors · Admin (role-gated). Badge slots per item (counts: open findings, pending gates, queue depth). Rail order is fixed; no user reordering in v1.
- **Top bar:** workspace/org switcher (multi-entity groups: sub-group selector) · **Fiscal-Year Lens** (see 4.2) · global Ask/⌘K affordance · notifications bell (opens Digest Center) · pending-gates chip (count; click → Gate Queue overlay) · user menu (profile, delegation settings, sign out).
- **Right contextual panel (app-wide pattern):** most surfaces are two-pane (list/canvas + inspector). Inspector content is selection-driven and routable (deep links address `surface/objectId/tab`).
- **Deep linking:** every object, view, finding, document section, run, and queue item has a canonical URL. Copy-link control on every inspector header.

### 4.2 The Fiscal-Year Lens (time travel)
- Global control: `FY ▾` + optional period (Q1–Q4) selector. Default = current FY.
- Changing the lens re-scopes **every** surface to the Record as-of that valid-time slice. Banner appears when lens ≠ current: "Viewing FY2024 · records as filed/known" with a `knowledge-time` toggle (As filed / As known today) — implements bitemporal view; toggle hidden until PRD-02 v1 ships (P1).
- Immutability rendering: under a past lens, all mutation controls render disabled with tooltip "FY2024 is sealed · open current FY to act." Signed artifacts always render their sealed version regardless of lens.

### 4.3 Ask the Record (global overlay)
- Invoked via ⌘K / ctrl-K / top-bar control / `/` on list surfaces.
- Modes within one input: **Ask** (natural language → answer-brief), **Go to** (object jump, fuzzy), **Run** (stage launcher with scope autocomplete), **Create** (data request, commitment, note). Mode inferred; prefix override (`>` run, `@` go-to).
- Answer-brief rendering: 1–3 sentence answer → exhibits list (citation components, 5.1) → actions row: `Open as view` (materializes a filtered table on the relevant surface), `Export with citations`, `Save as standing question`, `Escalate to triage` (when answer confidence < threshold). Refusals render as first-class answers with the absence-evidence ("no executed renewal after 31 Dec 2023 in corpus v.418") and the same export affordance.

### 4.4 Notifications & Digest Center
- Two channels only: **Digest** (batched per user cadence setting: realtime/daily/weekly per category) and **Gate requests** (always realtime).
- Digest Center panel: grouped by category (Findings, Runs, Commitments, Sources, Obligations); each item deep-links; bulk mark-read; per-category cadence control inline.
- No toast-spam: toasts confirm *user-initiated* actions only (with Undo where reversible). System events surface in Digest.

---

## 5. Cross-cutting interaction patterns (PAT library)

Surfaces in §6 reference these by ID. Build once, reuse everywhere.

**PAT-1 · Citation chip.** Inline element on any claim/figure: `doc · §ref`. Hover: source preview (snippet + doc meta + extraction confidence + extractor version). Click: opens Document Viewer (6.4) at the anchored span, highlighted, with back-to-context return. A claim with no resolvable citation renders with a quarantine marker and is excluded from exports (enforced server-side; UI must surface it, never hide it).

**PAT-2 · Provenance popover (numbers).** Every figure carries `as-of` + source chip. Click: lineage drawer — the hop chain (ledger line → mapping → entity P&L → segmentation → metric), each hop linkable. Stale data (source sync age > threshold) renders an amber freshness marker globally and on every derived figure.

**PAT-3 · Staleness & rebuild proposal.** Objects whose inputs changed show a `stale` badge + "what changed" diff link. Surface-level banner aggregates: "3 artifacts affected by changes since last build — Review proposals." Proposal sheet lists affected targets with per-target accept/skip; accept routes through PAT-4. Never auto-rebuild.

**PAT-4 · Plan Confirmation (restate-before-run).** Universal modal for any `run_stage`/agent action: shows (a) parsed intent restated, (b) ordered step list with scope, (c) what will be invalidated/produced, (d) estimated duration/cost class, (e) instruction echo (editable), (f) permission check result. Buttons: `Run` · `Edit instruction` · `Cancel`. On run: converts to Run drawer link (6.7). Methodology-tier instructions show the approval-required state inline (request routes to manager gate) per PRD-05 tiers.

**PAT-5 · Gate control.** Anywhere a promotion/sign-off is requested: gate card with object summary, diff-from-current, requester, SLA timer, escalation path indicator, delegation notice if active. Actions: `Approve & promote` · `Request changes` (comment required) · `Reject` (reason required) · `Delegate` (people picker, time-boxed). Approvals are explicit-click only — no bulk approve in v1 except identical-batch (same template, same diff class) with itemized confirm list.

**PAT-6 · Instruction surfaces.** Three entry points, one model: (a) Standing Instructions manager (Settings 6.13 + scoped entry on any object: "Add standing instruction for [scope]"); (b) Run instruction box inside PAT-4; (c) Inline directive — text selection in Document Workspace exposes `Instruct` action. All instruction inputs show tier classification live (style/run/methodology) and the resulting permission consequence before submit. Conflicts with existing standing instructions are surfaced at submit with precedence preview.

**PAT-7 · Assignment.** Assign control on Findings, Documents, Queue items, Commitments: people picker (role-filtered), due date (defaults from linked obligation), note. Confirmation states the access consequence: "Grants I. Choi: SG subgraph + this document (read), proposal rights." Unassign revokes derived access after confirm.

**PAT-8 · Tables & keyboard model.** All list surfaces share: column sort/filter/save-view, density toggle, j/k row nav, `o`/Enter open, `x` select, bulk-action bar on selection, `e` assign, `c` comment, `g` then key = surface jump (gb briefing, gf findings, gd documents, gr runs). Saved views are per-user, shareable by link; no org-default editing in v1.

**PAT-9 · State vocabulary.** Every surface implements five states with specified content — **Empty** (educational: what this surface will show + the action that feeds it), **Loading** (skeleton of true layout; progressive fill, never spinner-only > 400ms), **Degraded** (source-down banner with affected-scope listing; data still shown with PAT-2 staleness), **Denied** (sensitivity/role message naming the tier, request-access action where policy allows, event logged), **Error** (retry + incident reference id).

**PAT-10 · Export dialog (two-class).** From any artifact/view: shows artifact class (Record vs Communication), allowed formats per class, destination (download / approved SharePoint folder / send-on-approval email draft), verification-hash notice for record-class, "includes N uncited claims — blocked" guard. Record-class exports of unsigned drafts watermark `DRAFT — not for reliance` (non-removable).

**PAT-11 · Sensitivity & logging indicators.** Sensitive-tier objects render tier chip + "views are logged" notice on open. Privileged-vault links render as locked entries with counsel-contact action; no content preview ever.

**PAT-12 · Comments & mentions.** Anchored comments on findings, document sections, queue items, runs. @mention notifies via digest/realtime per recipient settings. Resolve/unresolve; resolved threads collapse but remain in object history.

---

## 6. Surfaces

Spec template per surface: Purpose · Roles · Layout · Components & actions · Data in · Emits · States/notes · Shortcuts. PAT-9 states apply everywhere; only surface-specific state content is noted.

### 6.1 Briefing (Home)
**Purpose:** answer in ≤90s: what changed, what needs my decision, what's due. **Roles:** all internal; content is role-composed.
**Layout:** single column of generated sections (no widget grid, no user layout editing): ① Since-you-were-here delta digest ② Decision queue ③ Obligations strip ④ Commitments lane ⑤ Watch items (role-relevant: exposure rollup for VP; assigned work for analyst).
**Components & actions:**
- Delta items: each links to object; inline quick-actions where safe (acknowledge, open).
- Decision queue: PAT-5 gate cards inline; completing a card removes it without navigation.
- Obligations strip: next 5 by urgency; day-count chips; click → Calendar filtered.
- Commitments lane: pending plan-approvals render PAT-4 launcher inline.
- `Generate board pack` action (role-gated VP/manager): PAT-4 plan → Run → artifact lands in Documents with notification.
**Data in:** digest feed, gate queue, obligations(next), commitments(pending), rollups. **Emits:** gate_decision, run_stage, ack.
**Notes:** Briefing is never empty — cold-start renders onboarding journey state (6.15). Degraded sources render a single consolidated banner here listing affected sections.

### 6.2 Graph · Entity page · Flow page
**Purpose:** spatial truth of the intercompany economy; the door to everything. **Roles:** all; scope-filtered.
**Layout:** canvas (Map | Tree toggle) + inspector. Time scrubber bound to Fiscal-Year Lens (scrubbing changes lens with confirm if unsaved work).
**Map canvas — components & actions:** entity nodes (click → Entity inspector; double-click → Entity page), flow edges (click → Flow inspector), status filter chips (exception/drift/verified), transaction-type filter, materiality slider (hides flows < threshold; persisted per view), `Export chart` (PAT-10, communication-class: PPTX/PNG with as-of footer), search-on-canvas (`/` highlights matches). Selection dims non-neighbors; multi-select (shift) enables `Compare flows` (opens side-by-side inspector).
**Tree canvas:** ownership %, elections badges; structural-change markers on scrub; same inspector model.
**Entity page (full):** header (name, role-in-group, jurisdiction, as-of) · tabs: Overview (profile, FAR summary with PAT-1 citations) · Financials (statements w/ PAT-2 lineage; GAAP toggle) · Substance (headcount/payroll aggregates, facilities) · Pillar 2 (entity GloBE attributes) · Agreements (touching this entity; gap flags) · Findings · Filings (obligation history + evidence) · Audit history. Page-level actions: `Run scoped scan` (PAT-4), `Add standing instruction for [entity]`, Assign, Export profile.
**Flow page (full):** header (parties, kind, method) · Policy vs Observed panel (series chart, PAT-2 on points) · Governing agreement card (status incl. EXPIRED state; open in Viewer) · Benchmark link (current set, refresh state) · Findings on flow · Documentation coverage by jurisdiction (which local files describe this flow; missing = flagged) · Customs linkage card (P2: duty basis, last reconciliation). Actions: `Re-test range` (PAT-4), `Open in Factory` (jumps to sections describing this flow), `Propose policy change` (creates governed-edit request → gate; never edits inline).
**Data in:** subgraph queries, series, coverage matrix. **Emits:** run_stage, governed_edit_request, assignment.
**Notes:** canvas virtualizes > 60 nodes into clustered regions with expand; full spec for clustering thresholds in appendix A1.

### 6.3 Findings & Finding detail
**Purpose:** the work system for exceptions. **Roles:** manager/analyst primary; VP rollup view.
**List layout:** table (PAT-8) with saved views; default view = Open, severity desc. Columns: tick/severity, ID, title, flow, exposure, status, assignee, reviewer-state, age. Board view toggle (columns = lifecycle states) — drag between states allowed only along legal transitions; illegal drags bounce with reason. Rollup header: open count, total exposure (PAT-2), trend sparkline.
**Bulk actions:** assign, watch, export list (communication-class), move-to-triage. No bulk dismiss.
**Finding detail (inspector or full page):**
- Header: ID, severity chip, status, watch toggle, copy link.
- Narrative: title, summary; every factual clause carries PAT-1 chips.
- Exposure card (PAT-2 on amount; methodology note link).
- Exhibits: ordered citation cards; `Open all in Viewer` (split view).
- **Provenance block:** rule id + plain-language rule description, extractor/model versions, confidence with calibration note; `Why am I seeing this` expander renders the comparison spans side-by-side.
- **Remediation paths:** 1–3 path cards, each with computed downstream cascade preview (affected returns/docs/customs) and effort class; `Select path` → PAT-4 plan (methodology-tier where applicable).
- Actions row: `Confirm` (reviewer attestation; records name+date) · `Dismiss` (reason picker + free text → feeds rules per PRD-06) · `Assign` (PAT-7) · `Add comment` (PAT-12) · `Create data request` (when gap-type) · `Export memo` (PAT-10).
- History tab: full event trail incl. instruction echoes.
**Lifecycle rendering:** Detected → Triaged → In remediation → Reviewed → Resolved → Verify-next-cycle; resolved items show next-cycle verification date; failed re-verification reopens with linkage.
**States note:** Triage sub-view (below-threshold candidates) is a separate saved view, visibly labeled "Candidates — not yet findings"; promoting requires explicit `Promote to finding` with reason.

### 6.4 Library · Document Viewer · ICA Register
**Purpose:** the corpus, readable and provable. **Roles:** all (scope/sensitivity filtered).
**Library list:** PAT-8 table; facets: type, entity, jurisdiction, FY, custody class, sensitivity, source. Row affordances: custody badge (Materialized/Extract-only/Reference), retention clock, version count. Actions: open, download (policy-gated), `Promote to materialized` (on referenced items; states the consequence), upload (drag-drop bulk; routes to ingestion with progress in Runs).
**Document Viewer (the keystone component):**
- Renders PDFs/DOCX-renditions paginated; **anchor protocol:** opens at cited span with persistent highlight; multiple anchors navigable (n/p). Span hover shows which findings/claims cite it (reverse citations).
- Side panel tabs: Outline · Extractions (structured fields with confidence; click field → highlights source span; `Correct` action → verification answer, PAT-7 access rules) · Versions (diff selector; executed-version marker) · Mentions (objects citing this doc) · Comments.
- Header: custody, sensitivity (PAT-11), as-ingested hash, source path, `Return to [origin]` breadcrumb (always present when opened from a citation).
- Reference-custody docs: viewer fetches on demand; drift-detected banner if hash mismatch with action `Re-fetch & flag`.
**ICA Register (dedicated view):** agreements table with status (Executed/Expired/Missing/Draft-only), counterparties, renewal date, linked flows. Row actions: `Draft renewal` (PAT-4 → Factory), `Request execution` (data request to Legal), open. Gap rows (flow-without-agreement) render as first-class entries with `Create agreement draft`.
**Emits:** verification_answer, ingest, promote_custody, data_request.

### 6.5 Verification Queue & Mapping Studio
**Purpose:** the teach-the-system surface; cold-start engine. **Roles:** analyst primary; manager for contested items.
**Queue layout:** card stream, one question per card, keyboard-first (1–4 select option, Enter confirm, s skip, u undo last). Card anatomy: question in plain language · evidence panel (the spans/files that triggered it, PAT-1) · options (incl. "Something else" free entry) · consequence line ("confirming maps GL 47200 → IC royalties for all periods"). Progress header: queue depth by category, corpus-confidence meter, session streak.
**Question categories (each with tailored card):** entity-merge confirmations (side-by-side profiles, `Same / Different / Unsure→escalate`), executed-version selection (version diff inline), account mapping, dormancy flags, extraction corrections, allocation-key confirmations.
**Mapping Studio (structured editor):** chart-of-accounts mapping table (source account → canonical, confidence, coverage %), entity-resolution workbench (cluster view: merge/split with audit note), allocation-keys editor (key definition, basis source PAT-2, applies-to scope). All edits are proposals → manager gate for methodology-class mappings; style-class auto-applies with log.
**States:** queue-empty is a celebration state with corpus stats; contested items (two users answered differently) route to a manager-only sub-queue.
**Emits:** verification_answer (assertion with provenance), mapping_proposal.

### 6.6 Factory: Pipeline · Document Workspace · Benchmark Studio
**Purpose:** composition under control. **Roles:** analyst/manager.
**Pipeline view:** kanban by stage (Queued → Generating → Self-check → Internal review → External review → Signed → Filed). Card: doc name, FY, jurisdiction, version, redline-count, blocker chips (failed self-check items). Drag is illegal-everywhere (stage moves only via actions); cards open workspace. Column headers expose batch actions (e.g., `Send all internal-approved to external review` with itemized confirm).
**Document Workspace:**
- Tri-pane: outline (sections with status dots: generated/edited/stale/blocked) · canvas (rendered doc) · context (sources/comments/checks).
- Section chips: every section header lists its input chips (entity facts, agreement clauses, benchmark set, financials) — click chip → source.
- **Redline toggle:** vs prior filed year (default for renewals) or vs any version; insert/delete marks; per-change accept is N/A (record edits flow via directives), changes are navigable n/p.
- **Inline directive (PAT-6c):** select text → `Instruct` → instruction box with tier indicator → PAT-4 micro-plan (scope = selection) → on completion section shows pending-self-check state until Checker passes; failures render blocker with explanation + `Open conflict` (jumps to contradicting evidence).
- Language toggle (local | EN side-by-side for localized docs); editing allowed only on source-language with regeneration of counterpart flagged.
- Check panel: self-check results list (pass/fail per assertion class) with PAT-1 to conflicts; export blocked while failures open.
- Actions: `Regenerate section` (PAT-4), `Send to internal review`, `Send to external review` (requires internal pass), `Request sign-off` (PAT-5 to designated signer), `Export` (PAT-10; unsigned = watermarmeans), Comments (PAT-12), Version history.
**Benchmark Studio:**
- Screening cascade visual: universe → each screen as a stage with in/out counts; click stage → criteria editor (methodology-tier) + excluded-list with drafted rejection rationales (editable text, regeneration action per row).
- Set table: comparables w/ financials (PAT-2 to source license), accept/reject status, delist/acquired flags from registry check.
- Range panel: PLI selector, IQR computation display, weighted-average toggle, `Re-test tested party` action.
- `Refresh from license` (PAT-4; shows BYO-license connection state; absent license → connect prompt routed per IT policy) ; refresh produces diff sheet (added/dropped/range shift) requiring manager accept before set becomes current.
**Emits:** run_stage, instruction, review_route, sign_request, export.

### 6.7 Runs & Jobs
**Purpose:** the visible nervous system; trust through transparency. **Roles:** all (scoped); primary manager/analyst.
**Layout:** runs table (live) + run drawer. Filters: status, stage type, initiator (user/watcher/system), scope.
**Run drawer:** header (stage, scope, initiator, pinned versions: corpus/rulepack/model) · step timeline with per-step status, duration, and tool-call trace expander (read-only) · instruction echo · outputs list (→ staging objects with `Review` actions) · cost class · `Cancel` (where safe) · `Re-run with edits` (reopens PAT-4 prefilled).
**Staging review:** outputs awaiting gates listed with diff-from-current and PAT-5 controls; promoting from here equals promoting from the object surface (single gate model).
**Scheduled watchers tab:** each watcher with scope, cadence, last-run result, `Pause` (manager), `Edit scope` (PAT-4/instruction tiers).
**States:** failed runs show failure class + suggested remedy + `Report` (attaches trace to support ticket). Cost-budget exceeded renders as a distinct state with manager `Raise budget & retry`.

### 6.8 Monitor & Scenarios
**Purpose:** the provision-calendar workspace; quarter-shaped, exception-driven. **Roles:** manager/VP; controller read.
**Layout:** period header (FY/Q, days-to-close, pre-close checklist progress) · panels: ETR walk · Pillar 2 · Range watch · True-up forecast.
**Pre-close checklist:** generated T-10; items link to their fixing surface; completion states roll to header. `Export provision memo` (communication-class) assembles current panel states.
**Pillar 2 panel:** jurisdiction table — GloBE ETR, safe-harbour tests as pass/fail chips with `Why` expander (test math via PAT-2), QDMTT accrual, SbS election status. Row action: `Model correction` → opens Scenario prefilled.
**Range watch:** tested-party rows — IQR band, YTD marker, projected landing, true-up €, customs-impact flag (P2). Row actions: `Re-test`, `Open flow`, `Create finding` (when drift persistent).
**Scenario sandbox:** parameter sheet (rates, dates, elections) → `Compute` (deterministic; instant-class) → results diff vs base (ETR/QDMTT/true-up/customs) → `Save scenario` (named, listed, comparable side-by-side up to 3) → `Export memo`. Scenarios never write to Record; promoting a scenario to action = `Propose policy change` (governed edit → gate).
**Alert policy editor (manager):** per-category cadence/threshold; preview ("this policy would have sent 4 items last quarter").

### 6.9 Calendar & Obligations
**Purpose:** every duty, owned and evidenced. **Roles:** all; manager edits ownership.
**Views:** year wheel (jurisdiction rings) | Gantt | table (PAT-8). Item anatomy: obligation, entity, jurisdiction, due (local-TZ explicit), owner, status, linked artifact, filing-evidence slot.
**Actions:** assign owner, `Attach filing evidence` (upload/receipt; locks status to Filed), `Open artifact`, snooze-with-reason (logged, manager-gated for hard deadlines), `Add manual obligation` (for engagements not in rulepacks; flagged as customer-defined).
**Regulatory-change lane:** rulepack-driven additions/changes appear as proposals ("Brazil adds 3 obligations to 2 entities — Accept to calendar") with changelog link.
**Personal tasks are not here** — commitments live in 6.10; this surface is statutory/engagement obligations only (hard product rule to prevent calendar pollution).

### 6.10 Commitments (Clerk) & Meeting detail
**Purpose:** ambient work, captured with receipts. **Roles:** all internal.
**Commitments list:** PAT-8; columns: commitment, owner (me/others), source (meeting/email w/ PAT-1 to span), due, linked object, plan-state. Filters: mine/by-me/team.
**Commitment detail:** quoted source span (PAT-1) · resolution links (object chips) · **Plan block:** when executable, the compiled step plan rendered as PAT-4-preview inline with `Approve & run`, `Edit`, `Dismiss`; when external (not a Veritax capability), task controls only (done/due/owner) · chase-up control for others' commitments (per-person opt-in setting; drafts reminder for user send).
**Meeting detail:** metadata (calendar-linked), classification chip (with privilege-gate state: ingested/commitments-only/excluded), extracted commitments list, extracted assertions (→ Verification Queue links), recap draft (`Open in email draft`, send-on-approval per policy). Transcript tab present only when custody allows; otherwise explanatory absent-state.
**Intake settings shortcut:** per-source consent toggles surface here for the user's own connections (within IT ceiling).

### 6.11 Ask the Record — saved questions
**Purpose:** persistent intelligence. **Roles:** all.
Saved questions table: question, last answer summary, last-run, change-state (answer changed since save → highlighted), monitor toggle (standing monitor with digest routing). Row actions: re-ask, open last brief, edit scope, share (link). `New question` opens 4.3 overlay.

### 6.12 Connectors & Sources (user/manager plane)
**Purpose:** what feeds the Record, with custody honesty. **Roles:** manager for shared sources; users for personal (within policy).
**Sources table:** source, type, custody class badge, scope summary, health (last sync, lag), volume, owner. Row actions: open sync log, `Pause`, `Edit scope` (within ceiling; ceiling shown explicitly: "IT permits: label-scoped read-only"), `Disconnect` (consequence statement: what becomes reference-orphaned).
**Add source flow:** catalog filtered by IT policy state (Self-serve / Request / Disabled-greyed). Request path: form → routed to IT with status tracking. Personal email ladder rendered explicitly (forward-address always-available card with copyable address; mailbox OAuth where permitted).
**Backfill control:** per-source historical backfill request (scope picker, estimate, manager approval for shared sources).

### 6.13 Settings
**Tabs:** Standing Instructions (org/jurisdiction/doc-type/section scoped list; tier labels; conflict inspector showing precedence; propose/approve flow per tier) · Materiality & thresholds (manager) · Templates & Brand (upload Word/PPT masters, letterhead, terminology table; preview render) · My connections (personal sources, consent states) · Delegation (my gate-delegate, time-boxed) · Notifications (cadence per category).

### 6.14 Admin Console (IT/Security plane) — P1 minimal, P2 full
**P1 minimal:** members & roles (SCIM-read view + manual override), connector policy matrix (per connector type: Disabled/Request/Self-serve + scope ceiling presets + read/write toggles per destination), audit log explorer (event search; **no content rendering** — object references only), pending access/connector requests queue.
**P2 adds:** sensitivity-tier named-access manager, retention schedule editor (per class/jurisdiction; legal-hold control), residency display, key-management status, break-glass initiation (dual-confirm + mandatory reason + auto-review ticket), trust-center publisher.
**Hard rule rendered everywhere:** admin surfaces show metadata and policy only; any attempted content access routes through Denied state (PAT-9) citing the no-content principle.

### 6.15 Onboarding journey (cold start)
**Purpose:** the Mirror diagnostic as theater + the only path to a non-empty app. **Roles:** manager + analyst.
**Stage rail:** Connect → Ingest → Teach → Reveal.
- Connect: forward-address + drag-drop front and center; SharePoint connect if permitted.
- Ingest console: live counters (docs by type, entities discovered, agreements found), classification stream (recent items ticker), problem pile (unreadable/duplicate items with fix actions).
- Teach: Verification Queue embedded with target ("answer ~40 questions to unlock cross-referencing"); corpus-confidence meter.
- **Reveal:** staged first-findings moment — locked card "Examination complete: N findings · exposure rollup" → unlock renders Findings seeded and fires the Briefing into life. Replayable for demos (admin flag).

---

## 7. External portals — Phase 2 chapter (contract level)

Separate auth contexts, minimal chrome, no rail. Each consumes a scoped capability token; nothing else from §6 is reachable.
- **Review Mode (firm reviewer):** queue (assigned docs) → workspace-lite (canvas + redline + comments + evidence-on-demand via PAT-1 limited to shared scope) → sign ceremony (credentials block, attestation text, seal action producing manifest receipt) → hours log (per-doc timer + manual entry). Cross-client queue for multi-engagement reviewers (server-side merge; UI identical).
- **Advisor portal:** assigned data requests (form-render with validation), upload slots, status of their deliverables.
- **Auditor evidence room:** read-only artifact list per provision period, watermarked viewer, expiry banner, every-open logged notice.

## 8. Permissions-driven rendering (summary matrix)

| Capability | VP | Manager | Analyst | Adjacent | IT Admin |
|---|---|---|---|---|---|
| See sensitive tier | named | named | — | — | — |
| Promote/gates | ✓ (final) | ✓ (scope) | — | — | — |
| Methodology instructions | ✓ | ✓ | request | — | — |
| Run stages | ✓ | ✓ | assigned scope | — | — |
| Verification answers | ✓ | ✓ | ✓ | scoped | — |
| Connector policy | — | — | — | — | ✓ |
| Content access | scope | scope | assigned | scoped | **never** |

UI law: controls a role cannot use are **visible-disabled with reason** when discoverability aids the org (gates, methodology instructions) and **hidden** when they'd leak existence (sensitive objects, vault). Per-surface specifics inline in §6; full matrix in PRD-13.

## 9. Telemetry & success metrics

Metadata-only analytics (no content capture), consistent with admin-no-content:
- Activation: time-to-first-citation-opened; onboarding Reveal reached < 48h of first upload.
- Trust: citation-resolution success rate (target ≥ 99.5%); provenance-popover engagement; quarantined-claim rate trend ↓.
- Throughput: verification answers/session; gate latency P50/P95 (target P50 < 24h); rebuild-proposal acceptance rate.
- Adoption: WAU by surface; Ask answer-accepted rate; saved-view creation; commitments approved-plan rate.
- Quality signals to PRD-15: finding dismiss-reasons distribution; self-check failure classes.

## 10. Phasing

| Phase | Surfaces (full) | Surfaces (reduced) |
|---|---|---|
| **P0 — Demo core** | Briefing, Graph(map)+Flow/Entity inspectors, Findings+detail, Library+Viewer(anchor protocol), Ask overlay, Onboarding(replayable) | Factory: single-doc workspace w/ inline directive + redline; Runs drawer (read); Monitor static panels |
| **P1 — Design partner** | Verification Queue+Mapping Studio, Runs full, Connectors, Settings(instructions/templates), Calendar, Admin-minimal, Factory pipeline | Graph tree view; Commitments (manual-create only) |
| **P2 — Expansion** | Benchmark Studio, Review Mode portal, Commitments+Meeting detail full, Monitor live+Scenarios, Admin full, Export dialog full | Advisor portal; Auditor room |
| **P3** | Vault entry-gating, semantic-layer settings, responsive approvals view | — |

## 11. Open questions

1. Board view for Findings: ship in P1 or cut until a customer asks? (Lean: cut; table+saved views may suffice.)
2. Presence/concurrency indicators in Document Workspace — needed at design-partner scale or P2?
3. Materiality slider on Graph: per-user or per-workspace persistence? (Leans per-user; revisit when VP complains about screenshots mismatching.)
4. Chase-up drafting for others' commitments: default opt-in or opt-out at workspace level? (Culture call — flagged from Clerk PRD.)
5. Does Adjacent (Controller) get Briefing or land directly on their scoped artifact list? (Test with first design partner.)

— end —
