// In-memory backend for the public /demo route. The real app (app/page.tsx) and every step component
// run UNCHANGED against the `api` singleton in lib/api.ts; on /demo that singleton routes here instead of
// the network (see the Proxy at the bottom of lib/api.ts). Same behavior, nothing actually executes.
//
// The dataset is one fully-processed Local File: Veritax Outsourcing & Services W.L.L. (Qatar, FY2024).
// Draft content is the humanized copy in components/demo/localFileDemo.ts.

import type {
  Connector,
  CoverageResponse,
  CoverageRow,
  DocumentFactsResponse,
  DocumentRead,
  DocumentTextRead,
  DraftResponse,
  DraftSection,
  Engagement,
  EngagementSummary,
  HealthResponse,
  PipelineRecoveryResponse,
  RiskFinding,
  RiskResponse,
  SourceKind,
} from "./api"
import { DEMO_SECTIONS } from "@/components/demo/localFileDemo"

// Active only on the public demo route. Keying off the URL auto-scopes it: the real app (other routes,
// authenticated) keeps using the network even in the same browser session.
export const inDemo = () =>
  typeof window !== "undefined" && window.location.pathname.startsWith("/demo")

export const DEMO_ENGAGEMENT_ID = "demo-vos-qatar-fy2024"
const JURISDICTION = "Qatar"

const DOC_FIN = "demo-doc-financials"
const DOC_TB = "demo-doc-trialbalance"
const DOC_AGR1 = "demo-doc-priorfile"
const DOC_AGR2 = "demo-doc-questionnaire"
const DOC_INT = "demo-doc-interview"

const now = "2025-09-21T09:00:00Z"

function doc(id: string, filename: string, content_type: string): DocumentRead {
  return {
    id,
    original_filename: filename,
    content_type,
    size_bytes: 842_000,
    content_hash: id,
    status: "embedded",
    extraction_status: "extracted",
    error: null,
    created_at: now,
  }
}

