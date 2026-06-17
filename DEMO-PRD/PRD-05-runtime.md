# PRD-05 — Agent Runtime & Instructions

**Status:** Draft v1 · **Owner:** NG · **Inherits:** PRD-00 (L2, L3, L4, L10, L12), PRD-02 (Record API, staging, manifests) · **Serves:** PRD-03/04 (pipeline jobs), PRD-06 (Examiner), PRD-08 (Drafter/Checker), PRD-10 (Researcher/Clerk), PRD-11 (Watchers/Scenarios), PRD-12 (render jobs) · **Surfaces:** PRD-01 §6.7 (Runs), PAT-4/5/6
**Role:** every unit of work in Veritax — agentic, deterministic, or composite — executes inside this runtime. Domain PRDs define *what* their workers do; this PRD defines *how anything is allowed to run*. The cage, not the animals.

---

## 1. Problem & users

Five subsystems need to execute work with identical guarantees: pinned inputs, full traces, budget control, staging-only output, human gates, and reproducibility. Building those guarantees per-agent would produce five inconsistent trust models — and trust inconsistencies are what enterprise security reviews exist to find. The runtime centralizes them once. Users: every domain service (as job submitters), humans (via plans, gates, and the Runs surface), and PRD-15 (which consumes traces, costs, and eval hooks).

## 2. Owns / Consumes / Emits

- **Owns:** the job model and lifecycle; the plan object; the scheduler and priority lanes; the tool registry and sandbox; **derived authority** (§6); budgets, cost classes, metering; the **model registry and routing**; the instruction object, tiers, and **compiler**; gate *mechanics* (request, notify, delegate, escalate, decide); trace format; manifest assembly including **reads-are-pins** (§9); failure semantics, kill switches, circuit breakers.
- **Consumes:** Record commands and queries (PRD-02); the per-session/per-principal **capability map** (PRD-13); engine interfaces (PRD-07); calendar triggers (PRD-07 content + PRD-11).
- **Emits:** `run.*` lifecycle events; `gate.requested|delegated|escalated`; manifest registrations; cost and trace telemetry to PRD-15; `instruction.*` events.

## 3. Scope & non-goals

**In scope:** everything above, plus the API (§12) and the safety model (§11).
**Non-goals:** agent prompts, briefs, and behaviors (owned where used: 06/08/10/11); engine internals (07); gate *policy* — who must approve what (13; this PRD executes the derivation, never defines it); UI (01); eval content (15 — the runtime provides hooks and pins, not judgments); outbound transmission of any kind (L12 — there is no egress tool class; see §6).

## 4. The job model

```
job {
  job_id ULID, tenant_id,
  kind: agent | engine | pipeline | composite,
  initiator: {kind: user|watcher|system|commitment, ref},
  scope: {entity_ids[], jurisdictions[], object_refs[], period},
  plan_ref,                          -- §5; mandatory for agentic & composite kinds
  instruction_set: {set_hash, refs[]},
  pins: {corpus_version, rulepack_versions, model_versions},   -- frozen at start
  budget: {cost_class, token_ceiling, tool_call_ceiling, wallclock},
  idempotency_key, priority_lane,
  steps[]: {step_id, type: tool|engine|model|subjob, args_ref, result_ref, t0, t1, cost},
  status, failure: {class, detail_ref} NULL
}
```

**Lifecycle:** `queued → planning → running → producing (staging writes) → awaiting-gate | completed | failed(class) | cancelled | budget-exceeded`. Cancellation is always safe: staging-only output means nothing partial ever touched canonical state (L2). **Composite jobs** are DAGs of subjobs (the `make all` orchestration): independent branches continue on sibling failure by default; `fail-fast` available per submission; the composite's manifest aggregates its children's.

**Idempotency & retries:** at-least-once execution with idempotent staging writes (deduped on `idempotency_key + output_ref`); retry policy per failure class (tool transients retry with backoff; validation and refusal classes never retry — they return to a human); jobs exhausting retries park in a poison queue surfaced on the Runs surface with diagnostics.

## 5. The plan object (restate-before-run, made durable)

Every agentic or composite job begins as a **plan** — the compiled, previewable form of intent that PAT-4 renders:

```
plan { intent_restated, steps[]{action, scope, tool_class},
       invalidations_preview[],      -- computed via staleness DAG: what this will dirty
       produces[], est_duration, cost_class,
       instruction_echo, permission_verdict,   -- live, from capability map
       source: {user_command | inline_directive | commitment_ref | schedule_ref} }
```

Plans persist forever — they are part of the audit story ("what was this run *asked* to do"). Editing a plan recompiles it; approving converts it to a job with pins frozen at that moment. **Commitments compile to identical plan objects** (the Clerk is just another plan source), which is why meetings and keystrokes share one trust model. Scheduled and watcher jobs carry auto-approved plans within their pre-approved scope definitions — and *only* within them.

