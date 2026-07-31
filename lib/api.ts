// Thin client for the Veritax Sources-stage backend (FastAPI).
// Base URL from env; falls back to local dev. All calls throw on non-2xx so callers can log.

import { createClient } from "@/lib/supabase/client"

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

export interface HealthResponse {
  ok: boolean
  db?: boolean
  error?: string
  source?: "ready" | "health/db" | "health"
}

// Every backend call carries the Supabase access token — the API verifies it and scopes data per user.
let _sb: ReturnType<typeof createClient> | null = null
async function afetch(url: string, init: RequestInit = {}): Promise<Response> {
  _sb ??= createClient()
  const headers = new Headers(init.headers)
  const { data } = await _sb.auth.getSession()
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`)
  return fetch(url, { ...init, headers })
}

export type SourceKind = "financials" | "agreements" | "public" | "interview" | "supplement"

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

export interface DocumentTextRead {
  id: string
  original_filename: string
  status: "uploaded" | "embedding" | "embedded" | "failed"
  text: string
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

export interface EngagementSummary {
  id: string
  entity_name: string | null
  jurisdictions: string[]
  updated_at: string
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
  error: string | null
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
    failed: number
    need_attention: number
    draft_ready: boolean
    draft_blocker: string | null
    present_ratio: number
    draft_min_present_ratio: number
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

export interface DocTable { id: string; title: string; columns: string[]; rows: string[][] }
export interface DocChart {
  id: string
  type: "bar" | "column" | "line" | "pie"
  title: string
  categories: string[]
  series: { name: string; values: number[] }[]
}

export interface DraftSection {
  id: string
  requirement_key: string
  element_order: number
  element_name: string
  status: DraftStatusValue
  content: string | null
  tables: DocTable[]
  charts: DocChart[]
  error: string | null
  citations: DraftCitation[]
}

export interface DraftResponse {
  jurisdiction: string
  draft_mode: string
  summary: { total: number; drafted: number; pending: number; failed: number }
  sections: DraftSection[]
}

export interface PipelineRecoveryResponse {
  retried_failed: boolean
  documents_restarted: number
  coverage_jurisdictions_restarted: string[]
  draft_jurisdictions_restarted: string[]
}

export type RiskKind = "discrepancy" | "exposure"
export type RiskSeverityValue = "critical" | "high" | "medium" | "low"

export interface RiskEvidence {
  kind: string
  reference: string
  detail: string
  source_label: string | null
  verified: boolean
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
  analysis_mode: string
  stale: boolean
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

async function parseVoid(res: Response): Promise<void> {
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`API ${res.status} ${res.url}: ${text}`)
  }
}

function describeError(error: unknown) {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
  }
}

function isApiStatus(error: unknown, status?: number) {
  if (!(error instanceof Error)) return false
  return status === undefined
    ? error.message.startsWith("API ")
    : error.message.startsWith(`API ${status} `)
}

async function fetchHealth(path: "/ready" | "/health/db" | "/health"): Promise<HealthResponse> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" })
  const body = await parse<HealthResponse>(res)
  return { ...body, source: path.slice(1) as HealthResponse["source"] }
}

export const api = {
  health: async (): Promise<HealthResponse> => {
    try {
      return await fetchHealth("/ready")
    } catch (error) {
      if (isApiStatus(error) && !isApiStatus(error, 404)) throw error
      console.warn("[veritax] readiness probe failed; trying /health/db", {
        base: BASE,
        probe: "/ready",
        error: describeError(error),
      })
    }

    try {
      return await fetchHealth("/health/db")
    } catch (error) {
      if (isApiStatus(error)) throw error
      console.warn("[veritax] db health probe was blocked or unreachable; trying /health", {
        base: BASE,
        probe: "/health/db",
        error: describeError(error),
      })
    }

    const basic = await fetchHealth("/health")
    return { ...basic, db: undefined, source: "health" }
  },

  createEngagement: (): Promise<{ id: string }> =>
    afetch(`${BASE}/engagements`, { method: "POST" }).then(r => parse<{ id: string }>(r)),

  listEngagements: (): Promise<EngagementSummary[]> =>
    afetch(`${BASE}/engagements`).then(r => parse<EngagementSummary[]>(r)),

  patchEngagement: (
    id: string,
    body: { entity_name?: string; jurisdictions?: string[]; website_url?: string },
  ): Promise<unknown> =>
    afetch(`${BASE}/engagements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => parse<unknown>(r)),

  uploadDocuments: (id: string, kind: SourceKind, files: File[]): Promise<DocumentRead[]> => {
    const fd = new FormData()
    fd.append("kind", kind)
    for (const f of files) fd.append("files", f)
    return afetch(`${BASE}/engagements/${id}/documents`, { method: "POST", body: fd }).then(r =>
      parse<DocumentRead[]>(r),
    )
  },

  getDocument: (documentId: string): Promise<DocumentRead> =>
    afetch(`${BASE}/documents/${documentId}`).then(r => parse<DocumentRead>(r)),

  getDocumentText: (documentId: string): Promise<DocumentTextRead> =>
    afetch(`${BASE}/documents/${documentId}/text`).then(r => parse<DocumentTextRead>(r)),

  deleteDocument: (documentId: string): Promise<void> =>
    afetch(`${BASE}/documents/${documentId}`, { method: "DELETE" }).then(parseVoid),

  recoverPipeline: (engagementId: string, retryFailed = false): Promise<PipelineRecoveryResponse> =>
    afetch(`${BASE}/engagements/${engagementId}/pipeline/recover?retry_failed=${retryFailed ? "true" : "false"}`, {
      method: "POST",
    }).then(r => parse<PipelineRecoveryResponse>(r)),

  getEngagement: (id: string): Promise<Engagement> =>
    afetch(`${BASE}/engagements/${id}`).then(r => parse<Engagement>(r)),

  createSource: (
    id: string,
    body: { kind: SourceKind; origin: "connected" | "reference"; connector_provider?: string; url?: string },
  ): Promise<{ id: string }> =>
    afetch(`${BASE}/engagements/${id}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => parse<{ id: string }>(r)),

  getConnectors: (): Promise<Connector[]> =>
    afetch(`${BASE}/connectors`).then(r => parse<Connector[]>(r)),

  startCoverage: (engagementId: string, jurisdiction: string, force = false): Promise<CoverageResponse> =>
    afetch(`${BASE}/engagements/${engagementId}/coverage?jurisdiction=${encodeURIComponent(jurisdiction)}${force ? "&force=true" : ""}`, {
      method: "POST",
    }).then(r => parse<CoverageResponse>(r)),

  getCoverage: (engagementId: string, jurisdiction: string): Promise<CoverageResponse> =>
    afetch(`${BASE}/engagements/${engagementId}/coverage?jurisdiction=${encodeURIComponent(jurisdiction)}`)
      .then(r => parse<CoverageResponse>(r)),

  supplementCoverage: (
    coverageId: string,
    body: { kind: "upload"; file: File } | { kind: "text"; text: string },
  ): Promise<CoverageRow> => {
    const fd = new FormData()
    fd.append("kind", body.kind)
    if (body.kind === "upload") fd.append("file", body.file)
    else fd.append("text", body.text)
    return afetch(`${BASE}/coverage/${coverageId}/supplements`, { method: "POST", body: fd }).then(r =>
      parse<CoverageRow>(r),
    )
  },

  markCoverageSatisfied: (coverageId: string): Promise<CoverageRow> =>
    afetch(`${BASE}/coverage/${coverageId}/satisfied`, { method: "POST" }).then(r => parse<CoverageRow>(r)),

  startDraft: (engagementId: string, jurisdiction: string): Promise<DraftResponse> =>
    afetch(`${BASE}/engagements/${engagementId}/draft?jurisdiction=${encodeURIComponent(jurisdiction)}`, {
      method: "POST",
    }).then(r => parse<DraftResponse>(r)),

  getDraft: (engagementId: string, jurisdiction: string): Promise<DraftResponse> =>
    afetch(`${BASE}/engagements/${engagementId}/draft?jurisdiction=${encodeURIComponent(jurisdiction)}`)
      .then(r => parse<DraftResponse>(r)),

  downloadDraftDocx: async (engagementId: string, jurisdiction: string): Promise<Blob> => {
    const res = await afetch(`${BASE}/engagements/${engagementId}/draft.docx?jurisdiction=${encodeURIComponent(jurisdiction)}`)
    if (!res.ok) throw new Error(`API ${res.status} ${res.url}: ${await res.text().catch(() => "")}`)
    return res.blob()
  },

  regenerateSection: (sectionId: string): Promise<DraftSection> =>
    afetch(`${BASE}/draft-sections/${sectionId}/regenerate`, { method: "POST" }).then(r =>
      parse<DraftSection>(r),
    ),

  updateDraftSection: (sectionId: string, body: { content: string }): Promise<DraftSection> =>
    afetch(`${BASE}/draft-sections/${sectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => parse<DraftSection>(r)),

  startRisks: async (engagementId: string, jurisdiction: string): Promise<RiskResponse> => {
    const res = await afetch(
      `${BASE}/engagements/${engagementId}/risks?jurisdiction=${encodeURIComponent(jurisdiction)}`,
      { method: "POST" },
    )
    if (res.status === 409) throw new DraftNotCompleteError("draft not complete")
    return parse<RiskResponse>(res)
  },

  getRisks: (engagementId: string, jurisdiction: string): Promise<RiskResponse> =>
    afetch(`${BASE}/engagements/${engagementId}/risks?jurisdiction=${encodeURIComponent(jurisdiction)}`)
      .then(r => parse<RiskResponse>(r)),
}
