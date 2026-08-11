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
