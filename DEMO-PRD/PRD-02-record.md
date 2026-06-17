# PRD-02 — The Record

**Status:** Draft v1 · **Owner:** NG · **Inherits:** PRD-00 (Laws L1–L12, object model §9–10) · **Pressure-test partner:** PRD-06 (Mirror) — this schema is not final until Mirror's queries have been written against it.

---

## 1. Problem & users

Every other subsystem needs one thing this PRD provides: a store that can answer *"what do we know, with what provenance, as of when, and who let it in?"* — and prove its answer. Users of this PRD are services, not humans: ingestion writes observations into it; Mirror queries conflicts out of it; Factory compiles projections of it; gates are the only door through which its canonical state changes; manifests pin its versions so any output can be reproduced. The Record is also the company's deepest moat-in-waiting: switching cost, audit defensibility, and the agents' institutional memory are all properties of this one subsystem.

## 2. Owns / Consumes / Emits

- **Owns:** the event log; persistence and versioning for all core objects (PRD-00 §9); the assertion model; manifests; the dependency/staleness graph; period sealing; the canonical query API; `corpus_version`. *Ownership split with domain PRDs:* PRD-02 owns the **persistence model and integrity guarantees**; domain PRDs (06, 08, 11…) own **semantics and lifecycle policy** (e.g., what severities mean, when a finding may transition). The schema enforces structure; domain services enforce meaning.
- **Consumes:** commands — `append_event`, `submit_assertions`, `request_gate`/`decide_gate`, `governed_edit`, `seal_period`, `declare_dependencies` — from the runtime (PRD-05), ingestion (PRD-03), resolution (PRD-04), and review (PRD-09).
- **Emits:** the **change-event stream** (outbox; at-least-once; per-consumer offsets) that every other service subscribes to; staleness notifications; gate-request events; seal events.

## 3. Scope & non-goals

**In scope:** event log + projections; the two-tier truth model (§4); bitemporal semantics; identity & references; manifests; the staleness DAG; sealing; the service API; invariants and their tests; tenancy/RLS hooks; v0→v1 migration plan.
**Non-goals:** blob storage internals, encryption keys, retention execution (PRD-14 — this PRD stores `key_ref` + ciphertext for PII fields and `blob_ref` + hash for content, nothing more); search/embedding indexes (PRD-10; rebuildable derived data); extraction and resolution logic (03/04 — they *produce* assertions, this PRD *keeps* them); permission **policy** (PRD-13 — this PRD enforces tenant RLS and exposes scope/sensitivity predicates; it never decides who may see what); any UI.

## 4. The two-tier truth model (the load-bearing idea)

The Record holds two kinds of state with different mutation rules — collapsing them is how systems of record rot:

**Tier 1 — Observations (assertions).** Atomic facts with provenance, confidence, and two time axes. Created *freely and continuously* by extraction, engines, and humans — no gate required, because an observation is not a claim of truth; it is a record that *a source said X*. Observations are append-only and never edited; correction = a superseding assertion or a retraction (knowledge-time close). **Conflicting observations are not an error state; they are the product** — Mirror exists to find them.

**Tier 2 — Canonical state (governed objects).** The fields the system treats as *the* answer: entity master data, policies, account mappings, document content and status, finding lifecycle states, obligation status, instruction sets. Canonical state mutates through exactly two doors (L2): **gate promotions** (staged value + approval) and **governed edits** (human change + required approval + reason). Every canonical row carries the event reference that last changed it.

Derived between the tiers: **current-value resolution** — for any subject/field, the canonical answer derives from the assertion set via an explicit precedence policy (human-confirmed > executed-agreement extraction > engine output > document mention), materialized as views. The *mechanism* (precedence evaluation, materialization) is owned here; the *policy* (the ordering, per field class) is owned by PRD-04/06 and stored as versioned configuration — so changing precedence is itself an audited event.

## 5. Architecture

**Boring technology, exotic schema.** v0–v1 is PostgreSQL only: the event log is a hash-chained append-only table; projections are relational tables maintained transactionally with event append (same-DB outbox pattern); blob content lives in object storage (PRD-14) referenced by hash. No Kafka, no exotic graph DB, no event-store product until scale demands it (§13, O-1). Neo4j/Qdrant-class stores, if used, are *derived and disposable* — rebuildable from log + blobs, never authoritative.