## 6. The tool sandbox and derived authority

**Tool registry.** Every tool declares: name, **capability class** (`read` | `engine-call` | `staging-write` | `export-prepare`), scope requirements, sensitivity ceiling, cost weight, rate limits. v1 tools: `record.get/subgraph/conflicts/timeline/current_value` (read), `retrieval.search` (read), `blob.read` (read, custody-aware), `engine.*` (engine-call, per PRD-07 catalog), `staging.put` (the only write), `export.prepare` (assembles an export *request* for human release — it transmits nothing).

**There is no egress class.** No tool sends email, pushes files, calls external APIs beyond read-connectors, or files anything (L12). Outbound acts are export actions executed by the export service behind per-destination human approval (PRD-12/13) — architecturally outside agent reach, not policy-outside.

**Derived authority (the rule that makes the sandbox safe):** a job's effective capabilities = **initiator's capability map ∩ the job kind's tool set ∩ the declared scope**. An agent can never see, read, or stage beyond the human (or owner-bound watcher) that launched it. Sensitivity tiers filter at the tool layer: privileged-vault refs are invisible — not denied, *absent* — to non-vault jobs. Watchers bind to a living owner: capability checks are evaluated live, so an owner losing scope pauses the watcher into an **orphan state** with a reassignment prompt to the workspace owner (resolves the departed-manager problem; see O-1).

## 7. Budgets, cost classes, and the model registry

Cost classes: `instant` (engine-only, sub-second), `standard` (single-agent investigation/draft), `heavy` (multi-document composition), `batch` (scans, refreshes — off-peak lanes). Each class carries token, tool-call, and wallclock ceilings; metering per step streams to PRD-15's COGS pipeline (gross margin is an engineering outcome — PRD-00 §28). `budget-exceeded` is a first-class terminal state with manager `raise & retry`. Tenant-level concurrency and monthly spend guards backstop everything.

**Model registry:** `{model_id, version, provider, capability_tags, cost_weight, eval_status_ref}`. **Routing policy lives here**: classification/extraction route to small models; drafting/investigation to large; the policy is configuration, versioned, and changes ship only through PRD-15 release gates. Jobs pin model versions at start; a mid-flight provider upgrade never changes a running job's behavior. Provider failover maps equivalent-eval-status models only — no silent capability downgrades.

## 8. Instructions: the object, the tiers, the compiler

**Object:** `{instr_id, tier, scope (org|jurisdiction|doc-type|section|object), text, compiled, status (draft|active|retired|superseded), author, approvals[], events}`.

**Tiers and permissions** (verdict computed live before submit, PAT-6): **style** (phrasing, formatting, house voice — any preparer, auto-active); **run** (single-execution parameters — executor within scope); **methodology** (anything altering analytical outcomes: screening criteria, method/PLI choices, exposure conventions, suppression scopes — manager+ approval required, and the approval is itself a gate).

**The compiler.** Natural language → typed directives via a constrained classification/parse step, schema-validated, then compiled to one of three targets (L3): **engine parameters** ("apply the Irish SBC election" → a flag on a deterministic engine — the model parses, the engine computes), **generation constraints** (Drafter/Checker rule sets), or **scope definitions** (Examiner/Watcher boundaries). Ambiguity never silently resolves: the plan's `intent_restated` carries the compiler's reading, and low-parse-confidence forces an explicit clarification before approval.

**The fact-conflict check (L4, enforced here).** Compiled directives are tested against the Record: any directive that would cause output to assert against current evidence is **refused**, with the conflicting assertions attached and the governed-edit path offered ("to state this, the Record must change — request the edit"). Refusal is a typed, logged outcome — and a PRD-15 eval target, because a refusal system that over-fires is as corrosive as one that under-fires.

**Composition & precedence:** within a tier, **narrower scope wins**; within identical scope, **later wins and supersedes** (audited). Tiers do not override each other — they gate *who may say it*, not *which statement wins*. Submit-time conflict preview shows the user exactly which existing instructions theirs would shadow (PAT-6). Every job manifest records the **active instruction-set hash** plus individual refs — "what instructions shaped this artifact" is a single lookup (PRD-00 L4: the instruction trail is evidence).

## 9. Traces and manifests — reads are pins

**Trace:** per-step records with tool name, argument *references* (content-bearing args store hashed refs, not raw content — sensitive material never duplicates into traces), result refs, timings, cost. Model steps store prompt/output refs under PRD-14 retention classes. Trace completeness is an invariant: a step without a trace fails the job.

**Reads are pins (the honesty mechanism for staleness).** Every Record read a job performs is *automatically* registered as an input pin and, at completion, as a dependency edge (`declare_dependencies` becomes runtime-automatic, not voluntary). This is what keeps invariant I-7 (never false-clean) true in practice: humans forget to declare dependencies; instrumented reads cannot. Manifest assembly at completion gathers: pins (auto), instruction set hash, gate refs, output hashes — and registers with PRD-02. **Amendment A-5 filed to PRD-02:** dependency edges arrive in high-volume batches at job completion; add a batch endpoint and edge-dedup on `(downstream, upstream, kind)`.

