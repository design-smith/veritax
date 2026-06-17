# PRD-00 — VERITAX: The Master Document

**Status:** v1.1 — complete · **Owner:** NG
**Audience:** every future engineer, designer, advisor, and diligence reader. All other PRDs (01–15) inherit their vocabulary, laws, and object model from this document. Where another PRD conflicts with this one, this one wins until formally amended.
**Relationship to design system:** the visual design system exists separately and is authoritative for aesthetics. This document specifies concept, behavior, structure, and machinery — never pixels.

**How to read this document.** Part I is the idea — read it to understand *why anything else exists*. Part II is the law — twelve principles that every surface, agent, and schema must obey; when in doubt anywhere in the system, resolve by these. Part III is the nouns — the object model everything is built from. Part IV is the experience — how it behaves and feels, defined through interaction grammar and seven canonical journeys that function as executable acceptance tests in prose. Parts V–VII (machinery, trust, plan) complete the document.

---

# PART I — THE IDEA

## 1. The product in one sentence

**Veritax is the system of record for the internal economy of multinational companies** — every entity, agreement, price, payment, and proof between sister companies — entering the market through transfer pricing and global-minimum-tax compliance, and expanding along a trust ladder from keeping the record, to producing the paperwork, to guaranteeing the positions, to ultimately moving the money.

The company in one paragraph: a multinational is not one company but a network of hundreds of legal entities trading with each other — by most estimates a third or more of all world trade is this related-party trade — and that internal economy has no operating system. Its contracts are scattered and stale, its prices drift from policy, its records contradict each other across jurisdictions, and the evidence governments demand of it is assembled by hand, annually, at a cost of roughly $50B a year in Big Four tax fees and well over $100B including in-house payroll. Veritax builds the canonical, versioned, machine-maintained record of that economy — the **Intercompany Graph** — and deploys supervised AI agents against it to find the contradictions before tax authorities do, generate the compliance deliverables as projections of the record, monitor the economy continuously between filing cycles, and eventually stand behind the positions and settle the flows. Tax is the wedge because tax is where the pain, the deadlines, and the budget live. It was never the prize.

## 2. The world as it is

Five facts define the market this product enters.

**2.1 The projections problem (the original sin).** A tax department's underlying reality — entities, transactions, prices, results, positions — is never maintained as an object. What gets maintained, by hand, are its *projections*: the German Local File, the Master File, the Excel RAG status tracker, the CFO's quarterly slides, the audit committee page, the auditor's support package, the Form 3CEB, the intercompany matrix spreadsheet guarded by one irreplaceable analyst. The same facts, re-keyed into five formats for five audiences, every quarter, forever — drifting independently. This is precisely why a German Local File can state a 4.0% royalty while the group Master File states 5.5% for three consecutive years and nobody notices until an examiner does. Every competitor automates a projection. Veritax maintains the object and *generates* the projections.

**2.2 The fee pool and the leverage pyramid.** Big Four tax practices bill on a pyramid: partner judgment at the top (~15% of the fee), armies of staff doing data gathering, drafting, benchmarking, and formatting beneath it (~85%). US penalty-protection documentation under §6662(e) carries no legal requirement of external authorship — the Big Four logo is comfort, not law. The pyramid's bottom 85% is automatable work currently priced as professional labor. Veritax does not ask clients to abandon their advisors; it gives clients ownership of the factory and turns the advisor into a reviewer inside the platform — collapsing the leverage model while preserving the liability comfort.

**2.3 The talent cliff.** The accounting pipeline is collapsing — graduates down sharply for years, TP specialists retiring, Big Four attrition brutal — exactly as the paperwork multiplies. Deadlines create urgency; the labor shortage creates a decade of structural demand. The deadline was Pillar 2; the decade is the cliff.

**2.4 Regulatory multiplication.** The first GloBE Information Return season (deadline 30 June 2026) forced thousands of groups through an Excel-and-panic fire drill, and the obligations now recur and multiply: annual GIRs, QDMTT returns across dozens of jurisdictions, DAC9 exchanges, safe-harbour re-testing every period, amended filings. The January 2026 Side-by-Side package relieved US-parented groups of IIR/UTPR exposure but left QDMTTs as the persistent enforcement layer and left non-US-parented and newly in-scope groups fully exposed. The compliance burden is permanent, layered, and growing faster than the people available to carry it.

**2.5 The enforcement era.** After decades of losing major transfer pricing cases, tax authorities are winning — Coca-Cola, Altera, and a docket of multi-billion-dollar disputes — armed with cross-jurisdiction data exchange. Corporate tax functions are under direct CFO and audit-committee pressure to professionalize positions and documentation. The cost of internal contradiction has never been higher; the tooling to find contradictions has never existed.

**2.6 Why incumbents can't.** The firms with the domain depth to build this are structurally conflicted: software that deletes billable staff hours cannibalizes the leverage pyramid that pays their partners. The software incumbents automate single projections (a documentation tool, a Pillar 2 calculator) without the underlying record. And the work itself is a schlep — boring, regulated, repulsive to most engineers — which is exactly why it has been left alone.

## 3. The thesis — two levels, two scripts

**3.1 The business thesis (the ladder to the prize).** Own the record → own the work → own the risk → own the flows. Stage one, the system of record (Mirror) creates switching costs and trust. Stage two, the factory (Factory/Monitor) captures work currently priced as professional labor. Stage three, underwriting (Assure): when the Graph plus accumulated audit outcomes can price the risk of a position better than anyone, stop selling drafts and sell insurance-wrapped certainty — converting documentation fees into underwriting margin. Stage four, settlement (Settle): once the record knows what every intercompany price should be and was, executing the payments is one step away — and then compliance inverts from a deliverable into a byproduct of the rails, paid in basis points on one of the widest money rivers on earth. Tax is the regulatory shadow of the intra-company economy; Veritax starts in the shadow and ends owning the substance.

**3.2 The architectural thesis (the experiment).** At its core, Veritax is an experiment in how humans and AI systems work side by side: not an oracle the human visits with copy-pasted context, but a *colleague* that lives where the work lives, holds context permanently, and knows what needs doing before being told. The architecture *is* the thesis: the bitemporal Graph is the agent's institutional memory; the job runtime with staging and human gates is the trust protocol by which agents earn the right to act near consequential things; standing instructions are the delegation language (teach once, never repeat); the verification queue is how humans teach machines without experiencing it as data entry; the Clerk and the Briefing are the anticipation layer. Transfer pricing was chosen as the laboratory because it is the hardest possible test: the most conservative users, legal stakes on every sentence, evidence requirements on every claim. If the side-by-side pattern works here, it works anywhere.

**3.3 The discipline clause.** The experiment earns the right to generalize only by winning the niche outright. The abstraction is always forged under the constraint of delighting the tax user — never the reverse. Customers must never smell the experiment.

**3.4 The Two Scripts (normative communications law).** Internally and to investors: "agentic," "the intra-company economy," "the architecture for human-agent work." In the product UI and to customers: "processes," "runs," "the record" — never "autonomous agents," never the rails pitch. The buyer's nightmare is a robot improvising near a government filing; what we sell them is *more control than they have today*. Same machinery, opposite emotional register. Every PRD, every UI string, every sales asset declares which script it speaks.

## 4. What Veritax is — and is not