**Write path (the only ones):**
1. `submit_assertions` → validates provenance completeness (I-3) → appends `assertion.recorded` events → inserts assertion rows → enqueues change events → staleness propagation.
2. `decide_gate(approve)` → appends `gate.decided` + `canonical.promoted` events → applies staged diff to canonical rows → change events → staleness.
3. `governed_edit` → same shape with `edit.applied`, requiring approval ref + reason.
4. `seal_period` → appends `period.sealed`; thereafter any write whose valid-time falls in the sealed slice and targets canonical state is **rejected at the write path** (I-4) — superseding versions in open periods remain possible and are linked.
There is no fifth path. No service holds direct table write grants except the Record service itself.

**Read path:** every query takes a **lens**: `(valid_at, known_at)` — defaulting to (now, now). The UI's Fiscal-Year Lens compiles to `valid_at = FY slice`; the "as filed" toggle sets `known_at = filing/seal timestamp`. Bitemporal reads are index-supported (§6) and the API refuses lens-less canonical queries to prevent accidental "timeless" reads.

## 6. Data model (schema sketches)

Sketches are normative for shape, not for final DDL. All tables: `tenant_id` first column; RLS by tenant (I-8); IDs are ULIDs; `Ref` = `(object_type, object_id [, version])`.

```sql
-- THE LOG (sacred)
events (
  tenant_id, seq BIGSERIAL,            -- per-tenant monotonic
  event_id ULID, type TEXT,            -- taxonomy §7
  actor JSONB,                          -- {kind: user|agent|system, id, on_behalf_of?}
  payload JSONB,
  occurred_at TIMESTAMPTZ,
  manifest_ref ULID NULL,               -- set for job-produced events
  prev_hash BYTEA, hash BYTEA,          -- chain per tenant (I-1)
  PRIMARY KEY (tenant_id, seq)
) -- partitioned by tenant_id; INSERT-only role; UPDATE/DELETE revoked at DB level

-- TIER 1: OBSERVATIONS
assertions (
  tenant_id, assertion_id ULID,
  subject JSONB,                        -- {object_type, object_id, field}
  value JSONB,
  valid_from DATE, valid_to DATE NULL,          -- domain time
  asserted_at TIMESTAMPTZ, retracted_at NULL,   -- knowledge time
  source JSONB,                         -- {kind: extraction|engine|human|reviewer,
                                        --  doc_ref?, span?, extractor_ver?, rulepack_ver?, user_id?}
  confidence NUMERIC NULL,              -- calibrated; NULL for human/engine
  supersedes ULID NULL,
  sensitivity SMALLINT DEFAULT 0,       -- 0 general / 1 sensitive / 2 privileged
  scope_keys JSONB                      -- denormalized {entity_ids[], jurisdictions[]} for L9 predicates
)
-- indexes: (subject), GiST on (valid_from, valid_to), (asserted_at), partial on retracted_at IS NULL

-- TIER 2: CANONICAL (representative tables; one per core object)
entities (tenant_id, entity_id, name, jurisdiction, role_in_group, elections JSONB,
          status, sensitivity, last_change_event BIGINT, ...)
entity_aliases (tenant_id, alias_text, source_ref JSONB, entity_id, resolved_by, resolved_at)
  -- aliases are PERMANENT (I-6): merges add aliases, never delete; provenance survives people and merges

flows (tenant_id, flow_id, from_entity, to_entity, kind, method, policy JSONB,
       agreement_ids ULID[], status, last_change_event, ...)
agreements (tenant_id, agreement_id, parties ULID[], kind, effective DATE, terminates DATE NULL,
            exec_status TEXT,           -- executed|expired|draft|missing(gap-row)
            doc_ref JSONB, terms JSONB, last_change_event)
documents (tenant_id, doc_id, doc_type, jurisdiction, period_id, lang, status, outline JSONB)
doc_sections (tenant_id, section_id, doc_id, position, content_blob_ref, content_hash,
              input_chips JSONB[],      -- refs this section was compiled from (PAT-1 backbone)
              version INT, status TEXT) -- generated|edited|stale|blocked|approved
findings (tenant_id, finding_id, severity, rule_id, state, flow_ref, exposure JSONB,
          exhibit_refs JSONB[], confidence, assignee, reviewer JSONB, ...)
obligations (tenant_id, obligation_id, entity_id, jurisdiction, due_at TIMESTAMPTZ,
             due_tz TEXT,               -- deadline dies at midnight IN THAT JURISDICTION
             owner, status, artifact_ref NULL, filing_evidence_ref NULL, source TEXT) -- rulepack|customer
periods (tenant_id, period_id, fy, quarter NULL, status TEXT, sealed_event BIGINT NULL)
instructions (tenant_id, instr_id, tier SMALLINT, scope JSONB, text, compiled JSONB,
              status, author, approved_by NULL, created_event)

-- GOVERNANCE & REPRODUCIBILITY
gates (tenant_id, gate_id, object_ref JSONB, staged_diff_ref, requested_by, requested_at,
       sla_due, decision NULL, decider NULL, decided_at NULL, delegate_chain JSONB[])
staging_objects (tenant_id, staging_id, object_ref, proposed_value_ref, produced_by_run, gate_id NULL)
manifests (tenant_id, manifest_id, job_ref, corpus_version BIGINT,
           rulepack_versions JSONB, model_versions JSONB,
           instruction_refs ULID[], gate_refs ULID[],
           input_pins JSONB,            -- {ref: version} for every consumed object
           output_hashes JSONB)
artifacts (tenant_id, artifact_id, manifest_id, format, blob_ref, content_hash,
           sealed BOOL, sealed_event NULL)    -- sealed ⇒ WORM in blob store (PRD-14)

-- STALENESS DAG
dependencies (tenant_id, downstream_ref JSONB, upstream_ref JSONB, kind, declared_by_run, declared_at)
dirty_flags (tenant_id, object_ref JSONB, dirtied_by_event BIGINT, reason JSONB, created_at)
rebuild_proposals (tenant_id, proposal_id, targets JSONB[], cause_events BIGINT[],
                   status TEXT)         -- proposed|accepted|skipped — NEVER auto-executed (I-7/L2)
```

