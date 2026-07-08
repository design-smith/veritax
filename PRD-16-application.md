# PRD-16 — The Application (Established-User Experience)

**Status:** Draft v1 · **Owner:** NG · **Inherits:** PRD-00 (Laws, object model, journeys J1–J7), PRD-01 (component-level surface specs — this PRD is the *journey and page-set* layer above it), PRD-06/08/10/11 (the capabilities the pages expose)
**Relationship to PRD-01:** PRD-01 specifies *every surface at the button level* (the exhaustive component spec). This document specifies *the working application a returning user actually lives in* — which pages make the daily set, what single job each serves, how they hand off to each other, and the emphasis the product leads with after the Kahrs and Abarikwu practitioner interviews. Where PRD-01 is the parts catalog, PRD-16 is the assembled machine in daily use. Conflicts resolve to PRD-01 for component detail, to this document for page-set scope and emphasis.

---

## 1. Purpose

Every prior PRD answers "what can the system do." This one answers "what does a person who has used Veritax for three months actually open, see, and do on a Tuesday." It exists because a complete component library is not the same as a coherent daily experience — and because two practitioner interviews (a Deloitte NY TP specialist and an EY TP manager) sharpened *which* capabilities the product should lead with, a weighting that must be written down before it's built or it will drift back to the demo-flashy default.

**The two things this PRD pins:**
1. **The nine-page working set** — the surfaces a returning user lives in, each with one job, no page doing two unrelated things, no two pages doing the same thing.
2. **The one-record-many-lenses model** — planning, compliance, and defense are *not* sub-products behind a switcher; they are contexts that re-foreground the same record. This is architecturally load-bearing: splitting them into siloed sub-products would rebuild the projections problem (PRD-00 §2.1) inside our own UI.

## 2. The design premise: a Veritax user opens to consequence, not to a blank canvas

A tool opens to "what do you want to do today?" Veritax opens to *"here is what changed and what needs you"* — because the system has been ingesting, examining, and watching since the user's last session (the record is always live). The established user therefore lands on the **Briefing**, a generated brief, never an empty start-state. (First-run is the *onboarding-to-reveal* journey, PRD-01 §6.15 / PRD-00 J1 — out of scope here; this PRD assumes the record exists.)

Corollary that governs the whole page set: **the record is persistent navigation; the work is destinations on top of it.** Pages 1–5 are the record and what you do to it (always present). Pages 6–9 are the work that sits on top (the lenses). One element — the ask-anything command bar — is on every page and is not itself a page.

## 3. Session archetypes (who opens it, and why)

The page set must serve three recurring sessions (personas per PRD-00 §6.2):

- **The triage session (VP / manager, 5–10 min, daily):** open Briefing → read what changed and what needs a decision → resolve or delegate → leave. Most sessions are this. The Briefing must make it possible to be *done* in ninety seconds.
- **The work session (analyst / manager, hours):** open Briefing → enter Findings or Factory → do sustained work on exceptions or documents → verify against Library → route for review. This is where the product earns its keep.
- **The event session (any, irregular, triggered):** a deadline approaches (→ Calendar/Monitor), a restructuring is contemplated (→ Planning), an authority challenges (→ assembled from Findings + Library + Calendar). Not a daily rhythm — a response to something happening.

If the page set serves these three cleanly, it's right. If a session requires hunting across pages to assemble meaning, a seam is wrong.

## 4. The nine-page working set

Each page below is specified as: **Job** (the one thing it does that no other page does) · **Contains** · **User does** · **Hands off to**. Component-level detail lives in the referenced PRD-01 section; this is the journey layer.

### The record (pages 1–5, always present)

**1 · Briefing (home).** *(PRD-01 §6.1)*
- **Job:** route attention — what changed, what needs me, what's due.
- **Contains, top-to-bottom by urgency:** *what needs you* (decisions waiting on this person — sign-offs, remediation calls, mapping confirmations, actionable inline); *what changed* (deltas since last session — new material ingested, findings that moved, positions that shifted, each linking out); *what's due* (next obligations by jurisdiction, day-count chips, calm not alarmist); *what's watched* (VP: exposure rollup; analyst: assigned work).
- **User does:** reads in ~90s, then clicks into whatever needs them; resolves safe items inline without navigating.
- **Hands off to:** everywhere. The Briefing is a launchpad, not a workspace — nearly everything on it links out.