**Is:** a system of record with a supervised agent workforce attached; a compliance factory whose outputs are projections of a verified graph; a review-and-signature venue that puts the customer's chosen professional firm inside the workflow; a monitoring instrument tuned to the provision calendar; eventually a guarantor and a settlement layer.

**Is not (v1 hard boundaries):** not a professional advisor (outputs are preparer-assist requiring professional review; the sign-off ceremony explicitly allocates responsibility to the human or firm who signs); not a filer (nothing is ever submitted to any authority by the system; filings are human acts supported by perfect artifacts); not autonomous (no agent acts outward, writes to the record directly, or expands its own scope — ever); not a chatbot (the AI presents as a meticulous clerk with receipts, surfaced through findings, briefs, and one quiet command bar); not a BI tool (analytics live in the product; external BI connects to a governed live semantic layer, never to exported dashboard files); not return software (v1 feeds Corptax/ONESOURCE-class systems rather than replacing them).

## 5. The Trust Ladder (product strategy as sequence)

Each rung is a product, a liability posture, and a prerequisite for the next. Rungs ship in order; the UI shows the whole ladder with future rungs visibly locked — roadmap as interface.

| Rung | Product | Promise | Output class | Liability posture |
|---|---|---|---|---|
| 1 · **Mirror** | Diagnostic + system of record | "We find the contradictions in your own files before an examiner does." | Findings, the Graph, answers — nothing filed | Zero: read-only over their material |
| 2 · **Factory** | Document compilation + Review Mode | "Your deliverables generate from the record and your firm signs them at a fraction of the cost." | Drafts-for-review → signed artifacts | Preparer-assist; signature allocates responsibility |
| 3 · **Monitor** | Operational TP + Pillar 2 watch | "Nothing drifts out of range or past a deadline unseen, on your provision calendar." | Alerts, scenarios, true-up packs | Decision support |
| 4 · **Assure** | Underwritten positions | "Guaranteed — if an authority disagrees, the insurance behind us pays." | Insurance-wrapped positions | Risk transfer (licensed/partnered) |
| 5 · **Settle** | Intercompany settlement rails | "The payment and its evidence are the same object." | Executed flows + auto-evidence | Regulated financial infrastructure |

Engineering sequence and sales sequence are deliberately the same sequence.

## 6. Users, buyers, and the org reality

**6.1 ICP (beachhead): the newly in-scope.** Two populations sharing one buying profile — acute pain, small team, fast procurement, no incumbent tooling, no internal-build option: (a) companies crossing the €750M Pillar 2 threshold with three-to-fifteen-person tax teams suddenly owing global compliance; (b) AI-native and high-growth companies that entity-sprawled across ten-plus countries in a few years with no tax stack and no Big Four lock-in. Fortune-100 hyperscalers are explicitly *not* year-one targets; they become controversy-lab design partners later, mediated through counsel.

**6.2 Personas and altitudes** (full spec in PRD-01 §1): VP Tax / CTO decides and signs (minutes per day); TP Manager directs and promotes (hours per day — the primary daily user); Analyst produces and proposes (hours per day — the verification queue and document workspace live here); adjacent internal roles (Legal owns agreements, Treasury owns loans and settlement, Controllership consumes true-up packs, Internal Audit reads); external roles (firm reviewer in Review Mode, local advisors in a request portal, the financial-statement auditor in a read-only evidence room, outside counsel administering the privileged vault).