**Staging is a first-class table, not a status flag** (resolves PRD-01-era open question): staged values are versioned object snapshots referenced by gates; promotion copies the snapshot into canonical and records both events. Rationale: clean diff rendering (PAT-5 needs `staged vs current`), safe cancellation, and zero risk of half-promoted status flags.

**`corpus_version`:** a per-tenant monotonic counter incremented once per committed ingestion batch (not per document). Manifests pin it; "corpus v.418" in the UI is this number. Cheap, human-legible, replay-anchoring.

## 7. Event taxonomy (initial set)

`ingestion.received | classified | versioned | problem` · `assertion.recorded | retracted | superseded` · `resolution.alias_added | merged | split | mapping_proposed | mapping_applied` · `gate.requested | delegated | escalated | decided` · `canonical.promoted` · `edit.applied` · `run.started | step | completed | failed | cancelled` (mirrored from PRD-05 with manifest refs) · `dependency.declared` · `staleness.dirtied | proposal_created | proposal_resolved` · `period.opened | closing | sealed` · `instruction.submitted | approved | retired` · `artifact.rendered | sealed | superseded`.
**Access/read events are NOT in this log** — they flow to the separate audit stream (PRD-13/14). Rationale: read volume would drown the domain log, and separation enforces control-without-content at the storage layer.

## 8. Bitemporal & sealing semantics

- Assertion truth at lens `(v, k)`: rows where `valid_from ≤ v < coalesce(valid_to,∞)` AND `asserted_at ≤ k` AND `(retracted_at IS NULL OR retracted_at > k)`.
- Canonical state at a lens reconstructs from the event log up to `k` (materialized snapshots per sealed period make this O(1) for the common "as filed" reads).
- **Sealing:** `period.sealed` freezes the valid-time slice for canonical writes (I-4), marks period artifacts sealed (WORM), and snapshots canonical state for fast historical reads. Dirty propagation into sealed scope produces `superseded-candidate` flags on artifacts — visible, never mutating (PRD-00 J3 behavior).
- v0 simplification: knowledge-time columns exist and populate from day one, but lens queries may pin `k = now` until v1 ships the full reconstruction path (§13).

## 9. Staleness mechanics

Runs declare consumed refs+versions at completion (`declare_dependencies`); edges persist. On any change event touching an upstream ref: recursive propagation (CTE for shallow graphs; async worker beyond depth/width thresholds) inserts `dirty_flags`, coalesces them into `rebuild_proposals` per surface scope, and emits notifications. **Conservatism invariant (I-7): false-dirty is acceptable; false-clean is forbidden** — when in doubt, dirty it. Propagation target p95 < 5s from change event to proposal visibility. Sealed targets are exempt from dirty (flagged superseded-candidate instead).

## 10. Service API (consumed by PRDs 03–12)