**2 · Graph (+ Entity / Flow detail).** *(PRD-01 §6.2)*
- **Job:** see the company as it actually is, and navigate by it.
- **Contains:** entities as nodes, intercompany flows as edges, status visible (clean / flagged / drifting); zoom into any entity (its profile, financials, agreements, findings, filings) or any flow (policy vs observed, governing agreement, benchmark, documentation coverage).
- **User does:** explores structure, answers "what do we even have," drills into the specific entity or flow they need.
- **Hands off to:** Findings (an entity's problems), Library (its documents), Factory (its documentation), Planning (model a change to it). *Entity/Flow detail is the Graph zoomed in — the same context, not a separate page.*

**3 · Findings.** *(PRD-01 §6.3, powered by PRD-06 — the wedge)*
- **Job:** everything wrong with the record, as a work queue.
- **Contains:** exceptions by severity — contradictions, gaps, drift, risks — each with evidence, exposure, status, assignee; and the finding detail, whose centerpiece is **the contradiction shown as two source documents side by side, each clickable to its highlighted source span** (the single most important interaction in the product).
- **User does:** works exceptions — opens a finding, reads both sides, decides remediation, assigns, or dismisses with reason.
- **Hands off to:** Library (see the evidence in full), Factory (regenerate a document to fix it), Planning (model a correction).

**4 · Library / Documents.** *(PRD-01 §6.4 — the truth surface)*
- **Job:** the corpus, readable and provable.
- **Contains:** every source and generated document, searchable; the **viewer that opens any file to any cited span, highlighted** — the page behind every citation chip elsewhere in the app.
- **User does:** reads source material, checks what a document actually says, verifies a claim.
- **Hands off to:** nothing — it's terminal. Everything points *into* it; it's where "see for yourself" ends.

**5 · Ask (command bar on every page; results materialize here).** *(PRD-01 §4.3, powered by PRD-10)*
- **Job:** answer a question against the record.
- **Contains:** the invoke-anywhere bar; returns a cited answer *or a proven absence* ("no executed renewal after 31 Dec 2023 in corpus v.418"); expandable into a saved/monitored view.
- **User does:** interrogates the record constantly, without breaking flow; saves questions worth watching.
- **Hands off to:** wherever the answer points.

### The work (pages 6–9, the lenses)

These four are the planning/compliance/defense lenses given form as destinations — *not* a product switcher. Same record underneath; each foregrounds different actions.

**6 · Factory (documents-in-progress).** *(PRD-01 §6.6, powered by PRD-08 — the compliance lens)*
- **Job:** produce and review the deliverables.
- **Contains:** documents being drafted off the record — each showing its sections, what each section drew from (input chips), what's checked, what's blocked; redline vs prior year; the self-check gate; review routing.
- **User does:** generates, edits via instruction, reviews, routes to sign-off.
- **Distinct from Library (#4):** Library is *finished, filed truth*; Factory is *work in progress*. "Committed" and "still drafting" are different mental states and must be different places.
- **Hands off to:** review/sign-off (folded in here for this user; the external reviewer's portal is a different user, PRD-09), then into the Library once sealed.
- **Emphasis note (§6):** this is **table stakes, not the headline** — generic AI can half-draft a local file, so the Factory is the recurring hook, not the wow.

**7 · Planning (scenarios).** *(PRD-01 §6.8 scenarios, powered by PRD-11/07 overlay — the planning lens)*
- **Job:** model the future without touching the record.
- **Contains:** scenario setup (move IP to Ireland, restructure a supply chain, tariff impact), computed implications (rate, true-up, exposure), side-by-side comparison; structurally incapable of writing to the record.
- **User does:** models what-ifs, compares, and — if deciding to make one real — sends a governed proposal.
- **Hands off to:** a governed-edit proposal (the only path from scenario to reality).
- **Emphasis note (§6):** the **most valuable lens** (practitioner feedback: planning is where the technical judgment and the money are) and the **expansion story**.

**8 · Monitor.** *(PRD-01 §6.8, powered by PRD-11)*
- **Job:** watch the positions between filing cycles.
- **Contains:** margins drifting toward range edges, safe-harbour tests, the Pillar 2 position, approaching deadlines — exceptions only, quarterly rhythm, no live ticker.
- **User does:** during the close, sees what needs attention and assembles the provision picture.
- **Hands off to:** Findings (drift that becomes a real problem), Planning (model a fix).

**9 · Calendar / Obligations.** *(PRD-01 §6.9)*
- **Job:** every statutory duty, owned and evidenced.
- **Contains:** obligations by jurisdiction — what's due, who owns it, what satisfies it, filing evidence; the regulatory-change lane.
- **User does:** checks what's coming, assigns ownership, attaches filing evidence.
- **Distinct from Monitor (#8):** Monitor watches the *numbers*; Calendar tracks the *deadlines*.
- **Hands off to:** Factory (produce what a deadline needs).

## 5. What is deliberately NOT a page (the discipline)

- **Entity / Flow detail** — the Graph zoomed in, not a tenth page.
- **Defense** — *assembled from* Findings + Library + Calendar when a challenge comes (the IDR-response pack is generated, not lived-in). An action, not a destination, until a real audit justifies building it as one.
- **Admin / settings / governance** *(PRD-01 §6.13–6.14, PRD-13)* — the substrate; visited rarely; not in the daily working set.
- **Review / sign-off** — folded into the Factory for this user (the tail of producing a document). The *external reviewer* experiences it as its own portal, but that's a different user (PRD-09), not this person's nine pages.
- **Onboarding / the reveal** *(PRD-01 §6.15)* — the first-run journey, not the established experience this PRD covers.

## 6. The emphasis re-weighting (from the practitioner interviews)

Two TP practitioners, interviewed at length, independently converged on where the real pain and value sit — and it was *not* document drafting. This reorders which capabilities the product leads with. **Nothing here changes the architecture** (the object model and Laws stand); it changes *emphasis, sequencing, and positioning*.

**The re-weighting, most-moat to least:**
- **Gathering — elevated to a headline differentiator.** Both practitioners named *information gathering* (the functional + economic analysis: what each entity does, bears, employs, and what return that implies) as the worst grind. It is also what generic AI is structurally *worst* at (it requires holding a specific company's reality, not searching the web) and what the Big Four's current AI (a generic Copilot-class assistant, confirmed "not tax specific") cannot touch. The ingestion + Clerk + functional-interview-mode + DataRequest stack (PRD-03/04/10) deserves *more* design weight than a component catalog implies. **This is the emotional center of the value story.**
- **The record + contradiction detection (Mirror) — the wedge / entry.** Fastest provable value, best demo, real differentiation. **Caveat that must be honored in positioning:** contradictions are a symptom the *under-served* have (weak governance, no consistent advisor) and the *well-advised* largely don't. Pitch Mirror to newly-in-scope and AI-native groups (the ICP); **never** pitch it to a well-run enterprise, which will say "we don't have that problem." The wedge is right *for the target market* precisely because that market has the gap.
- **Planning / modeling — highest long-term value, the expansion story.** Named the most valuable and least-budgeted work; where tariff and restructuring pain lives.
- **Document Factory — table stakes, de-emphasized.** Kept (compliance is annual and unavoidable — the recurring hook), but demoted in positioning: "we generate the local file" is no longer a headline because "so does Gemini" is now a sentence a buyer can say.

**The one-line strategy that falls out:** *enter on the contradiction, sell on killing the gathering grind, expand into planning, and let document generation be the thing that quietly renews every year.*

**UI consequence:** the daily page set above is correct as-is, but the *narrative* the product tells — in onboarding, in the Briefing's framing, in the demo click-path — should foreground gathering (the record assembling itself from a company's mess) and the contradiction reveal, not the document factory.

## 7. Metrics of a coherent experience

- **Triage completable in ≤90s** (the Briefing routes attention without hunting).
- **Every page passes the one-job test** (§4 — no page does two unrelated jobs; no two pages do the same job).
- **Time-to-first-citation-opened** early in a session (the provenance interaction is the trust moment — it should happen fast and often; PRD-01 §9).
- **Cross-page hunts per task trend down** (a well-seamed set means a task lives mostly on one page with clean hand-offs, not a scavenger hunt).
- **Lens legibility:** a user can move between planning / compliance / defense work on the *same entity* without ever feeling they've changed data sources (the one-record model holds).

## 8. Open questions

**O-1 · Findings vs Monitor seam (the one most likely to move).** Line drawn: Findings = discrete problems in the record *now* (a contradiction, an expired agreement); Monitor = continuous drift over time toward a *future* problem (a margin trending out of range by year-end). Real distinction, but the one users are likeliest to find blurry. Watch in testing with practitioners; if they conflate them, merge Monitor's alerts into Findings. Held separate for now because the mental model differs ("fix this" vs "watch this").
**O-2 · Lens expression in the frame.** Do users live in one lens for a whole session (argues for a persistent mode selector in the top bar) or move fluidly between lenses on the same entity (argues for lenses as contextual actions *on* the record, not a global mode)? Decides whether the planning/compliance/defense distinction renders as a top-bar mode or as entity-level actions. Resolve with the two practitioner testers — it's a "how do you actually work" question.
**O-3 · Packaging vs architecture (the legitimate version of the sub-product instinct).** Different markets weight lenses differently (compliance-led vs planning-led buyers). The consequence is *packaging and default home screen per segment* — configuration atop one record — **not** three siloed sub-products. Confirm the packaging flex without ever splitting the spine.
**O-4 · Does the established VP land on the Briefing or on an exposure-rollup home?** Current spec: Briefing for all, role-composed. Test whether the VP wants a decision-and-exposure view instead. (Mirrors PRD-01 O-5 / PRD-00 O-2 for the Controller.)

— end —
