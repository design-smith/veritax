# PRD-06 — Mirror

**Status:** Draft v1 · **Owner:** NG · **Inherits:** PRD-00 (Laws, objects), PRD-02 (Record API), PRD-05 (runtime contract, referenced), PRD-07 (engines, called) · **Companion surface:** PRD-01 §6.3 (Findings), §6.15 (Reveal)
**Role in the company:** Mirror is simultaneously the permanent examination layer of the platform and the commercial wedge — the fixed-fee diagnostic that opens every account. This PRD specifies both.

---

## 1. Problem & users

Multinationals' files contradict each other because nobody maintains the object, only the projections (PRD-00 §2.1). Mirror's job: detect every place where the customer's own record disagrees with itself — across documents, between contracts and conduct, between policy and results, between computations — *before an examiner does*, with exhibits that survive the click (L1), severities a VP can rank, exposures a CFO can price, and remediation paths whose downstream consequences are computed before anyone commits. Human users: the TP manager (triage, path selection), the analyst (assigned remediation), the VP (exposure rollup), the external reviewer (confirmation stamps). Machine user: the Briefing, which feeds on Mirror's deltas.

## 2. Owns / Consumes / Emits

- **Owns:** Finding semantics and lifecycle policy; the detection-rule registry and its versioning; severity and exposure methodology; triage thresholds and calibration policy hooks; the dismiss-reason taxonomy; remediation-path templates; the Mirror Diagnostic product definition.
- **Consumes:** Record change-event stream; `conflicts(subject)` / `conflicts_in_scope(...)` (§10 amendment); `current_value` with precedence config; subgraph queries; deterministic engine calls (range test, GloBE checks, cascade traversal — PRD-07); runtime job execution (PRD-05); materiality configuration (canonical, governed-edit-controlled).
- **Emits:** `finding.candidate.recorded` (observation tier) · `finding.promoted | state_changed | dismissed | resolved | reopened` · `exposure.updated` · `remediation.plan_requested` · `rule.feedback` (to PRD-15) · `diagnostic.completed`.

## 3. Scope & non-goals

**In scope:** the two-stage detection architecture; the rule catalog; the Examiner's mandate and brief format; lifecycle, severity, exposure, triage; remediation paths and cascade preview; the false-positive flywheel; incremental and full-scan operation; the Diagnostic as a sellable run; explicit resolutions/amendments for PRD-02.
**Non-goals:** computation itself (engines are PRD-07; Mirror *detects*, engines *compute* — a rule may call an engine, never reimplement one); document generation (Factory consumes findings, PRD-08); the triage UI (PRD-01 owns surface; this PRD owns the states it renders); legal conclusions (a finding describes a divergence and its risk — it never asserts illegality; language discipline per PRD-00 §25).

## 4. Detection architecture: rules find, the Examiner proves

Two stages, deliberately asymmetric in cost:

**Stage 1 — the deterministic rules engine (cheap, continuous, incremental).** Typed checks over the Graph, triggered by change events against the affected subgraph only. Output: **signals** — machine-cheap hypotheses ("subject `flow:lic-de/royalty_rate` has competing assertions 4.0 vs 5.5"). Rules never write findings; they nominate.

**Stage 2 — the Examiner (agentic, budgeted, precise).** A PRD-05 job that picks up signals (or a scoped scan instruction), investigates the evidence chain — pulls every assertion on the subject, walks to the governing agreement, the GL, the sibling files; normalizes and compares; decides whether the signal survives — and, when it does, produces the **finding candidate**: narrative, ordered exhibits with spans, severity recommendation, exposure inputs, calibrated confidence, suggested remediation classes. Examiner tools: Record reads, retrieval, engine calls; writes only `finding.candidate` assertions (observation tier) — staging discipline preserved.

The asymmetry is the COGS architecture: rules give recall for free; the Examiner spends inference only where a signal exists; full precision lives where money is spent. Every Examiner run carries a token budget and cost class (L10); batch scans schedule off-peak.

## 5. The rule catalog (v1 registry)

Rules are versioned configuration with: `rule_id`, class, watched subjects/fields, trigger events, severity prior, materiality hooks, and an **Examiner brief template** (what to gather, what would falsify the signal). Detection rules live in this PRD's registry; computation rulepacks live in PRD-07 — rules may *call* engines, never embed law.