**Commands** (all idempotent via caller-supplied keys; all emit events): `append_event` · `submit_assertions(batch)` · `stage(object_ref, proposed)` · `request_gate` / `decide_gate` · `governed_edit` · `declare_dependencies` · `seal_period` · `register_manifest` / `register_artifact`.
**Queries** (all lens-parameterized): `get(ref, lens)` · `subgraph(root, spec, lens)` · `timeline(ref)` · `conflicts(subject)` → competing assertion sets with provenance (Mirror's primitive) · `current_value(subject)` → precedence-resolved · `dirty_set(scope)` · `manifest(id)` + `pins(manifest)` for replay.
**Stream:** `subscribe(consumer, from_offset, filters)` — at-least-once; consumers must be idempotent.
**Refusals:** lens-less canonical reads; writes into sealed slices; assertions without complete provenance; canonical mutations without gate/edit refs. Refusals are typed errors, not silent drops.

## 11. Invariants → tests (the contract with the Laws)

| # | Invariant | Enforces | Test |
|---|---|---|---|
| I-1 | Events are append-only; hash chain verifies end-to-end | L10 | nightly chain walk; DB grants forbid UPDATE/DELETE |
| I-2 | Every canonical change references a gate decision or governed-edit approval | L2 | FK + property test over event log |
| I-3 | Every assertion has complete provenance for its source kind | L1 | write-path validation + sampling audit |
| I-4 | Writes into sealed valid-time slices are rejected | L8 | write-path test matrix per object type |
| I-5 | No artifact without a manifest; no manifest with unpinned inputs | L10 | FK + replay smoke test (byte-identical re-render of a golden Dossier) |
| I-6 | Aliases and provenance survive merges, splits, and user departure | L11 | merge/split property tests |
| I-7 | Staleness never false-clean | L2/PAT-3 | mutation-fuzz: every upstream change dirties all declared downstreams |
| I-8 | Tenant isolation absolute | L9 | RLS tests + cross-tenant query canaries in CI |

A release that breaks any invariant test does not ship — these are PRD-15's first regression gates, available before any model eval exists.

## 12. Scale & performance targets (v1)

Per tenant: 500 entities, 2,000 flows, 5,000 agreements, 50k documents, 5M assertions, 50M events. Reads: `get+lens` p95 < 100ms; `conflicts(subject)` p95 < 300ms; `subgraph` (Graph surface) p95 < 500ms. Writes: assertion batch (1k) < 2s committed; gate decision < 500ms. Staleness propagation p95 < 5s. Event lag (commit → consumer) p95 < 2s. Sealed-period snapshot read O(1).

## 13. Phasing & proposed amendment to PRD-00

**v0 (Wave 0, demo):** full schema shapes; **event log live from day one** (a hash-chained insert-only Postgres table is ~free, and retrofitting event-sourcing is the single most expensive migration this company could face); assertions with provenance; staging+gates minimal (single approver); staleness as direct dependency table with synchronous propagation; lens pinned to `k=now`; single tenant, RLS scaffolding present.
**v1 (Wave 1):** bitemporal reconstruction reads, sealing, manifest replay test, precedence-policy configuration, async propagation, multi-tenant RLS enforced.
**v2 (Wave 2+):** sealed-period snapshots, partition strategy, log-service evaluation (O-1), crypto-shredding field hooks live (with PRD-14).

**Proposed amendment A-1 to PRD-00 §27 (P0 row):** change "defer event sourcing to v1" → "event log live in v0; bitemporal *reads* and sealing deferred to v1." Rationale above; cost ≈ two days now versus a migration measured in months later. Requires owner sign-off per PRD-00 governance.

## 14. Metrics

Invariant-test failures = 0 (release gate) · replay determinism: golden-Dossier re-render byte-identical = pass · % assertions with resolvable provenance ≥ 99.9% (feeds the L1/citation metric) · event lag and propagation latencies vs §12 · gate decision latency feeding the product P50 < 24h target · zero cross-tenant canary hits.

## 15. Open questions

**O-1** Log scale-out trigger: at what event volume does Postgres partitioning give way to a dedicated log? (Decide on evidence; revisit at 10M events/tenant.) **O-2** `doc_sections.content` — confirmed blob-ref + hash (in-row text rejected for size/versioning); any exceptions for tiny structured sections? **O-3** Precedence-policy granularity: per field class (recommended) vs per field — Mirror's pressure-test (PRD-06) decides. **O-4** Should `findings` live fully canonical here or split candidate-tier (observation-like) vs promoted-tier? Current design: candidates are assertions of type `finding.candidate`; promoted Findings are canonical — confirm against PRD-06 triage UX. **O-5** Snapshot cadence for sealed periods (per seal vs per quarter) — measure first.

— end —