const DOCS: Record<string, DocumentRead> = {
  [DOC_FIN]: doc(DOC_FIN, "VOS Audited Financial Statements FY2024.pdf", "application/pdf"),
  [DOC_TB]: doc(DOC_TB, "VOS Trial Balance FY2024.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
  [DOC_AGR1]: doc(DOC_AGR1, "Prior Local File FY2023.pdf", "application/pdf"),
  [DOC_AGR2]: doc(DOC_AGR2, "TP Questionnaire - VOS.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
  [DOC_INT]: doc(DOC_INT, "Management interview - Karim Haddad.vtt", "text/vtt"),
}

const ENGAGEMENT: Engagement = {
  id: DEMO_ENGAGEMENT_ID,
  entity_name: "Veritax Outsourcing & Services W.L.L.",
  jurisdictions: [JURISDICTION],
  fiscal_year: "FY2024",
  website_url: "https://veritaxoutsourcing.qa",
  selected_source_kinds: ["financials", "agreements", "public", "interview"],
  sources: [
    { id: "src-fin-up", kind: "financials", origin: "reference", connector_provider: null, url: null, documents: [DOCS[DOC_FIN], DOCS[DOC_TB]] },
    { id: "src-fin-erp", kind: "financials", origin: "connected", connector_provider: "sap", url: null, documents: [] },
    { id: "src-agr", kind: "agreements", origin: "reference", connector_provider: null, url: null, documents: [DOCS[DOC_AGR1], DOCS[DOC_AGR2]] },
    { id: "src-web", kind: "public", origin: "reference", connector_provider: null, url: "https://veritaxoutsourcing.qa", documents: [] },
    { id: "src-int-up", kind: "interview", origin: "reference", connector_provider: null, url: null, documents: [DOCS[DOC_INT]] },
    { id: "src-int-nt", kind: "interview", origin: "connected", connector_provider: "fireflies", url: null, documents: [] },
  ],
}

const SUMMARY: EngagementSummary = {
  id: DEMO_ENGAGEMENT_ID,
  entity_name: ENGAGEMENT.entity_name,
  jurisdictions: ENGAGEMENT.jurisdictions,
  fiscal_year: ENGAGEMENT.fiscal_year,
  updated_at: now,
}

// ── Requirements coverage ─────────────────────────────────────────────────────
// All present so the file is draft-ready (matching a completed engagement). Substantive concerns
// about the file live in the Risks tab, not in coverage — coverage answers "is the element addressed".

function row(
  order: number,
  name: string,
  description: string,
  whats_present: string,
  source_label: string,
  locator: string,
  draft_section_id: string | null,
): CoverageRow {
  return {
    id: `cov-${order}`,
    requirement_key: `req-${order}`,
    element_order: order,
    element_name: name,
    element_description: description,
    is_conditional: false,
    verified: true,
    status: "present",
    whats_present,
    whats_missing: null,
    confidence: "high",
    error: null,
    sources_used: [source_label],
    evidence: [{ document_id: null, source_label, locator }],
    draft_section_id,
  }
}

const COVERAGE_ROWS: CoverageRow[] = [
  row(1, "Management structure", "Local organisation chart and reporting lines of the entity.", "Reporting lines and signatories are set out in §2.1.", "Management interview - Karim Haddad.vtt", "The Company runs as a single management line…", "sec-2"),
  row(2, "Business and strategy", "Description of the local business, strategy, and any restructurings.", "Activities and strategy are described in §2.2; no restructurings in FY2024.", "Local File draft", "VOS supplies technical manpower and staff augmentation services…", "sec-2"),
  row(3, "Controlled transactions inventory", "Each material category of intercompany transaction and its context.", "Fund transfers and supplier payments are inventoried in §3.1.", "VOS Trial Balance FY2024.xlsx", "Transaction One: Fund Transfers; Transaction Two: Supplier Payments", "sec-3"),
  row(4, "Amounts by category and counterparty", "Intra-group payments and receipts per category and related party.", "Per-counterparty amounts are tabled in §3.1.", "VOS Trial Balance FY2024.xlsx", "TOTAL 5,235,268.87 / 406,858", "sec-3"),
  row(5, "Material intercompany agreements", "Executed agreements governing the controlled transactions.", "The file documents that no agreements are signed and deduces the terms from conduct (§3.2).", "Local File draft", "VOS has not signed any intragroup transfer pricing agreements…", "sec-3"),
  row(6, "Functional, asset and risk analysis", "Functions performed, assets used, and risks assumed by the entity.", "The FAR analysis is in §4.", "Local File draft", "This functional analysis sets out the economically significant activities…", "sec-4"),
  row(7, "Method selection", "Most appropriate transfer pricing method and reasons for selecting it.", "TNMM selection and rejection of CUP/Resale are reasoned in §5.", "Local File draft", "The Transactional Net Margin Method (TNMM) was used…", "sec-5"),
  row(8, "Comparability and benchmarking", "Benchmarking study and the arm's-length range applied.", "The Net Cost-Plus benchmarking range is set out in §5.", "Local File draft", "lower quartile -0.5%, upper quartile 11.7%, median 7.3%", "sec-5"),
  row(9, "Financial information and tie-out", "Annual accounts and reconciliation to the pricing analysis.", "Audited accounts support the tested margin.", "VOS Audited Financial Statements FY2024.pdf", "operating margin of 3.25% on the tested transactions", null),
  row(10, "Pricing terms of fund transfers", "Documented terms for the intercompany fund transfers.", "Terms are described in §3.1.1: interest-free, reciprocal, no fixed maturity.", "Local File draft", "No loan agreements were signed, no repayment or maturity dates were set…", "sec-3"),
  row(11, "Arm's-length conclusion", "Explanation of why the results support an arm's-length outcome.", "The arm's-length conclusion is stated at the end of §5.", "Local File draft", "The result is therefore consistent with the arm's length principle.", "sec-5"),
]

function coverage(): CoverageResponse {
  const required_total = COVERAGE_ROWS.length
  return {
    jurisdiction: JURISDICTION,
    summary: {
      total: COVERAGE_ROWS.length,
      required_total,
      present: COVERAGE_ROWS.length,
      partial: 0,
      missing: 0,
      conditional: 0,
      pending: 0,
      failed: 0,
      need_attention: 0,
      draft_ready: true,
      draft_blocker: null,
      present_ratio: 1,
      draft_min_present_ratio: 0.8,
    },
    requirements: COVERAGE_ROWS,
    skipped_documents: [],
  }
}

// ── Draft ─────────────────────────────────────────────────────────────────────

const DRAFT_SECTIONS: DraftSection[] = DEMO_SECTIONS.map(s => ({
  id: `sec-${s.order}`,
  requirement_key: `req-${s.order}`,
  element_order: s.order,
  element_name: s.title,
  status: "drafted",
  // Prefix the element heading so DraftDocument's leading-heading strip leaves the body intact.
  content: `## ${s.order}. ${s.title}\n\n${s.body}`,
  tables: (s.tables ?? []).map((t, i) => ({ id: `tbl-${s.order}-${i}`, title: t.title ?? "", columns: t.columns, rows: t.rows })),
  charts: [],
  error: null,
  citations: [],
}))

function draft(): DraftResponse {
  return {
    jurisdiction: JURISDICTION,
    draft_mode: "real",
    summary: { total: DRAFT_SECTIONS.length, drafted: DRAFT_SECTIONS.length, pending: 0, failed: 0 },
    sections: DRAFT_SECTIONS.map(s => ({ ...s })),
  }
}

// ── Risks ─────────────────────────────────────────────────────────────────────

const FINDINGS: RiskFinding[] = [
  {
    id: "f1", kind: "exposure", severity: "high",
    title: "Intercompany fund transfers lack loan documentation",
    description: "QAR 5.2m of related-party fund transfers were made interest-free with no loan agreements, repayment schedules, or terms. A tax authority may recharacterise these as financing and impute interest.",
    exposure_label: "Imputed-interest / recharacterisation", exposure_estimated: true, exposure_amount: null, exposure_currency: null, confidence: "medium",
    evidence: [
      { kind: "section", reference: "Draft §3.1.1", detail: "No loan agreements were signed, no repayment or maturity dates were set, and no interest or financing margin was charged.", source_label: "Local File draft", verified: true, document_id: null },
      { kind: "figure", reference: "Transaction One total", detail: "TOTAL in QAR 5,235,268.87", source_label: "VOS Trial Balance FY2024.xlsx", verified: true, document_id: DOC_TB },
    ],
    recommendations: ["Execute intercompany loan or cash-pooling agreements with defined terms.", "Document the liquidity-management rationale and reciprocal nature contemporaneously."],
  },
  {
    id: "f2", kind: "discrepancy", severity: "high",
    title: "No signed intercompany agreements on file",
    description: "The file states there are no signed transfer pricing agreements between VOS and related entities, yet material controlled transactions occurred. This is a documentation gap the arm's-length analysis relies on.",
    exposure_label: "Documentation gap", exposure_estimated: true, exposure_amount: null, exposure_currency: null, confidence: "high",
    evidence: [
      { kind: "section", reference: "Draft §3.2", detail: "VOS has not signed any intragroup transfer pricing agreements with its related entities.", source_label: "Local File draft", verified: true, document_id: null },
    ],
    recommendations: ["Put executed agreements in place for the recurring controlled transactions.", "Where none exist, deduce and document the terms from the parties' conduct."],
  },
  {
    id: "f3", kind: "exposure", severity: "medium",
    title: "Thin benchmarking set with negative-margin comparables",
    description: "The comparable set has only 4-5 observations and includes negative operating margins (1st quartile -0.5%, minimum -0.9%). A small, loss-making set weakens the reliability of the arm's-length range.",
    exposure_label: "Benchmark reliability", exposure_estimated: true, exposure_amount: null, exposure_currency: null, confidence: "medium",
    evidence: [
      { kind: "figure", reference: "Benchmarking - Net Cost-Plus", detail: "Number of observations: 5, 5, 4, 5; minimum 3-year average -0.9%.", source_label: "Benchmarking appendix", verified: true, document_id: null },
    ],
    recommendations: ["Broaden the search strategy and refresh the comparable set.", "Document rejection criteria and consider excluding persistent loss-makers."],
  },
  {
    id: "f4", kind: "exposure", severity: "low",
    title: "Tested margin sits below the benchmark median",
    description: "The tested operating margin of 3.25% is within the interquartile range (-0.5% to 11.7%) but well below the 7.3% median, leaving limited headroom on any downward adjustment.",
    exposure_label: "3.25% vs 7.3% median", exposure_estimated: true, exposure_amount: null, exposure_currency: null, confidence: "low",
    evidence: [
      { kind: "section", reference: "Draft §5", detail: "VOS reported an operating margin of 3.25% on the tested transactions, which sits inside the interquartile range.", source_label: "Local File draft", verified: true, document_id: null },
    ],
    recommendations: ["Monitor the margin against the range annually.", "Retain the year-on-year comparison to explain any drift."],
  },
]

function risks(): RiskResponse {
  const by_severity: Record<string, number> = {}
  const by_kind: Record<string, number> = {}
  for (const f of FINDINGS) {
    by_severity[f.severity] = (by_severity[f.severity] ?? 0) + 1
    by_kind[f.kind] = (by_kind[f.kind] ?? 0) + 1
  }
  return {
    jurisdiction: JURISDICTION,
    status: "done",
    error: null,
    analysis_mode: "real",
    stale: false,
    summary: { total: FINDINGS.length, by_severity, by_kind },
    findings: FINDINGS,
  }
}

// Canned source text so the Risks "Open" source preview resolves a snippet.
const TRIAL_BALANCE_TEXT = `Veritax Outsourcing & Services W.L.L. — Trial Balance FY2024 (extract)

Transaction One — Fund Transfers (amounts in QAR)
Veritax Support Services        152,000
Veritax Group Holding         3,915,537
Veritax Integrated Services      11,770
Sheikh Nasser Al-Kuwari       2,457,204
Doha Marine Trading          (1,385,492)
On Point Support Services        73,000
Veritax Hospitality              11,250
TOTAL in QAR 5,235,268.87

These balances were interest-free and cleared through reimbursements and intercompany netting during the year.`

const RECOVERY: PipelineRecoveryResponse = {
  retried_failed: false,
  documents_restarted: 0,
  coverage_jurisdictions_restarted: [],
  draft_jurisdictions_restarted: [],
  risk_jurisdictions_restarted: [],
}

const JURISDICTIONS = [
  "Australia", "Canada", "France", "Germany", "India", "Ireland", "Italy", "Japan",
  "Netherlands", "Qatar", "Singapore", "South Africa", "Spain", "Switzerland",
  "United Arab Emirates", "United Kingdom", "United States",
]

const rid = () => `demo-${Math.random().toString(36).slice(2, 10)}`

// Methods mirror lib/api.ts. Only the ones the app actually calls need to exist; anything missing
// falls through to the real (network) implementation via the Proxy.
export const demoApi = {
  health: async (): Promise<HealthResponse> => ({ ok: true, db: true, source: "ready" }),

  listEngagements: async (): Promise<EngagementSummary[]> => [SUMMARY],
  getEngagement: async (): Promise<Engagement> => ENGAGEMENT,
  // A fresh "New file" gets its own empty engagement so intake behaves normally.
  createEngagement: async (): Promise<{ id: string }> => ({ id: rid() }),
  patchEngagement: async (): Promise<unknown> => ({}),
  recoverPipeline: async (): Promise<PipelineRecoveryResponse> => RECOVERY,

  getConnectors: async (): Promise<Connector[]> => [],
  getJurisdictions: async (): Promise<string[]> => JURISDICTIONS,

  uploadDocuments: async (_id: string, _kind: SourceKind, files: File[]): Promise<DocumentRead[]> =>
    files.map((f, i) => doc(`${rid()}-${i}`, f.name, f.type || "application/octet-stream")),
  getDocument: async (documentId: string): Promise<DocumentRead> =>
    DOCS[documentId] ?? doc(documentId, "Document", "application/octet-stream"),
  deleteDocument: async (): Promise<void> => {},
  createSource: async (): Promise<{ id: string }> => ({ id: rid() }),

  startCoverage: async (): Promise<CoverageResponse> => coverage(),
  getCoverage: async (): Promise<CoverageResponse> => coverage(),
  supplementCoverage: async (coverageId: string): Promise<CoverageRow> => {
    const found = COVERAGE_ROWS.find(r => r.id === coverageId)
    return found ?? COVERAGE_ROWS[0]
  },
  markCoverageSatisfied: async (coverageId: string): Promise<CoverageRow> => {
    const found = COVERAGE_ROWS.find(r => r.id === coverageId)
    return found ?? COVERAGE_ROWS[0]
  },

  startDraft: async (): Promise<DraftResponse> => draft(),
  getDraft: async (): Promise<DraftResponse> => draft(),
  regenerateSection: async (sectionId: string): Promise<DraftSection> => {
    const found = DRAFT_SECTIONS.find(s => s.id === sectionId)
    return found ? { ...found } : DRAFT_SECTIONS[0]
  },
  updateDraftSection: async (sectionId: string, body: { content: string }): Promise<DraftSection> => {
    const found = DRAFT_SECTIONS.find(s => s.id === sectionId) ?? DRAFT_SECTIONS[0]
    return { ...found, content: body.content }
  },
  downloadDraftDocx: async (): Promise<Blob> => {
    const text = DRAFT_SECTIONS.map(s => `${s.element_order}. ${s.element_name}\n\n${s.content}`).join("\n\n")
    return new Blob([text], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
  },

  startRisks: async (): Promise<RiskResponse> => risks(),
  getRisks: async (): Promise<RiskResponse> => risks(),

  getDocumentText: async (documentId: string): Promise<DocumentTextRead> => ({
    id: documentId,
    original_filename: DOCS[documentId]?.original_filename ?? "Source",
    status: "embedded",
    text: TRIAL_BALANCE_TEXT,
  }),
  getDocumentFacts: async (documentId: string): Promise<DocumentFactsResponse> => ({
    document_id: documentId,
    facts: [],
  }),
}