| Class | Rules (initial) |
|---|---|
| **R-1xx Cross-document consistency** | R-101 numeric fact mismatch across documents (rates, amounts, percentages) · R-102 date mismatch (effective/termination/filing) · R-103 characterization mismatch ("limited-risk distributor" vs "full-fledged" across files) · R-104 structure divergence (org chart vs Master File vs registry) · R-105 headcount/table mismatch (MF vs LF) |
| **R-2xx Conduct vs contract** | R-201 charges under expired agreement · R-202 activity with no agreement (gap row) · R-203 charged rate ≠ contracted rate · R-204 functions observed ≠ functions papered (DEMPE class: inventor records, titles vs "routine services") · R-205 draft-only/unsigned agreement in active use |
| **R-3xx Policy vs results** | R-301 tested party outside IQR (calls range engine) · R-302 persistent drift trend (n periods toward edge) · R-303 projected true-up beyond threshold · R-304 method/PLI inconsistency between policy object and documentation |
| **R-4xx Benchmark integrity** | R-401 comp-set staleness (age > policy) · R-402 delisted/acquired comparables (registry check) · R-403 range shift beyond threshold on refresh · R-404 missing/weak rejection rationales |
| **R-5xx Regulatory & computation** | R-501 jurisdiction ETR below threshold / safe-harbour fail (GloBE engine) · R-502 obligation approaching with no satisfying artifact · R-503 schema/validation failure on a filing artifact · R-504 cross-pack divergence (CbCR vs GloBE data pack — the FX case) |
| **R-6xx Structural & temporal** | R-601 valid-time gap (activity in a period no agreement covers) · R-602 ownership-chain inconsistency between sources · R-603 dormant-flagged entity with current activity |

Adding a rule = config + Examiner brief + golden-corpus cases (PRD-15) — no code deploy. Per-rule precision is tracked from day one (§9).

## 6. The Finding object & lifecycle — and the resolution of PRD-02 O-4

**Two-tier mapping (O-4 resolved).** Candidates are **observation-tier** assertions of type `finding.candidate` (signal + Examiner output + confidence). A canonical **Finding** is created by **promotion**, and the policy is:

- **System auto-promotion** when calibrated confidence ≥ threshold (§7) **and** exposure ≥ materiality. Justification under L2: a Finding asserts no business fact and mutates no record state — it is a *work object* declaring "these cited sources diverge," fully evidence-backed and reversible by dismissal-with-reason. **Precedent established for the whole system: work objects (findings, proposals, rebuild suggestions) may auto-instantiate; fact objects never.** PRD-02 should record this as the canonical reading of L2.
- **Human promotion** for below-threshold candidates, from the triage view ("Candidates — not yet findings"), with reason. Candidates are never silently dropped or silently promoted (PRD-00 §10.3).

**Lifecycle (states and transition guards):**
`Detected → Triaged → In remediation → Reviewed → Resolved → Verify-next-cycle`, plus `Dismissed` reachable from any pre-Resolved state (reason mandatory, §9).
Guards: *Triaged* requires assignee or explicit unassigned-acknowledgment by a manager; *Reviewed* requires a confirmation stamp (internal manager or external reviewer — the J7-class attestation); *Resolved* requires **resolution evidence** — a link to the change that fixed it (promoted edit, executed renewal, regenerated artifact, accepted refresh); *Verify-next-cycle* is automatic: the originating rule re-runs against next period's data, and failure **reopens** the finding linked to its ancestor (the system holds grudges so people don't have to). Severity (`critical/material/minor`) = rule prior + Examiner adjustment + materiality config; manager override allowed with reason, logged. **Root-cause grouping:** findings sharing a cause carry `root_ref` so rollups never double-count and remediating the root proposes closure of the family.

## 7. Confidence, calibration, triage

