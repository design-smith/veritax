// Pure prop derivations for evidence events — turn raw UI data (filenames, kinds, scope) into
// non-content categories so no document content / PII reaches analytics (PRD §30).

export function documentType(sourceLabel: string | null | undefined): string {
  const s = (sourceLabel ?? "").toLowerCase()
  if (s.includes("trial balance")) return "trial_balance"
  if (s.includes("financial statement")) return "financial_statements"
  if (s.includes("local file")) return "local_file_draft"
  if (s.includes("questionnaire")) return "questionnaire"
  if (s.includes("interview")) return "interview"
  if (s.includes("benchmark")) return "benchmarking"
  if (s.includes("prior")) return "prior_year_file"
  return "document"
}

// Risk/requirement evidence "kind" in the demo is "section" | "figure"; used as document_category / locator_type.
export function documentCategory(kind: string | null | undefined): string {
  return kind === "figure" ? "figure" : "section"
}

// Per-file jurisdiction scope filter — report global/count only, never the jurisdiction names.
export function scopeFilterValue(scope: string[]): string {
  return scope.length === 0 ? "global" : `scoped_${scope.length}`
}

export interface DraftSectionLike { requirement_key: string; element_order: number }

// Ordered per-section lifecycle payloads for a completed draft (the demo generates as a batch).
export function sectionLifecycle(sections: DraftSectionLike[], totalMs: number): Array<{ section_key: string; section_index: number; generation_duration_ms: number }> {
  const ordered = [...sections].sort((a, b) => a.element_order - b.element_order)
  const per = ordered.length ? Math.round(totalMs / ordered.length) : 0
  return ordered.map(s => ({ section_key: s.requirement_key, section_index: s.element_order, generation_duration_ms: per }))
}

// Person properties attached at identify() after a waitlist submission — no email/name (PRD §6, §30).
export function waitlistPersonProps(input: { entry_source?: string; campaign?: string; first_demo_date: string }): Record<string, string | undefined> {
  return {
    waitlist_status: "requested",
    first_demo_date: input.first_demo_date,
    acquisition_source: input.entry_source,
    campaign: input.campaign,
  }
}

export interface RiskLike { id: string; kind: string; severity: string }

// Non-content risk props: kind is the type, the opaque finding id is the category (useful for "most opened
// risks"), severity passes through. Never the title/description/exposure narrative (PRD §13, §30).
export function riskProps(f: RiskLike): { risk_type: string; severity: string; risk_category: string } {
  return { risk_type: f.kind, severity: f.severity, risk_category: f.id }
}

export interface ComparisonState { seen: Set<string>; fired: boolean }

// Track distinct jurisdictions the user has inspected. Returns the code list the first time >=2 are seen
// (so jurisdiction_comparison_used fires once per run), else null. Comparison = investigating, not navigating.
export function trackJurisdictionComparison(state: ComparisonState, code: string): string[] | null {
  state.seen.add(code)
  if (!state.fired && state.seen.size >= 2) {
    state.fired = true
    return [...state.seen]
  }
  return null
}