**6.3 The buyer map.** Economic buyer: VP Tax/CTO with CFO sign-off above ~$150K. Champion: the TP manager whose weekends the product returns. Channel and force multiplier: second-tier firms (Ryan, Andersen, A&M, BDO, GT classes) who adopt Review Mode to take share from the Big Four; their in-platform review hours seed the eventual reviewer marketplace. **Saboteur risk:** the analyst whose heroic spreadsheet the Graph replaces — countered by product design (the verification queue positions them as the system's teacher) and program design (certification converts threatened experts into invested ones).

## 7. Why now (the four-force stack)

(1) **The "never again" window:** GIR season one just ended in Excel and adrenaline; budgets for season two are being set now, and the obligations recur forever. (2) **The talent cliff** supplies demand no deadline expiry can remove. (3) **The capability threshold:** language models crossed the line where the pyramid's bottom 85% — reading, reconciling, drafting with citations — became automatable, while deterministic engines keep the math defensible. (4) **The incumbent paralysis:** the firms are conflicted, the software vendors automate projections without the record, and the schlep filter has kept generalist AI startups out. Add the company-specific asset: the most credentialed advisor bench available in the category, and a published postmortem channel into the exact buying moment.

## 8. Alternatives and the one-line counters

| Alternative | What it is | The counter |
|---|---|---|
| Status quo | Excel trackers + Big Four engagements | "You're paying professional rates for the 85% of the pyramid that is now machinery — and the contradictions are still in your files." |
| Documentation-tool incumbents | Single-projection automation (docs or Pillar 2 calc) | "A faster way to produce one projection of a record nobody keeps. We keep the record." |
| Big Four internal AI | Firm-side cost compression | "Their efficiency, their margin, your same invoice — and your data lives in their engagement, not your system of record." |
| Build internal | Hyperscaler-only option | "Entity resolution, jurisdiction content, and the eval harness are a company, not a project — and your tax team needed it last quarter." |

---

# PART II — THE TWELVE LAWS

Every surface, agent, schema, and PRD obeys these. Each law states the rule, the reason, and the consequence it forces in UI and backend. Conflicts between laws escalate to this document's owner; no PRD may waive a law locally.

**L1 — Cited or quarantined.** Every claim and figure the system asserts carries resolvable provenance — a citation to a source span or a lineage chain to a ledger line. Output lacking provenance is quarantined: visibly marked, excluded from exports, never silently hidden. *Because* in this domain an unsupported sentence is not a draft flaw, it is an audit exposure. *Forces:* PAT-1/PAT-2 components everywhere; export guards; the citation-entailment checker (Part VI).

**L2 — Propose, don't commit.** No agent and no UI control mutates the Record directly. All produced state lands in **staging**; humans **promote** through gates; the Record changes only by promotion or by governed human edit with approval. *Because* trust is earned through reversibility and visible control. *Forces:* the staging/gate state machine (PRD-05); gate cards (PAT-5); the absence of any "save to record" button anywhere.

**L3 — Math is deterministic; language is probabilistic; the boundary is visible.** Calculations (GloBE/QDMTT, interquartile math, true-ups, cascades, schema validation) run only in versioned deterministic engines; models draft, classify, extract, and investigate. Every figure is badged *computed · rulepack vX*; every drafted passage is badged *drafted · cited*. Natural-language instructions may *parameterize* engines but never replace them. *Because* defensibility requires reproducible arithmetic, and reviewers must know what kind of artifact they are reviewing. *Forces:* the rulepack VM (PRD-07); badge components; the instruction compiler's three targets.

**L4 — Instructions govern expression and scope, never facts.** Users direct *how* things are said and *what* is in scope; no instruction can make the system assert what the Record contradicts. Conflicting instructions are refused with the evidence attached; the remedy is a governed edit to the Record, never a prose override. All instructions are logged into manifests — the instruction trail is itself evidence. Instructions carry permission tiers (style: open; run: scoped; methodology: manager+). *Because* an instructable system without this law is a machine for manufacturing the inconsistencies we detect. *Forces:* the instruction object and tier model (PRD-05); refusal flows; manifest schema.

**L5 — Exceptions, not noise.** The system surfaces deltas, breaches, and decisions — never inventories, never daily tickers. Cadence follows the provision calendar and user-set digests; nothing pings daily by default; the only realtime channel is gate requests. *Because* tax teams live by quarterly closes and trust instruments that respect their attention. *Forces:* Briefing-as-generated-brief; digest center; alert policy editor; the deliberate absence of a "live ETR" feed.

**L6 — Edit upstream; export renderings.** Record-class artifacts are modified inside the system (directives, redlines, Review Mode) where every change re-passes self-check; exports are renderings stamped with manifest IDs and verification hashes. Communication-class artifacts (decks, memos) generate native and are released freely. External edits to record-class documents round-trip through check-out/check-in reconciliation. *Because* the moment an exported Word file is edited on a desktop, the record and the document diverge — the disease we cure. *Forces:* the two-class export dialog (PAT-10); the reconciliation flow (PRD-09/12); page-footer hashes.

**L7 — Custody follows evidentiary need.** Four custody classes — Materialize, Extract-only, Reference, Never-store — assigned per source and object, visible in the UI. The membership rule: **anything cited must be materialized** (hashed, versioned, immutable); facts are extracted and raws discarded where possible (data minimization); referenced items carry hashes with drift detection and auto-materialize upon citation. *Because* defensibility wants copies and privacy wants minimization, and only an explicit custody model satisfies both. *Forces:* custody badges; ingestion enforcement (PRD-03); retention engine (PRD-14).

**L8 — Time is two-dimensional.** Every assertion carries valid-time (when it was true) and knowledge-time (when we learned it). The global Fiscal-Year Lens views the Record as of any slice; past years are sealed — signed artifacts immutable, mutation controls disabled under a past lens. *Because* "what did we know when we filed" is the question every audit turns on, and contemporaneous documentation is a legal concept. *Forces:* bitemporal schema (PRD-02); the Lens (PRD-01 §4.2); WORM storage on signed artifacts.

**L9 — Ceilings before floors; access follows assignment; control without content.** Three governance planes: IT sets ceilings (what the system may touch — connector policies, scope limits, read/write per destination); the business hierarchy allocates within them (roles, sensitivity tiers, gates); individuals opt in beneath both (personal connections within policy). Assigning work auto-grants exactly the scope the work requires and revokes it on unassignment. Admins govern pipes and policies but can never read tax content; security reads access events, not bodies. *Because* enterprise trust is the product, and most permission disasters come from collapsing visibility, action, and connection into one grant. *Forces:* the capability map (PRD-13); visible-disabled vs hidden rendering rules (PRD-01 §8); the Denied state.

**L10 — Every action is a job with a manifest.** Agent runs, stage executions, compilations, and exports are jobs with pinned inputs (corpus version, rulepack version, model version, instructions), full step traces, budgets, and manifests; the Annual Dossier's master manifest makes the year **reproducible** — re-runnable to byte-identical output. Manifests also make correctness incidents *bounded*: blast radius is a query. *Because* reproducibility is the property no tax deliverable has ever had, and it converts "trust us" into "verify us." *Forces:* the job runtime (PRD-05); the Runs surface; the correctness-incident process (Part VI).

**L11 — Humans teach once; answers join the Record.** The system asks plainly stated questions (verification queue) instead of guessing silently; every answer becomes a governed assertion with provenance (*confirmed by N.G., date*), citable like any document, never asked again. Standing instructions encode house methodology once. Reviewer redlines are captured as learning signal under consent. *Because* the cold-start problem and the saboteur problem share one solution: position the human expert as the system's teacher. *Forces:* the queue and Mapping Studio (PRD-04/01); assertion objects; the redline flywheel (PRD-15).

**L12 — The system never acts outward.** No agent emails, files, posts, pays, or transmits anything beyond the boundary; outbound acts (send, file to portal, push to SharePoint, deliver JE files) are exports executed by humans or behind explicit human approval per destination, each destination separately IT-enabled. Watchers never expand their own scope. *Because* the buyer's deepest fear is an improvising robot near a government, and our differentiation is *more* control, not less. *Forces:* the tool sandbox (PRD-05); send-on-approval flows; the per-destination write policy (PRD-13).

---

# PART III — THE OBJECT MODEL

The nouns of the system. Every PRD imports these definitions; schemas live in PRD-02; this section is the semantic contract.

## 9. Core objects

| Object | Definition | Authoritative PRD | Key relations |
|---|---|---|---|
| **Entity** | A legal entity in the group: jurisdiction, ownership, elections, attributes, substance aggregates | 02 | owns Flows (as party); has Filings, Findings, Financial slices |
| **Flow** | A priced intercompany relationship between two Entities: kind, method, policy terms | 02 | governed by Agreement(s); tested via BenchmarkSet; carries Findings; links Customs |
| **Agreement** | A structured contract object extracted from executed documents: parties, terms, dates, status (Executed/Expired/Missing/Draft) | 02/04 | governs Flows; sourced from DocumentBlob; gap rows are first-class |
| **Assertion** | An atomic fact with provenance, confidence, valid-time and knowledge-time; the quantum of the Record | 02 | composes everything; sources: extraction, engine output, or human answer (L11) |
| **Finding** | A detected contradiction, gap, drift, or risk: severity, exposure, exhibits, rule id, lifecycle state | 06 | cites Assertions/spans; attaches to Flow/Entity; spawns RemediationPaths |
| **Document (compilation)** | A record-class deliverable defined as a projection of the Graph: outline, sections with input chips, versions, language pairs | 08 | compiled by Drafter; checked by Checker; reviewed/signed via Gates; rendered to Artifacts |
| **Artifact** | An immutable rendered output (docx/PDF-A/xlsx/pptx/XML) with manifest id and verification hash | 12 | produced by jobs; sealed versions WORM-stored |
| **BenchmarkSet** | A comparable set with screening cascade, accept/reject log, financials, range math, license source | 08/07 | tests Flows; refresh produces diff requiring acceptance |
| **Obligation** | A statutory or engagement duty per entity/jurisdiction with local-TZ deadline, owner, satisfying Artifact, filing evidence | 07 (content) / 01 (surface) | driven by rulepacks; manual additions flagged customer-defined |
| **Period** | A fiscal year/quarter slice; the unit of the Lens, sealing, and Monitor | 02 | seals Artifacts; scopes everything |
| **Run (Job)** | An executed stage: pinned versions, instruction echo, step trace, outputs-to-staging, cost class | 05 | produces staged objects; referenced by Manifests |
| **Instruction** | A standing/run/inline directive with tier, scope, author, lifecycle; logged into Manifests | 05 | parameterizes engines, constrains Drafter, scopes Examiner (L3/L4) |
| **Gate** | A pending promotion/sign-off decision with SLA, delegate chain, decision record | 05/13 | promotes staging→Record; the only mutation path besides governed edits |
| **Manifest** | The reproducibility record of a job or Dossier: corpus vsn, rulepack vsns, model vsns, instructions, gates, artifact hashes | 05/12 | enables replay and blast-radius queries (L10) |
| **Source** | A connected input (system, mailbox, calendar, note-taker, upload channel) with custody class, scope, policy state, health | 03/13 | feeds ingestion; governed by IT ceilings (L9) |
| **Commitment** | A promise extracted from meeting/email with quoted span, owner, due, linked object, optional compiled Plan | 10 | produced by the Clerk; plans execute as Runs |
| **Matter** | A controversy/audit object: jurisdiction, years, IDRs, productions, privilege state | (Assure-era PRD) | lives in/links to the privileged vault; triggers readiness packs |
| **Scenario** | A saved deterministic what-if: parameter set + computed diffs vs base; never writes to Record | 11 | promotes only via governed-edit proposal |
| **DataRequest** | A structured ask to a human (controller, advisor, legal) with validation, status, and resulting Assertions | 04/10 | replaces the emailed questionnaire |
| **Staleness edge** | A dependency relation: Artifact/Document/Finding ← inputs; dirtied by change events; powers rebuild proposals | 02/05 | never auto-cascades into signed Artifacts (L2/L8) |

## 10. Semantic notes that schemas must honor

**10.1 The Graph** is the closure of Entities, Flows, Agreements, and Assertions over time — not a separate store but the queryable shape of the Record. Documents are projections of subgraphs; the intercompany matrix, the org chart, and every report in §2.1 are *views*, generated, never hand-maintained.

**10.2 Identity & resolution.** Entities, counterparties, and accounts receive resolved canonical IDs from the resolution service (PRD-04); merges and splits are events with audit notes; every raw mention retains a pointer to its resolved ID so provenance survives resolution changes.

**10.3 Confidence & calibration.** Assertions and Finding-candidates carry calibrated confidence; a global threshold gates candidate→Finding; below-threshold items exist only in triage views labeled as candidates (never silently dropped, never silently promoted) — calibration itself is measured (Part VI).

**10.4 Sensitivity & privilege as object properties.** Tiers (general / sensitive / privileged) attach to objects, not surfaces; rendering, export, and search all consult the tier (PAT-11). Privileged objects live behind the vault boundary with counsel-administered grants; their existence may be hidden, not merely disabled.

**10.5 The manifest is sacred.** Nothing user-visible is produced without one. If a future feature cannot say what it pinned, it does not ship.

---

# PART IV — THE EXPERIENCE

Aesthetics are owned by the design system. This part defines structural appearance, behavioral identity, the interaction grammar, and the canonical journeys that constitute the product's behavioral acceptance tests.

## 11. The shape of the application

A two-pane operating surface under a persistent shell: left rail of surfaces (Briefing · Graph · Findings · Documents · Monitor · Calendar · Library · Commitments · Runs · Connectors · Admin), a top bar carrying the workspace switcher, the **Fiscal-Year Lens**, the Ask/⌘K affordance, the gate-request chip, and notifications. Most surfaces are list/canvas + selection-driven inspector; every object is deep-linkable. Full surface-by-surface specification is PRD-01 §6; the inventory and purpose in one line each:

**Briefing** — the generated morning brief: deltas, decisions, deadlines; never configurable, never empty. **Graph** — map and ownership-tree projections of the economy; Entity and Flow pages as the doors to everything. **Findings** — the exception work system with lifecycle, exhibits, and cascade-previewed remediation. **Documents (Factory)** — pipeline and tri-pane workspace where deliverables compile, redline, self-check, and route to review. **Monitor** — the provision-calendar workspace: ETR walk, Pillar 2 panel, range watch, scenarios. **Calendar** — statutory obligations only, with filing evidence slots. **Library** — the corpus with the Document Viewer (the keystone component: citation → real page → highlighted span → return) and the ICA Register. **Commitments** — the Clerk's lane: promises with receipts and approvable plans. **Runs** — the visible nervous system: every job, trace, and staged output. **Verification Queue / Mapping Studio** — where humans teach. **Connectors** — sources with custody honesty. **Settings/Admin** — instructions, templates, delegation; the IT plane with metadata-only vision. **Onboarding** — the four-stage cold-start journey ending in the Reveal.

## 12. Behavioral identity — how it must feel

Seven feelings, stated as requirements:

1. **It briefs; it does not dashboard.** The first screen answers questions; it never asks the user to hunt across widgets. If a user must assemble meaning, the surface has failed.
2. **Every claim survives the click.** The defining gesture of the product is suspicion → click → a real page opens at a highlighted sentence → suspicion dies. The product is *designed to be doubted and to win*.
3. **Quiet competence.** No celebration animations for routine work, no engagement mechanics, no streak-nagging (the queue's progress meter is information, not gamification). The product's charisma is restraint — with exactly **two sanctioned theatrical moments**: the onboarding **Reveal** (first findings unlocked) and the **live trace** (a new document rippling through the system in seconds). Theater is rationed so that it stays believable.
4. **The past is sealed and treated with reverence.** Under a past Lens the interface visibly changes posture: controls disable with reasons, signed artifacts present their seals, and nothing pretends history is editable.
5. **The machine asks good questions.** When uncertain, the system asks one plain-language question with the evidence attached and the consequence stated — and never asks twice. Being questioned by Veritax should feel like being consulted, not audited.
6. **Keyboard-first, interruption-last.** Power users live on j/k/o/⌘K; toasts confirm only user actions; everything else waits in the digest. The product respects attention as the scarcest input it consumes.
7. **Honesty about its own state.** Stale data wears its age; degraded sources announce their scope; mocked or pending capabilities say so. The interface never performs certainty it does not have — because the brand *is* epistemic hygiene.

## 13. The interaction grammar (summary)

Normative detail in PRD-01 §5; the twelve patterns by name so all PRDs can reference them: **PAT-1** Citation chip (claim → source span) · **PAT-2** Provenance popover (figure → lineage chain) · **PAT-3** Staleness & rebuild proposals (never auto-rebuild) · **PAT-4** Plan Confirmation (restate-before-run; intent, steps, invalidations, cost, instruction echo) · **PAT-5** Gate control (approve/request-changes/reject/delegate with SLA and escalation) · **PAT-6** Instruction surfaces (standing/run/inline with live tier classification) · **PAT-7** Assignment with stated access consequences · **PAT-8** Tables & keyboard model · **PAT-9** Five-state vocabulary (Empty educates; Loading skeletons; Degraded scopes; Denied names the tier; Error references the incident) · **PAT-10** Two-class export dialog with hash notice and uncited-claim guard · **PAT-11** Sensitivity indicators and logged-view notices · **PAT-12** Anchored comments and mentions.

## 14. Canonical journeys (normative traces)

These seven traces are acceptance tests in prose. A release claiming a rung is complete must be able to perform its journeys exactly as written. Each lists the laws it exercises.

**J1 — The first 48 hours (onboarding → Reveal).** *Exercises L1, L7, L11.* A manager connects the forward-address and drags a folder of agreements, prior local files, and statutory accounts into the ingest console. Counters climb; the problem pile collects three unreadable scans and one duplicate with a fix action each. The Teach stage asks ~40 questions — "are these two entities the same?", "which MSA version is executed?" — each with evidence and consequence; answers become cited assertions. At hour 41 the Reveal unlocks: *Examination complete — 8 findings, €X exposure rollup*, and the Briefing comes alive. Nothing in the app was ever empty without explaining what would fill it.

**J2 — Tuesday morning (the daily loop).** *Exercises L5, L2, L9.* 8:40: the Briefing reads — overnight ingestion picked up three ICAs from the legal vault; one finding escalated; the Master File draft passed self-check; SAP-DE is 26h stale so every derived figure wears amber. She opens the escalated finding, reads both exhibits, selects remediation path B (the cascade preview shows two affected documents and a customs note), assigns it to her analyst with a due date inherited from the Q2 close obligation — the confirmation states exactly what access the analyst just gained. Eleven minutes, zero hunting, zero Excel.

**J3 — The 2:07 a.m. amendment (incremental ripple).** *Exercises L8, L10, PAT-3.* Legal's system syncs an executed amendment to the IE→DE licence: classified by 2:08, clause-extracted by 2:09 (5.5% → 5.0% effective Q3), written as a time-bounded assertion by 2:10. The staleness DAG dirties the DE Local File draft, the range-watch row, finding F-0047, and one Master File appendix; an incremental Examiner run updates the finding ("likely resolved prospectively; retroactive exposure unchanged") with the new exhibit; the GloBE engine recomputes DE's projected ETR to 15.1%. Nothing else in the system is touched. The 7:58 Briefing proposes two rebuilds; one click regenerates the affected sections as redlines, which pass the Checker and enter review. Fifteen minutes of machine time, fully traced, zero unsupervised writes.

**J4 — The IDR morning (anticipation).** *Exercises L12, L9, the privilege boundary.* 6:51: the shared mailbox receives the German advisor forwarding an examination-opening letter for FY2022. Classified as an authority notification, linked to the DE entity, a Matter event is created; the Assembler pre-stages the Germany FY2022 readiness pack — every filed artifact for the years under exam, the agreements, the benchmark workpapers, the three open findings touching those years ranked by exposure; the Clerk drafts (does not send) the acknowledgment and a strategy-call hold. The 7:58 Briefing presents all of it. The human told the system nothing; the system transmitted nothing; everything it pre-did is staged, cited, and gated.

**J5 — Quarter close, T-10 (Monitor's rhythm).** *Exercises L3, L5.* The pre-close checklist activates: two data-freshness items, one mapping confirmation, the ETR walk. The Pillar 2 panel shows DE failing the routine-profits safe harbour with the test math one click away (*computed · rulepack 2026.2*); range watch projects the GmbH landing below IQR with a €4.2M true-up and a customs flag. She models the correction in a Scenario (instant, deterministic, never touching the Record), saves it beside the base case, and exports the provision memo to the controller. The system suggested nothing daily; it was simply ready when the calendar said so.

**J6 — `make all` (the Annual Dossier).** *Exercises L6, L10.* Year-end: the full pipeline runs as one composed job. Output: every Local File and the Master File as signed, hash-stamped artifacts; CbCR and GIR XML with validation reports; benchmark studies with full cascades; the ICA register with a clean gap report; disclosure-form data packs; the true-up pack with journal files; the audit-readiness index mapping every obligation to its artifact and filing evidence; the board pack; and the **master manifest** pinning every version, instruction, redline, and gate decision. The Dossier is re-runnable from its manifest to byte-identical output — handed to the IRS within the 30-day window, to the auditor at close, or to a successor VP Tax on day one: *the company's tax year, zipped, with receipts.*

**J7 — The signature (Review Mode).** *Exercises L2, L6, L11.* The external partner opens her queue, redlines §6 of the SG Local File, demands the source for a margin (PAT-1 resolves it in two clicks), accepts the regeneration, and signs — credentials block, attestation, seal. The manifest records her redlines and her signature; her hours are logged; the obligation row flips to satisfied; her edits join the learning signal under the engagement's consent terms. The firm billed judgment, not leverage — and did it inside our walls.

---

# PART V — THE MACHINERY

The backend reduces to seven services and two architectural commitments. Services: connector/sync daemons, the parsing-and-extraction pipeline, the entity-resolution service, the Record store, the job runtime, the rulepack engines, and the hybrid retrieval index. Commitments: the Record is **event-sourced** (state is a fold over an append-only log, which makes the audit trail, as-of stamps, staleness propagation, and reproducible Dossiers the *same mechanism*) and **bitemporal** (L8). Nothing in the system is a batch job waiting for a button; the middle is event-driven and incremental — every new document, ledger row, or human answer ripples through exactly the subgraph it touches, and no further.

## 15. The five processing layers

Each layer pairs a backend function with a human surface. Inputs flow down; questions flow up.

**15.1 · Ingest & understand.** Connector daemons and uploads land raw material in a tenant-isolated staging zone. Files are type-detected, OCR'd if scanned, layout-parsed (tables, footnotes, signature blocks), language-detected, and classified (Local File / ICA / trial balance / board minute / authority letter / invoice batch…). Deduplication and versioning collapse the same agreement found in three places and surface the genuinely human question — *which version is executed?* — to the problem pile. Custody class (L7) and PII tagging are enforced at this door, not later. Human surface: the ingest console and problem pile (PRD-01 §6.15, §6.4).

**15.2 · Resolve & structure.** The hardest engineering in the company; budget accordingly. **Entity resolution** concludes that "Helios GmbH," ERP code HEL-DE-01, and "the German distributor" in a 2022 memo are one entity, maintained as a per-tenant knowledge base reconciled against the legal-entity system; merges and splits are audited events. **Clause extraction** turns agreements into structured Agreement objects — parties, effective and termination dates, pricing terms, renewal mechanics — every field carrying source span, confidence, and extractor version. **Financial normalization** maps every trial balance to the canonical tax-sensitized chart of accounts, bridges local GAAP to group GAAP, aligns currencies and fiscal calendars. **Flow inference** joins intercompany account activity with agreements and invoices to assert Flow objects. **Allocation keys are first-class objects** — if keys live in Excel, segmented P&Ls live in Excel, and Monitor never lands. Human surface: the Verification Queue and Mapping Studio (L11) — the machine asks one plain question with evidence and consequence; the answer becomes a cited assertion, asked once, never again.

**15.3 · Examine & compute.** The cross-referencing engine compares every fact asserted in more than one place — rates, dates, headcounts, ownership — across the Graph; the rules engine plus the Examiner investigate divergences along evidence chains; candidates pass the calibrated confidence gate into Findings or fall to triage. In parallel the deterministic engines run against fresh data under the current rulepack, and the staleness DAG dirties every downstream artifact whose inputs changed. Human surface: Findings triage and remediation (PRD-01 §6.3).

**15.4 · Compose & review.** The Drafter compiles document sections from the Graph under standing and run instructions; the Checker adversarially re-verifies every draft against the corpus *before any human sees it* (Factory is architecturally incapable of shipping a draft that contradicts the record); the review state machine routes internal redlines, then Review Mode, then the signature ceremony that seals a manifest.

**15.5 · Watch & assemble.** Watchers run fixed scopes (range drift, comparable freshness and delistings, regulatory change, source health); the digest compiler folds the event stream into the Briefing; the Assembler builds packs — audit-readiness, board, IDR-response — and, at year-end, the Dossier.

**The life of a number** (normative, complements J3): a trial-balance cell → account mapping → entity P&L → allocation keys → segmented tested-party margin → range test → a range-watch tick → a sentence in a Local File — every hop recorded, so clicking any figure anywhere walks the chain back to the ledger row it was born from (PAT-2). If a number cannot perform this walk, it does not render.

## 16. The agent runtime and the roster

**16.1 Jobs.** Every agent run is a job: pinned inputs (corpus version, rulepack versions, model versions), instruction echo, full step and tool-call trace, cost class and budget, idempotency key, outputs-to-staging, manifest. Failure semantics: typed failure classes with suggested remedies; budget-exceeded is a distinct state with manager raise-and-retry; cancellation is safe-by-design (staging means nothing partial ever touched the Record).

**16.2 The tool sandbox.** Agents hold read tools (graph query, corpus search/retrieval), call tools (deterministic engines), and exactly one write target: staging. The three nevers, engraved: **never write directly to the Record; never act outward; never expand own scope.**

**16.3 The roster.** Six workers plus the Clerk — named internally, rendered as "processes/runs" in product UI (Two Scripts):

| Agent | Mandate | Trigger | Notable property |
|---|---|---|---|
| **Examiner** | Investigate divergences; assemble evidence chains into Finding candidates | Continuous incremental on change events; scoped on demand | The Mirror product *is* this agent plus the rules engine |
| **Drafter** | Compose document sections from the Graph under instructions, fully cited | Stage runs; rebuild proposals; inline directives | Constrained by templates + standing instructions; cannot assert against the Record (L4) |
| **Checker** | Adversarially re-verify every draft against the corpus; entailment-check citations | Automatic after any Drafter output | **Maker-checker**: enforced separation of duties — the profession's own control philosophy in silicon |
| **Researcher** | Answer questions from the corpus as briefs with exhibits; refuse beyond it | Ask the Record; saved questions; standing monitors | Refusal-with-absence-evidence is a first-class answer |
| **Watchers** | Fixed-scope monitors: drift, freshness, regulatory change, source health | Scheduled | Scopes are set by humans; a Watcher cannot widen itself |
| **Assembler** | Compile packs: audit-readiness, board, IDR responses, the Dossier | On demand; event-triggered (e.g., Matter opened) | Composes other agents' sealed outputs; creates nothing novel |
| **Clerk** | Ambient intake: extract Commitments and assertions from meetings/email; compile plans; draft (never send) replies and recaps | Connector webhooks; calendar events | Operates entirely behind the privilege gate and consent settings |

**16.4 The instruction compiler.** One conversational surface, three compile targets (L3/L4): instructions become **parameters** for deterministic engines ("apply the SBC election for Ireland" → engine flag), **constraints/prompts** for the Drafter and Examiner, or **scope definitions** for Watchers. Tier classification (style / run / methodology) is computed live and shown before submit; methodology-tier requests route to a manager gate. Every accepted instruction is versioned and lands in the manifest of every job it shaped.

## 17. The build system ("make for tax")

The whole operation is a dependency graph over the Record. Every node is an independently invocable **target** with declared inputs and outputs: `make de-local-file` rebuilds one document and only its dirty dependencies; `make uk-benchmark` re-runs one study; `make all` runs the year and emits the Dossier. **Staleness propagates; rebuilds never auto-execute** — the system proposes (PAT-3), humans accept, and signed artifacts are never cascaded into, only superseded by new gated versions. Scheduling has three modes: continuous (Watchers and incremental examination), calendar-triggered (the T-10 pre-close run; the annual documentation-cycle kickoff that generates the year's plan with prior-year redline bases; the ICA renewal sweep; per-period safe-harbour re-tests), and on-demand (any target, any scope, with instructions). Commitments from the Clerk compile into the same plan objects as user instructions — meetings are just another trigger source for the one runtime. Ship named, pre-built processes with configurable parameters; do not build a generic workflow builder (decision D-07).

## 18. Engines, rulepacks, and content operations

**Engine inventory** (deterministic, versioned, regression-tested): GloBE/QDMTT computation incl. safe-harbour tests and SbS handling; interquartile/range math with PLI options and weighting; true-up computation with journal derivation; amended-return cascade traversal; customs-impact estimation (P2); GIR and e-filing schema validation; redline/diff; the obligations calendar computation with jurisdiction-local timezone semantics.

**Rulepacks** are the law-as-code layer: per-jurisdiction rule sets, document format templates, deadline calendars, safe-harbour rates — versioned, effective-dated, shipped with **plain-language changelogs scoped to the customer** ("OECD Admin Guidance Jan-2026 incorporated; here is what changed for *you*: 2 entities, 1 election"). Regulatory changes surface in-product as proposals, never silent mutations.

**Content operations** is a permanent function, not a launch task: tax content engineers — practitioners who write rules-as-code with eval coverage — running an editorial pipeline with review stages and SLAs. This is the miniaturized Thomson-Reuters content army and a core moat line item; the advisor bench seeds its review board.

## 19. Inputs

**19.1 The families** (full registry in PRD-03): financial systems (ERPs ×N instances, consolidation, provision, treasury, sub-ledgers, budgets, statutory accounts, allocation keys); documents (agreements and amendments, prior documentation, board minutes, M&A and restructuring papers, third-party contracts as internal CUPs, authority correspondence, rulings and APAs); licensed market data on a **bring-your-own-licence** model (Orbis/Capital IQ-class comparables, royalty and loan databases — BYO dissolves redistribution restrictions and is policy D-01, not a workaround); people and operations (HRIS aggregates, payroll-by-entity, patent registers, customs entries, time systems); regulatory content (vendor-maintained rulepacks, §18); and human-supplied assertions (L11).

**19.2 The intake triad.** **Meetings**: note-taker connectors deliver transcripts via webhook; per-meeting consent; classification gate routes controversy/UTP/counsel content to the vault or excludes it; commitments-only mode extracts action items with quoted spans and discards transcripts; Functional-Interview Mode (P2) turns FAR interviews into cited structured analysis. **Email**: the access ladder — forward-address (zero standing access, day one) → shared mailboxes (the clean default) → filtered personal via OAuth within IT ceilings; four extraction passes (attachments→corpus through full ingestion; commitments→Clerk; assertions→queue; events→Matters/Obligations); scoped historical **backfill** is the Mirror amplifier ("14 executed agreements found in mail that exist nowhere else"). **Calendar**: metadata-first read-only; pre-links meetings to matters; feeds deadline-collision awareness.

**19.3 DataRequests** replace the emailed controller questionnaire: structured, validated, portal-delivered asks whose answers enter the Record as cited assertions at the source.

## 20. Outputs

**20.1 Two classes** (L6). Record-class: edited upstream, exported as renderings with manifest IDs and per-page verification hashes; unsigned drafts watermark non-removably; external collaboration via check-out (tracked-changes .docx) / check-in (auto-diff → proposed edits → gate). Communication-class (decks, memos, status exports): generated native on the customer's own templates, edited freely, regenerated next cycle.

**20.2 Formats.** Styled .docx + archival PDF/A; **formula-intact** .xlsx with a lineage tab (benchmark cascades, true-ups, GloBE packs — examiners trace math; values-only dumps read as concealment); native .pptx on uploaded slide masters (the board pack is the VP's favorite button); GIR/CbCR/e-filing XML with attached validation reports; import-format feeds into incumbent return software; ERP journal-upload files (Veritax never posts — it hands controllership a perfect file behind an approval, per L12).

**20.3 The Annual Dossier** (`make all`): contents per J6, sealed under a master manifest, **reproducible to byte-identical output** — simultaneously the IRS 30-day response, the auditor's close package, and the successor's day-one inheritance.

**20.4 BI = a governed semantic layer, never exported projects** (decision D-02): certified live datasets (Power BI live connection / Snowflake share / Tableau connector) inheriting Veritax permissions and as-of metadata, plus no-embedded-data starter templates. A generated .pbix is an uncontrolled, rotting copy of the most sensitive data in the company; the security argument ends the conversation.

## 21. Storage

**Seven stores; the sacred pair.** (1) the append-only, hash-chained event log; (2) the Record store (bitemporal Postgres — boring technology, exotic schema); (3) corpus blobs in versioned object storage with **Object-Lock/WORM on signed artifacts** (tamper-evidence as a storage property); (4) derived data — indexes, embeddings, renderings — declared disposable and rebuildable; (5) artifacts + manifests; (6) operational data (traces, cursors, the access audit log); (7) identity/config. The event log and the blobs are sacred; everything else can burn and be rebuilt.

**Tenancy & residency.** Logical isolation with per-tenant envelope encryption; customer-managed keys at enterprise tier; single-tenant VPC tier where even inference runs inside the boundary; residency is a tenant property pinning storage *and processing*, backups included; backups are encrypted, residency-bound, restore-tested on schedule.

**Immutability vs. erasure.** Resolved by **crypto-shredding**: personal-data fields encrypt under fine-grained keys; erasure destroys the key, leaving the hash chain intact; redaction events record that-something-was-redacted without retaining what; **legal hold** suspends deletion under dispute or audit. The **retention engine** is per object class per jurisdiction — filed documents and agreements live for statutes-of-limitation horizons (commonly 7–10+ years); transcripts default to 90 days; extracted commitments outlive their transcripts. **Custody is visible** (D-03): every source and document shows its class and retention clock; reference-custody items carry hashes with drift detection and auto-materialize on citation.

---

# PART VI — TRUST

## 22. Governance planes and roles

Three planes, ceilings before floors (L9): **IT sets ceilings** (connector catalog states Disabled/Request/Self-serve; scope ceilings per source; read/write per destination; security policy), **the business allocates within them**, **individuals opt in beneath both**. Condensed role matrix (authoritative detail: PRD-13):

| Role | Sees | Does | Cannot |
|---|---|---|---|
| IT admin | Pipes, policies, volumes, health | Connector policy, scope ceilings, write enablement | **Read any tax content** |
| Security/compliance admin | Access events, retention, holds | Audit-log queries, legal hold, residency | Read document bodies |
| Workspace owner (VP Tax) | Everything except vault | Final sign-offs, sensitive-tier grants, materiality | Enter vault un-granted |
| Manager | Owned entity/jurisdiction scopes | Assign (access follows), promote gates, methodology instructions | Exceed scope; bypass gates |
| Preparer | Assigned objects + their subgraphs | Run stages, draft, propose, answer queue, style instructions | Promote anything |
| Adjacent (Legal/Treasury/Controller/IA) | Scoped slices + purpose artifacts | Propose (Legal: ICAs), consume packs, read | Wander |
| External reviewer | Shared docs + supporting evidence | Redline, request evidence, sign | See anything adjacent |
| Local advisor | Assigned requests/uploads | Submit, upload | Browse |
| Outside counsel | The privileged vault (administers it) | Grant/revoke vault access — including to the VP | — |
| FS auditor | Evidence room (read-only, time-boxed, watermarked) | View; every open logged | Export unwatermarked |

Mechanics: SCIM lifecycle (mover swaps scopes on sync; leaver loses everything; contributed provenance survives people); **visibility, action, and connection are three separate grants**; visible-disabled-with-reason where discoverability helps, hidden where existence leaks; gate **delegation** (time-boxed) and **escalation** (SLA-breaching gates climb the hierarchy automatically — the August-beach problem); **break-glass** is dual-confirmed, reasoned, loud, and auto-reviewed.

## 23. Privacy & security posture

Minimization by architecture (extract-only patterns, HR aggregates, scoped mail); PII tagging at ingestion so DSARs and erasure are queries, not archaeology; the proactive compliance pack — DPA with sub-processor list, SCCs, and a **pre-written DPIA template** (Veritax processes employee data; handing the customer's DPO the assessment half-done shortens procurement by weeks); inference providers operate under zero-retention/no-training enterprise terms, in-VPC at top tier; **customer content never trains models** — contractual and structural, with eval suites running on synthetic and licensed corpora only; certifications ladder SOC 2 Type I → Type II → ISO 27001 → ISO 27701; scheduled penetration tests; every read of sensitive content is itself an audit event; the **trust center generates from the architecture** (custody model, key hierarchy, residency map, retention schedule, sub-processors, WORM guarantee) — the most-read page we will ever publish.

## 24. The correctness system (the moat, operationalized)

Six components: (1) **golden corpora** per jurisdiction — synthetic and licensed multinationals with known-correct answers, seeded from the Helios demo tenant, grown with every jurisdiction shipped; (2) the **expert grading panel** — advisor bench scoring outputs against rubrics until the rubrics are trustworthy; reviewer redlines (under consent) feed the same signal; (3) the **citation-entailment checker** — every citation must resolve *and entail* its sentence; a real citation to the wrong clause is worse than none; (4) **calibration measurement** — stated confidence must match observed accuracy, or the triage gates are theater; (5) **release regression gates** — no model swap, prompt change, or rulepack update ships without golden suites passing; diffs publish to the trust center; (6) the **correctness-incident process** — distinct from downtime, with its own severity scale; manifests make blast radius a query (which tenants, which artifacts, which versions); policy is **proactive disclosure with corrected re-runs**. The first call that says "we found our own error before you did — here is exactly what it touched and here are the corrected artifacts" is the most trust-building act available to an AI company. Error taxonomy and dismiss-reason distributions close the flywheel back into rules and evals.

## 25. The liability frame

Until Assure: Veritax is a **preparer-assist system whose outputs require professional review**; the signature ceremony explicitly allocates responsibility to the signing human or firm. Consequences: terms drafted by professional-liability counsel; E&O insurance from day one; **language discipline** as a hard product rule — the UI never says "compliant," it says "consistent with the record and ready for review"; no superlative ever appears on a button. When Assure ships, this section is superseded by the underwriting framework (insurance wrapper, reinsurance capacity, claims process) under its own PRD.

---

# PART VII — THE PLAN

## 26. The PRD library

Convention: every PRD opens with **Owns / Consumes / Emits** (objects it is authoritative for; events it subscribes to; events it publishes), then Problem & users → Scope & explicit non-goals → Surface/API → Data model → Security/privacy notes → Metrics → Phasing. Non-goals are the section that saves you.

| PRD | Title | One-line scope |
|---|---|---|
| 00 | Master (this) | The constitution; wins all conflicts |
| 01 | Frontend | Shell, PAT library, all surfaces, portals contract, permissions rendering |
| 02 | The Record | Event log, bitemporal schema, objects, manifests, staleness DAG |
| 03 | Ingestion & Understanding | Connector framework, parsing, classification, custody/PII at the door |
| 04 | Resolution & Structuring | Entity resolution, extraction, normalization, allocation keys, queue contract |
| 05 | Runtime & Instructions | Jobs, sandbox, staging/gates, instruction tiers & compiler |
| 06 | Mirror | Examiner, rules, Finding lifecycle, triage, remediation cascades |
| 07 | Engines & Rulepacks | Deterministic engines, rulepack format, content operations |
| 08 | Factory | Drafter/Checker, compilation, templates/localization, Benchmark Studio |
| 09 | Review & Sign-off | Review state machine, Review Mode, ceremony, check-out/in |
| 10 | Ask the Record & Clerk | Retrieval, briefs/refusals, Commitments, privilege gate, FAR mode |
| 11 | Monitor | Provision workspace, Pillar 2 panel, range watch, scenarios, alert policy |
| 12 | Outputs & Dossier | Renderers, hashes, e-filing, JE files, Dossier assembly, semantic layer |
| 13 | Identity & Governance | Planes, roles, SCIM, policy matrix, vault, audit log |
| 14 | Storage, Privacy & Trust | Custody, keys, shredding, retention, residency, DSAR, trust center |
| 15 | Correctness & Operations | §24 in full + SLOs, observability, COGS metering, flags, sandbox tenants |

The **Demo Cut spec** (two pages, per-PRD real/staged/absent) governs any demo build; its one law: *mock the plumbing, never the tax intelligence* — and when asked, say which is which.

## 27. Waves

| Wave | Outcome | Real | Reduced/Staged |
|---|---|---|---|
| **P0 — Demo core** (days) | The Cody/design-partner demo | Record v0 (provenance from day one), upload ingestion, precomputed Mirror, Viewer anchor protocol, live Ask, the live-trace moment | One-doc Factory slice; static Monitor; replayable Reveal |
| **P1 — Design partner** (weeks 2–8) | Sellable Mirror diagnostic | Verification Queue + Mapping Studio, SharePoint + forward-mail connectors, runtime/gates formalized, minimal auth/roles, golden-corpus seed, onboarding | Commitments manual-only |
| **P2 — Expansion** (months 2–6) | Factory revenue | Full Factory + Benchmark Studio, engines/rulepacks, Review Mode portal, exports incl. board pack, Clerk (meetings/email) | Advisor portal; auditor room |
| **P3 — Enterprise** (6 mo+) | Monitor + trust tier | Live feeds, Monitor + scenarios, full governance/SCIM, storage/privacy complete, correctness + ops complete, Dossier, semantic layer | Vault (counsel-administered) |

Sequencing law: write 00 → 02 → 06 first (constitution, spine, wedge — Mirror's demands pressure-test the schema before it calcifies); PRD-13's *data model* lands early even though its build is later; PRD-15's correctness section precedes anything a human signs.

## 28. Metrics that matter

**North star: Verified Coverage** — the share of the customer's intercompany economy (flows × periods) that is cited, current, and contradiction-free. It rises with ingestion, teaching, remediation, and renewal — the one number that means the product is doing its job. **Trust metrics:** citation-resolution ≥ 99.5%; calibration error trending → 0; correctness incidents disclosed-before-discovered = 100%. **Adoption:** time-to-Reveal < 48h; gate latency P50 < 24h; queue answers/session; Ask answer-accepted rate; WAU by surface. **Business:** logos and Verified-Coverage-weighted NRR; **gross margin per tenant** (COGS metering from the first design partner — margin is an engineering outcome); pipeline sourced via Review-Mode firms. Analytics observe metadata only, consistent with admin-no-content.

## 29. Decision log & open questions

**Decided (D-#):** D-01 BYO licences for market data · D-02 semantic layer, never exported BI projects · D-03 custody visible in UI · D-04 obligations calendar excludes personal tasks · D-05 email default custody Extract-only; IT may upgrade shared mailboxes · D-06 alerts exceptions-only, digest-first; gates are the sole realtime channel · D-07 named processes with parameters, no generic workflow builder · D-08 hyperscalers deferred to controversy-lab partnerships · D-09 name "Veritax" retained through the Factory era; rename is a Settle-era question · D-10 no agent outbound capability in any wave of this document · D-11 two theatrical moments only (Reveal, live trace).

**Open (O-#):** O-1 Clerk chase-ups for others' commitments: opt-in default at person or workspace level? · O-2 Where do Controllers land — Briefing or scoped artifact list? · O-3 Findings board view: P1 or cut? · O-4 Presence/concurrency in Document Workspace: partner-scale need? · O-5 The Dossier's customer-facing name · O-6 Per-user vs per-workspace persistence of the Graph materiality slider. Owners and due dates assigned in the project tracker; unresolved opens block no Wave-0 work.

## 30. Glossary (for engineers and designers who are not tax people)

| Term | Meaning |
|---|---|
| Transfer pricing (TP) | The prices charged between sister companies in the same group — regulated so profits can't be shifted by fiat |
| Arm's-length principle | Intercompany prices must match what unrelated parties would have agreed |
| FAR / functional analysis | Who does what: Functions performed, Assets used, Risks assumed — the narrative core of TP documentation |
| DEMPE | Development, Enhancement, Maintenance, Protection, Exploitation of intangibles — who *really* creates IP value |
| Tested party / PLI / TNMM / CUP | The entity whose margin is tested; the Profit-Level Indicator used; the two most common testing methods |
| IQR | Interquartile range of comparable companies' results — being outside it invites adjustment |
| Comparables / benchmarking | Independent companies used to establish the arm's-length range; sourced from licensed databases |
| Local File / Master File / CbCR | The OECD three-tier documentation set: per-country detail, group blueprint, country-by-country numbers |
| Intercompany agreement (ICA) | The contract between sister entities; the first thing every examiner requests |
| Pillar 2 / GloBE | The 15% global minimum tax regime for groups over €750M revenue |
| GIR / QDMTT / IIR / UTPR / SbS | The GloBE return; the domestic minimum top-up tax; the two charging rules; the US Side-by-Side carve-out |
| Safe harbours | Simplified tests that excuse full GloBE computation when passed |
| Provision / ASC 740 / FIN 48 / UTP | Quarterly tax accounting for the financial statements; reserves for Uncertain Tax Positions |
| True-up | The year-end adjustment forcing actual intercompany results back to policy — with customs and VAT shrapnel |
| §6662(e) | US penalty-protection rules: contemporaneous documentation, producible within 30 days of request |
| IDR / NOPA | Information Document Request; Notice of Proposed Adjustment — the audit's escalation artifacts |
| APA / MAP | Advance Pricing Agreement; Mutual Agreement Procedure — negotiated certainty and treaty dispute resolution |
| Kovel | The arrangement placing accountants under counsel's direction to preserve privilege — the vault's legal basis |
| Big Four / second-tier | PwC, Deloitte, EY, KPMG; then Ryan, Andersen, A&M, BDO, GT — the review channel |
| Bitemporal | Data carrying both when-it-was-true and when-we-learned-it |
| WORM | Write-once storage; how signed artifacts become tamper-evident |
| Crypto-shredding | Erasure by key destruction inside immutable logs |

---

**Version history:** v1.0 — Parts I–IV · v1.1 — Parts V–VII complete (this version). Amendments to this document require the owner's sign-off and a changelog entry; all PRDs citing an amended section must be reviewed within one sprint.

— end —