The Examiner emits calibrated confidence per candidate. Global auto-promotion threshold default **0.85**, overridable per rule class (R-2xx contractual gaps can run lower — they're near-deterministic; R-103 characterization runs higher). Calibration is *measured*, not assumed: PRD-15 tracks observed precision vs stated confidence (grading panel + dismiss outcomes); drift beyond tolerance freezes auto-promotion for the affected class (candidates still flow to triage — recall preserved, trust protected). Triage queue contract: candidates carry the same exhibits as findings; promotion/dismissal both feed §9.

## 8. Exposure & remediation

**Exposure methodology per class** (every exposure object carries method id, inputs, currency, band — PAT-2 traceable):
- Rate/amount mismatch (R-101/203): Δ × base × open periods; optional interest/penalty bands v2.
- Expired/missing agreement (R-201/202): at-risk deduction + withholding exposure on amounts charged.
- Range breach (R-301): adjustment-to-point convention — **default: median**, configurable per jurisdiction (flagged O-3 for advisor sign-off; conventions genuinely differ).
- Regulatory (R-501): engine-computed top-up estimate, passed through untouched (L3 — Mirror never re-derives engine math).
VP rollup = Σ open findings grouped by `root_ref`, with severity weighting available but **never displayed as a "score"** (PRD-00 D-class instinct: checklists over scores; rollup is currency, not gamification).

**Remediation paths:** per class, 1–3 templates — *prospective fix* (align go-forward: amend agreement/policy), *retroactive correction* (amend filings; heavy), *document-and-defend* (record rationale, strengthen file, accept position). Each template compiles to a plan skeleton; **cascade preview** computes before selection via the staleness DAG + PRD-07 cascade engine: affected documents, returns, customs/VAT flags, effort class. Selection → PAT-4 plan; retroactive paths are methodology-tier (manager+). Path outcomes feed template tuning.

## 9. The false-positive flywheel

Dismissal demands a reason from a closed taxonomy: `not-a-conflict (explanation linked)` · `explained-by (evidence ref — e.g., a side letter the rule didn't weigh)` · `immaterial` · `duplicate-of (ref)` · `data-error (auto-creates a Verification Queue item — the fix flows upstream, not into suppression)` · `intended-policy (suggests a standing instruction so the system learns the house position)`. Every dismissal emits `rule.feedback`; per-rule precision dashboards run from launch; when a rule's rolling precision falls below floor (default 0.6), the system **proposes** a scoped suppression — human-approved, never automatic, logged like any instruction. Confirmed findings, dismissals, and reviewer stamps all land in PRD-15's eval sets under consent. This loop is the moat's heartbeat: every customer interaction sharpens detection for every future customer *without any tenant content leaving its boundary* — what travels is rule statistics and synthetic recreations, never data.

## 10. Pressure-test results against PRD-02 (the point of the sequencing law)

**Resolved:** **O-3** — precedence at *field-class* granularity confirmed (rate-class, date-class, characterization-class…); per-field config would explode. One requirement added: `conflicts(subject)` must return **all tiers including human-confirmed assertions** — a confirmed mapping later contradicted by a new executed document must still signal (humans teach once, but documents can overrule a memory; the conflict is the point). **O-4** — resolved per §6, with the work-object/fact-object precedent for L2.

**Amendments filed to PRD-02:**
- **A-2 · Value normalization at write time.** Add `value_norm` (canonical-form value: "4.0%", "four percent", 0.04 → 0.04 + unit) populated by the write path; `conflicts()` compares normalized values. Without this, R-101 drowns in formatting noise.
- **A-3 · Conflict durability across resolution.** `conflicts()` and candidate `subject` refs must survive entity merges/splits via the alias layer — a conflict detected pre-merge must remain addressable post-merge (extends I-6).
- **A-4 · Batch incremental endpoint.** `conflicts_in_scope(scope, since_event)` for change-driven runs, plus `root_ref` grouping support on finding-class objects.
All three are additive and small; requested before v1 schema freeze.

## 11. Operation modes & the Diagnostic

**Incremental (default):** change events → affected-subgraph rule evaluation → signals → Examiner — the J3 fifteen-minute ripple. **Scoped scan:** `make mirror --scope` (entity, jurisdiction, document set) with instructions; the IDR-prep pattern. **The Mirror Diagnostic (the commercial run):** full-corpus orchestration — ingestion (PRD-03/04) → full rule sweep → Examiner over all signals → exposure rollup → **Diagnostic Report artifact** assembled (Assembler): findings with exhibits, exposure summary, gap registers, corpus statistics, sealed under a manifest — plus the staged **Reveal** (PRD-01 §6.15, one of the two sanctioned theatrical moments). Contractual SLA: report ≤ 48h from corpus completion at reference size (≤ 5k documents). The Diagnostic is fixed-fee, zero-liability (read-only over their material), and doubles as data migration: by its end, Veritax *is* the system of record.

## 12. Metrics

Precision per rule class — launch floor 0.8, critical-class target 0.9 by P2 · promoted-finding dismiss rate trending ↓ · calibration error within tolerance (PRD-15 gate) · exhibits completeness = 100% (no finding ships uncited — L1, hard gate) · time-to-triage P50 < 24h · re-verification catch rate (reopened/resolved-and-rechecked) reported, not targeted, in v1 · Examiner cost per promoted finding (COGS line) · Diagnostic SLA adherence · Verified-Coverage contribution (findings resolved → coverage up; the north-star linkage).

## 13. Phasing

**v0 (demo):** R-101/102/105, R-201/202/204 over the Helios corpus, Examiner narratives precomputed; lifecycle render-complete, transitions minimal; the live-trace path (one document → one updated finding) real end-to-end.
**v1 (design partner):** incremental event-driven operation; triage queue + dismiss taxonomy live; exposure v1 (classes above); the Diagnostic productized with report artifact and Reveal; per-rule precision dashboards; PRD-02 amendments A-2..A-4 consumed.
**v2:** R-3xx/4xx/5xx full (engine-coupled); cascade previews live; root-cause grouping; suppression proposals; reopen-on-reverify automation; standing-monitor generation from resolved critical findings (pending O-4 below).

## 14. Open questions

**O-1** Auto-promotion threshold start: 0.85 proposed — confirm after first 200 graded candidates. **O-2** Severity-override authority: manager for material/minor, VP-only for downgrading critical? (Lean yes; governance optics matter in diligence.) **O-3** Range-breach exposure convention default (median vs nearest-edge) — **assigned to S. Wrappe for ruling**; jurisdiction-config either way. **O-4** Auto-create standing monitors from resolved critical findings — lean yes, but it manufactures Watcher scope without explicit human definition; reconcile with L12's spirit before enabling. **O-5** Should the Diagnostic report include candidates (sub-threshold) in an appendix? Sales says yes (volume impresses); trust says careful (unproven items in a sealed artifact) — propose: counts yes, contents no.

— end —
