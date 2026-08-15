// Thin client for the Veritax Sources-stage backend (FastAPI).
// Base URL from env; falls back to local dev. All calls throw on non-2xx so callers can log.

import { createClient } from "@/lib/supabase/client"
import { demoApi, inDemo } from "@/lib/demo-api"

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
const BASE = API_BASE

export interface HealthResponse {
  ok: boolean
  db?: boolean
  error?: string
  source?: "ready" | "health/db" | "health"
}

const HEALTH_TIMEOUT_MS = 8_000
const HEALTH_RETRY_DELAYS_MS = [0, 1_000, 2_000, 4_000, 8_000]

// Every backend call carries the Supabase access token — the API verifies it and scopes data per user.
let _sb: ReturnType<typeof createClient> | null = null
type TraceableRequestInit = RequestInit & { trace?: string }

function apiPath(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

function elapsedMs(start: number) {
  return Math.round(performance.now() - start)
}

async function afetch(url: string, init: TraceableRequestInit = {}): Promise<Response> {
  const { trace, ...fetchInit } = init
  const startedAt = performance.now()
  _sb ??= createClient()
  const headers = new Headers(fetchInit.headers)
  const authStartedAt = performance.now()
  const { data } = await _sb.auth.getSession()
  const authMs = elapsedMs(authStartedAt)
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`)
  const fetchStartedAt = performance.now()
  const res = await fetch(url, { ...fetchInit, headers })
  if (trace) {
    console.info("[veritax:api] request", {
      trace,
      method: fetchInit.method ?? "GET",
      path: apiPath(url),
      status: res.status,
      authMs,
      fetchMs: elapsedMs(fetchStartedAt),
      totalMs: elapsedMs(startedAt),
    })
  }
  return res
}

export type SourceKind = "financials" | "agreements" | "public" | "interview" | "supplement"

export interface DocumentRead {
  id: string
  original_filename: string
  content_type: string | null
  size_bytes: number
  content_hash: string
  status: "uploaded" | "embedding" | "embedded" | "failed"
  extraction_status: string | null
  error: string | null
  created_at: string
}

export interface DocumentTextRead {
  id: string
  original_filename: string
  status: "uploaded" | "embedding" | "embedded" | "failed"
  text: string
}

export interface FactSourceRead {
  document_id: string
  page: number | null
  locator: string
  quote: string
}

export interface FactEntityMentionRead {
  id: string
  raw_name: string
  role: string
  resolution_status: string
  canonical_entity_id: string | null
  canonical_entity_name: string | null
}

export interface FactRead {
  id: string
  canonical_fact_id: string | null
  document_id: string
  fact_type: string
  value_raw: string
  value_normalized: string | null
  value_type: string
  unit: string | null
  period: string | null
  scope_level: string
  resolution_status: string
  entity_mention: FactEntityMentionRead | null
  sources: FactSourceRead[]
}

export interface DocumentFactsResponse {
  document_id: string
  facts: FactRead[]
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
  fiscal_year: string | null
  website_url: string | null
  selected_source_kinds: SourceKind[]
  sources: EngagementSource[]
}

export interface EngagementSummary {
  id: string
  entity_name: string | null
  jurisdictions: string[]
  fiscal_year: string | null
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
  skipped_documents: { document_id: string; filename: string; reason: string }[]
  regulatory: RegulatoryContext[]
}

export interface RegulatorySourceRef {
  title: string
  issuing_authority: string
  url: string | null
  citation_locator: string | null
}

export interface RegulatoryContext {
  rule_key: string
  rule_category: "applicability" | "materiality"
  plain_english: string
  status: "applied" | "unknown" | "informational"
  result: boolean | null
  missing_input: string | null
  threshold: number | null
  currency: string | null
  effective_from: string
  effective_to: string | null
  verification_status: string
  sources: RegulatorySourceRef[]
  overridden: boolean
  override_reason: string | null
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

// Structured "research result" shown above the Industry Analysis prose (contemporaneous, entity-specific).
export interface ResearchSource { label: string; url: string }
export interface ResearchSummary {
  industry: string
  market: string
  period: string
  key_trend: string
  key_risk: string
  competitors: string[]
  tested_party_impact: string
  sources: ResearchSource[]
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
  research?: ResearchSummary | null   // present on the Industry Analysis section; absent elsewhere
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
  risk_jurisdictions_restarted: string[]
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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchHealth(path: "/ready" | "/health/db" | "/health"): Promise<HealthResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}${path}`, { cache: "no-store", signal: controller.signal })
    const body = await parse<HealthResponse>(res)
    return { ...body, source: path.slice(1) as HealthResponse["source"] }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchCurrentHealth(): Promise<HealthResponse> {
  try {
    return await fetchHealth("/ready")
  } catch (error) {
    if (!isApiStatus(error, 404)) throw error
  }

  try {
    return await fetchHealth("/health/db")
  } catch (error) {
    if (!isApiStatus(error, 404)) throw error
  }

  const basic = await fetchHealth("/health")
  return { ...basic, db: undefined, source: "health" }
}

const realApi = {
  health: async (): Promise<HealthResponse> => {
    let lastError: unknown = null
    for (let attempt = 0; attempt < HEALTH_RETRY_DELAYS_MS.length; attempt += 1) {
      const delay = HEALTH_RETRY_DELAYS_MS[attempt]
      if (delay > 0) await sleep(delay)
      try {
        return await fetchCurrentHealth()
      } catch (error) {
        lastError = error
        console.warn("[veritax] health probe failed", {
          base: BASE,
          attempt: attempt + 1,
          attempts: HEALTH_RETRY_DELAYS_MS.length,
          retrying: attempt < HEALTH_RETRY_DELAYS_MS.length - 1,
          error: describeError(error),
        })
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Backend health probe failed")
  },

  createEngagement: (): Promise<{ id: string }> =>
    afetch(`${BASE}/engagements`, { method: "POST" }).then(r => parse<{ id: string }>(r)),

  // Public request-access (waitlist) submission from /signup. Returns an opaque internal id.
  submitWaitlist: (body: { name: string; country: string; email: string; company: string; lead_id?: string; attribution?: Record<string, string> }): Promise<{ waitlist_user_id: string }> =>
    afetch(`${BASE}/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => parse<{ waitlist_user_id: string }>(r)),

  listEngagements: (): Promise<EngagementSummary[]> =>
    afetch(`${BASE}/engagements`).then(r => parse<EngagementSummary[]>(r)),

  patchEngagement: (
    id: string,
    body: { entity_name?: string; jurisdictions?: string[]; fiscal_year?: string; website_url?: string; selected_source_kinds?: SourceKind[] },
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

  getDocumentFacts: (documentId: string): Promise<DocumentFactsResponse> =>
    afetch(`${BASE}/documents/${documentId}/facts`).then(r => parse<DocumentFactsResponse>(r)),

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

  getJurisdictions: (): Promise<string[]> =>
    afetch(`${BASE}/jurisdictions`).then(r => parse<string[]>(r)),

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
      { method: "POST", trace: "risks.start" },
    )
    if (res.status === 409) throw new DraftNotCompleteError("draft not complete")
    return parse<RiskResponse>(res)
  },

  getRisks: (engagementId: string, jurisdiction: string): Promise<RiskResponse> =>
    afetch(`${BASE}/engagements/${engagementId}/risks?jurisdiction=${encodeURIComponent(jurisdiction)}`, {
      trace: "risks.get",
    })
      .then(r => parse<RiskResponse>(r)),
}

// On the public /demo route, serve canned data from lib/demo-api instead of the network so the real
// app + step components run unchanged with nothing actually executing. Every other route is untouched.
export const api: typeof realApi = new Proxy(realApi, {
  get(target, prop, receiver) {
    if (inDemo()) {
      const override = (demoApi as Record<PropertyKey, unknown>)[prop]
      if (typeof override === "function") return override
    }
    return Reflect.get(target, prop, receiver)
  },
})
