// Thin client for the Veritax Sources-stage backend (FastAPI).
// Base URL from env; falls back to local dev. All calls throw on non-2xx so callers can log.

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

export type SourceKind = "financials" | "agreements" | "public" | "interview"

export interface DocumentRead {
  id: string
  original_filename: string
  content_type: string | null
  size_bytes: number
  content_hash: string
  status: "uploaded" | "embedding" | "embedded" | "failed"
  error: string | null
  created_at: string
}

export interface EngagementSource {
  id: string
  kind: SourceKind
  origin: string
  connector_provider: string | null
  url: string | null
  documents: DocumentRead[]
}

export interface Engagement {
  id: string
  entity_name: string | null
  jurisdictions: string[]
  website_url: string | null
  sources: EngagementSource[]
}

export interface Connector {
  provider: string
  display_name: string
  category: "accounting" | "notetaker"
  status: "available" | "wired"
}

export type CoverageStatusValue =
  | "pending" | "present" | "partial" | "missing" | "conditional" | "failed"

export interface CoverageEvidence {
  document_id: string | null
  source_label: string
  locator: string // section / page / quoted passage
}

export interface CoverageRow {
  id: string
  requirement_key: string
  element_order: number
  element_name: string
  element_description: string
  is_conditional: boolean
  verified: boolean
  status: CoverageStatusValue
  whats_present: string | null
  whats_missing: string | null
  confidence: "high" | "medium" | "low" | null
  sources_used: string[]
  evidence: CoverageEvidence[]
  draft_section_id: string | null
}

export interface CoverageResponse {
  jurisdiction: string
  summary: {
    total: number
    required_total: number
    present: number
    partial: number
    missing: number
    conditional: number
    pending: number
    need_attention: number
  }
  requirements: CoverageRow[]
}

export type DraftStatusValue = "pending" | "drafting" | "drafted" | "failed"

export interface DraftCitation {
  marker: number
  kind: "document" | "web"
  document_id: string | null
  url: string | null
  source_label: string
  quote: string
}

export interface DraftSection {
  id: string
  requirement_key: string
  element_order: number
  element_name: string
  status: DraftStatusValue
  content: string | null
  error: string | null
  citations: DraftCitation[]
}

export interface DraftResponse {
  jurisdiction: string
  summary: { total: number; drafted: number; pending: number; failed: number }
  sections: DraftSection[]
}

export type RiskKind = "discrepancy" | "exposure"
export type RiskSeverityValue = "critical" | "high" | "medium" | "low"

export interface RiskEvidence {
  kind: string
  reference: string
  detail: string
  document_id: string | null
}

export interface RiskFinding {
  id: string
  kind: RiskKind
  title: string
  description: string
  severity: RiskSeverityValue
  exposure_label: string | null
  exposure_estimated: boolean
  exposure_amount: number | null
  exposure_currency: string | null
  confidence: "high" | "medium" | "low"
  evidence: RiskEvidence[]
  recommendations: string[]
}

export interface RiskResponse {
  jurisdiction: string
  status: "not_started" | "pending" | "analyzing" | "done" | "failed"
  error: string | null
  summary: { total: number; by_severity: Record<string, number>; by_kind: Record<string, number> }
  findings: RiskFinding[]
}

// Thrown by startRisks when the draft isn't complete (HTTP 409).
export class DraftNotCompleteError extends Error {}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`API ${res.status} ${res.url}: ${text}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  createEngagement: (): Promise<{ id: string }> =>
    fetch(`${BASE}/engagements`, { method: "POST" }).then(r => parse<{ id: string }>(r)),

  patchEngagement: (
    id: string,
    body: { entity_name?: string; jurisdictions?: string[]; website_url?: string },
  ): Promise<unknown> =>
    fetch(`${BASE}/engagements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => parse<unknown>(r)),

  uploadDocuments: (id: string, kind: SourceKind, files: File[]): Promise<DocumentRead[]> => {
    const fd = new FormData()
    fd.append("kind", kind)
    for (const f of files) fd.append("files", f)
    return fetch(`${BASE}/engagements/${id}/documents`, { method: "POST", body: fd }).then(r =>
      parse<DocumentRead[]>(r),
    )
  },

  getDocument: (documentId: string): Promise<DocumentRead> =>
    fetch(`${BASE}/documents/${documentId}`).then(r => parse<DocumentRead>(r)),

  getEngagement: (id: string): Promise<Engagement> =>
    fetch(`${BASE}/engagements/${id}`).then(r => parse<Engagement>(r)),

  createSource: (
    id: string,
    body: { kind: SourceKind; origin: "connected" | "reference"; connector_provider?: string; url?: string },
  ): Promise<{ id: string }> =>
    fetch(`${BASE}/engagements/${id}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => parse<{ id: string }>(r)),

  getConnectors: (): Promise<Connector[]> =>
    fetch(`${BASE}/connectors`).then(r => parse<Connector[]>(r)),

  startCoverage: (engagementId: string, jurisdiction: string): Promise<CoverageResponse> =>
    fetch(`${BASE}/engagements/${engagementId}/coverage?jurisdiction=${encodeURIComponent(jurisdiction)}`, {
      method: "POST",
    }).then(r => parse<CoverageResponse>(r)),

  getCoverage: (engagementId: string, jurisdiction: string): Promise<CoverageResponse> =>
    fetch(`${BASE}/engagements/${engagementId}/coverage?jurisdiction=${encodeURIComponent(jurisdiction)}`)
      .then(r => parse<CoverageResponse>(r)),

  supplementCoverage: (
    coverageId: string,
    body: { kind: "upload"; file: File } | { kind: "text"; text: string },
  ): Promise<CoverageRow> => {
    const fd = new FormData()
    fd.append("kind", body.kind)
    if (body.kind === "upload") fd.append("file", body.file)
    else fd.append("text", body.text)
    return fetch(`${BASE}/coverage/${coverageId}/supplements`, { method: "POST", body: fd }).then(r =>
      parse<CoverageRow>(r),
    )
  },

  startDraft: (engagementId: string, jurisdiction: string): Promise<DraftResponse> =>
    fetch(`${BASE}/engagements/${engagementId}/draft?jurisdiction=${encodeURIComponent(jurisdiction)}`, {
      method: "POST",
    }).then(r => parse<DraftResponse>(r)),

  getDraft: (engagementId: string, jurisdiction: string): Promise<DraftResponse> =>
    fetch(`${BASE}/engagements/${engagementId}/draft?jurisdiction=${encodeURIComponent(jurisdiction)}`)
      .then(r => parse<DraftResponse>(r)),

  regenerateSection: (sectionId: string): Promise<DraftSection> =>
    fetch(`${BASE}/draft-sections/${sectionId}/regenerate`, { method: "POST" }).then(r =>
      parse<DraftSection>(r),
    ),

  startRisks: async (engagementId: string, jurisdiction: string): Promise<RiskResponse> => {
    const res = await fetch(
      `${BASE}/engagements/${engagementId}/risks?jurisdiction=${encodeURIComponent(jurisdiction)}`,
      { method: "POST" },
    )
    if (res.status === 409) throw new DraftNotCompleteError("draft not complete")
    return parse<RiskResponse>(res)
  },

  getRisks: (engagementId: string, jurisdiction: string): Promise<RiskResponse> =>
    fetch(`${BASE}/engagements/${engagementId}/risks?jurisdiction=${encodeURIComponent(jurisdiction)}`)
      .then(r => parse<RiskResponse>(r)),
}