## 10. Gate mechanics

Derivation: on `staging.put` requiring promotion, the runtime asks PRD-13's policy for the required approver class (object type × sensitivity × instruction tier involved) and opens the gate: `{object_ref, staged_ref, diff_ref, requester, sla_due, chain}`. Notification rides the only realtime channel (PRD-00 L5). Decisions: **approve** → `Record.decide_gate` promotes; **request changes** → returns to producer with anchored comments (PAT-12), job may resume; **reject** → staged object discarded with mandatory reason. **Delegation** is time-boxed, person-to-person, logged, and visible on the gate card. **Escalation** is automatic on SLA breach, climbing the role hierarchy (the August-beach rule) with each hop logged. **Batch approval** exists only for identical-class items (same template, same diff class) and renders an itemized confirm — never a select-all. Four-eyes per object class is a PRD-13 config the runtime simply enforces.

## 11. Failure semantics and safety

Failure classes: `tool_error` (retryable), `timeout`, `budget`, `validation` (schema/contract — returns to producer), `refusal` (fact-conflict or permission — returns to human with evidence), `conflict` (staging collision — latest-staged wins is **wrong** here; collisions surface to the requester). Circuit breakers trip per tool on error-rate thresholds; **kill switches** exist per tenant and per agent kind (ops control, PRD-15) and halt scheduling without touching running jobs' staging guarantees. The system's worst possible failure mode is, by construction, *a stale proposal nobody approved* — never a wrong fact in the Record.

## 12. API (consumed by domain services and PRD-01)

`compile_plan(intent, scope, source)` → plan · `approve_plan(plan_id)` → job · `submit_job(spec)` (engine/pipeline kinds, plan-exempt) · `cancel(job)` · `raise_budget(job)` · `get_run(job)` / `stream(run)` · `instruction.submit|approve|retire` (tier-authorized) · `gate.decide|delegate` (13-authorized) · `tool.register` (deploy-time only) · `schedule.register(trigger, plan_template, owner)`.

## 13. Cross-PRD resolutions and amendments

- **A-5 → PRD-02:** batch dependency-edge endpoint + dedup (per §9).
- **Requirement → PRD-13:** the capability map must be queryable *per job* for derived-authority intersection (§6), including live re-checks for long-running watchers.
- **For PRD-06:** the Examiner runs as `kind: agent`, `cost_class: standard` (signal investigations) / `batch` (diagnostic sweeps); signals arrive as scoped plan templates — no Examiner-specific runtime carve-outs needed.
- **For PRD-10:** the Clerk's commitment-plans are ordinary plans with `source: commitment_ref` (§5) — already covered.
- **Precedent reaffirmed from PRD-06:** plans, proposals, and candidates are *work objects* and may auto-instantiate within pre-approved scopes; nothing in this runtime can instantiate a *fact*.

## 14. Metrics

Plan fidelity: % of plans edited before approval (target ↓ over time — the compiler is learning to restate); refusal correctness on sampled fact-conflicts (PRD-15 graded); gate latency P50 < 24h / P95 < 72h with escalation-fire rate reported; trace completeness = 100% (hard gate); zero canonical writes outside the promote path (shared with I-2); cost per job class trending against PRD-15 COGS targets; watcher orphan resolution time; kill-switch drill quarterly = pass.

## 15. Phasing

**v0 (demo):** jobs + traces + staging + single-approver gates; **reads-are-pins live from day one** (it is cheap and retrofitting it is not); style-tier instructions; minimal plans (restate + steps).
**v1 (design partner):** full tier system + compiler with fact-conflict refusal; delegation/escalation; budgets + metering; model registry with routing; watcher scheduler with derived authority and orphan handling; poison queue.
**v2:** composite `make all` orchestration; batch-identical approvals; circuit breakers and kill-switch drills; commitment-sourced plans (Clerk); schedule registry full (pre-close, doc-cycle kickoff, ICA sweep, safe-harbour retests).

## 16. Open questions

**O-1** Watcher orphaning: pause-and-reassign (specced) vs auto-inherit by workspace owner — pause is safer, inherit is smoother; design partner feedback decides. **O-2** Trace retention horizon for model I/O refs (cost vs forensic value) — align with PRD-14 classes; propose 24 months for gate-adjacent jobs, 6 for batch. **O-3** Plan editing granularity: free-text recompile only (specced) vs per-step toggles — toggles invite Franken-plans the compiler never validated; hold the line unless users revolt. **O-4** Should `instant`-class engine jobs skip plan objects entirely (current spec: yes, plan-exempt) even when user-initiated from Scenarios? Lean yes — a deterministic recompute needs no restatement — but confirm the audit story satisfies PRD-15.

— end —
