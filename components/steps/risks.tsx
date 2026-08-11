"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, Loader2, Download, X, FileText } from "lucide-react"
import {
  api,
  DraftNotCompleteError,
  type DocumentTextRead,
  type FactRead,
  type RiskEvidence,
  type RiskResponse,
  type RiskFinding,
  type RiskSeverityValue,
} from "@/lib/api"
import { ActionModal } from "@/components/ui/action-modal"
import {
  diagnoseApiFailure,
  parseApiError,
  runWithRetry,
  withActions,
  type ActionableIssue,
  type ActionableIssueBase,
} from "@/lib/actionable-errors"
import {
  evidenceDocumentOpened, evidenceSourceViewed, evidenceFactInspected, documentType, documentCategory,
  risksViewed, riskOpened, riskEvidenceOpened, riskRecommendationOpened, riskProps,
  accessVeritaxCtaViewed, accessVeritaxClicked,
} from "@/lib/analytics"

// ── Original "Findings" appearance (grayscale), now driven by the real pipeline ──────────────
type Severity = RiskSeverityValue
const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const SEVERITY_STYLE: Record<Severity, { bg: string; color: string; border?: string }> = {
  critical: { bg: "#000", color: "#fff" },
  high:     { bg: "#3f3f3f", color: "#fff" },
  medium:   { bg: "#dcdcdc", color: "#000" },
  low:      { bg: "#f2f2f2", color: "#666", border: "1px solid #e5e5e5" },
}
const KIND_LABEL = { discrepancy: "Contradiction", exposure: "Exposure" } as const
type KindFilter = "all" | "exposure" | "discrepancy"

const fmt = (n: number) => n.toLocaleString("en-US")
const snippet = (text: string, needle: string) => {
  const hay = text.toLowerCase()
  const ndl = needle.toLowerCase().trim()
  const at = ndl ? hay.indexOf(ndl.slice(0, Math.min(ndl.length, 120))) : -1
  const start = at >= 0 ? Math.max(0, at - 800) : 0
  const end = at >= 0 ? Math.min(text.length, at + needle.length + 1400) : Math.min(text.length, 2200)
  return text.slice(start, end).trim()
}
const factLabel = (type: string) => type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
const factValue = (fact: FactRead) => {
  if (!fact.value_normalized || fact.value_normalized === fact.value_raw) return fact.value_raw
  return `${fact.value_raw} · ${fact.value_normalized}`
}
const scopeLabel = (scope: string) => scope.replace(/_/g, " ")

// ── Small presentational bits (ported from the original) ─────────────────────────────────────
function Chip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 500, whiteSpace: "nowrap", ...style }}>
      {children}
    </span>
  )
}
function OutlineChip({ children }: { children: React.ReactNode }) {
  return <Chip style={{ background: "#fff", color: "#555", border: "1px solid #e5e5e5" }}>{children}</Chip>
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: "#888", margin: "0 0 0.125rem" }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 600, color: "#000", margin: 0, fontVariant: "tabular-nums" }}>{value}</p>
    </div>
  )
}
const Divider = () => <div style={{ width: 1, height: 32, background: "#e5e5e5" }} />

const TH: React.CSSProperties = { textAlign: "left", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", padding: "0.5rem 0.75rem", borderBottom: "1px solid #e5e5e5", whiteSpace: "nowrap" }
const TD: React.CSSProperties = { padding: "0.625rem 0.75rem", borderBottom: "1px solid #f0f0f0", verticalAlign: "middle" }
const PILL = (active: boolean): React.CSSProperties => ({
  height: 28, padding: "0 0.75rem", borderRadius: 9999, cursor: "pointer",
  border: active ? "1px solid #000" : "1px solid #e5e5e5",
  background: active ? "#000" : "#fff", color: active ? "#fff" : "#555",
  fontSize: 12, fontWeight: 500,
})

const RISK_LOG_PREFIX = "[veritax:risks]"
const riskElapsedMs = (startedAt: number) => Math.round(performance.now() - startedAt)
const shortEngagement = (id: string | null) => id ? `${id.slice(0, 8)}...` : null
const riskSnapshot = (risk?: RiskResponse) => risk ? {
  status: risk.status,
  stale: risk.stale,
  findings: risk.findings.length,
  total: risk.summary.total,
} : { status: "none" }
const riskError = (error: unknown) => ({
  name: error instanceof Error ? error.name : "UnknownError",
  message: error instanceof Error ? error.message : String(error),
})
const logRisk = (event: string, details: Record<string, unknown>) => {
  console.info(RISK_LOG_PREFIX, event, details)
}

export default function RisksStep({ engagementId, jurisdictions, entity, onOpenDraft, onOpenPlanning, accessLive }: {
  engagementId: string | null
  jurisdictions: string[]
  entity: string
  onOpenDraft?: () => void
  onOpenPlanning?: () => void
  accessLive?: boolean
}) {
  // ── real pipeline wiring (unchanged) ──
  const [riskByJuris, setRiskByJuris] = useState<Record<string, RiskResponse>>({})
  const [started, setStarted] = useState<Set<string>>(new Set())
  const [notReady, setNotReady] = useState<Set<string>>(new Set())
  const [activeJurisdiction, setActive] = useState(jurisdictions[0] ?? "")
  const [issue, setIssue] = useState<ActionableIssue | null>(null)
  // ── view state (search + kind toggle + slide-in detail, from the original) ──
  const [search, setSearch] = useState("")
  const [view, setView] = useState<KindFilter>("all")
  const [openFinding, setOpenFinding] = useState<RiskFinding | null>(null)
  const [sourcePreview, setSourcePreview] = useState<{
    doc: DocumentTextRead
    evidence: RiskEvidence
    facts: FactRead[]
    highlightedFactId?: string
    highlightQuote?: string
  } | null>(null)
  const [sourceLoading, setSourceLoading] = useState<string | null>(null)
  const [copiedEvidence, setCopiedEvidence] = useState(false)

  const riskRef = useRef(riskByJuris); riskRef.current = riskByJuris
  const startedRef = useRef(started); startedRef.current = started
  const failureIssueKeyRef = useRef("")
  const notReadyIssueRef = useRef<Set<string>>(new Set())
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)   // risks_viewed visibility target
  const ctaRef = useRef<HTMLAnchorElement>(null) // access_veritax_cta_viewed visibility target

  const setRisk = (j: string, d: RiskResponse) => setRiskByJuris(prev => ({ ...prev, [j]: d }))
  const analyzing = (d?: RiskResponse) => d?.status === "pending" || d?.status === "analyzing"

  function openIssue(
    base: ActionableIssueBase,
    primaryAction: ActionableIssue["primaryAction"],
    secondaryAction?: ActionableIssue["secondaryAction"],
  ) {
    setIssue(withActions(base, primaryAction, secondaryAction))
  }

  async function openIssueFromError(
    error: unknown,
    operation: string,
    primaryAction: ActionableIssue["primaryAction"],
    secondaryAction?: ActionableIssue["secondaryAction"],
  ) {
    const base = await diagnoseApiFailure(error, { operation, engagementId, jurisdiction: activeJurisdiction })
    openIssue(base, primaryAction, secondaryAction)
  }

  const poll = useCallback(async () => {
    const startedAt = performance.now()
    pollRef.current = null
    if (!engagementId) return
    const js = [...startedRef.current].filter(j => !notReady.has(j))
    logRisk("poll:start", {
      engagementId: shortEngagement(engagementId),
      jurisdictions: js,
      notReady: [...notReady],
    })
    const results = await Promise.all(js.map(async j => {
      const getStartedAt = performance.now()
      try {
        const d = await runWithRetry(() => api.getRisks(engagementId, j), { retries: 1 })
        logRisk("poll:get:ok", {
          engagementId: shortEngagement(engagementId),
          jurisdiction: j,
          durationMs: riskElapsedMs(getStartedAt),
          ...riskSnapshot(d),
        })
        return [j, d] as const
      }
      catch (e) {
        console.error("[veritax:risks] poll:get:failed", {
          engagementId: shortEngagement(engagementId),
          jurisdiction: j,
          durationMs: riskElapsedMs(getStartedAt),
          error: riskError(e),
        })
        if (!riskRef.current[j]) {
          void openIssueFromError(e, "poll risk review", { label: "Retry risk review", onClick: () => retry(j) })
        }
        return [j, riskRef.current[j]] as const
      }
    }))
    const merged: Record<string, RiskResponse> = {}
    for (const [j, d] of results) if (d) merged[j] = d
    setRiskByJuris(prev => ({ ...prev, ...merged }))
    const shouldContinue = Object.values(merged).some(analyzing)
    logRisk("poll:complete", {
      engagementId: shortEngagement(engagementId),
      durationMs: riskElapsedMs(startedAt),
      statuses: Object.fromEntries(Object.entries(merged).map(([j, d]) => [j, d.status])),
      continuing: shouldContinue,
    })
    if (shouldContinue) pollRef.current = setTimeout(poll, 1800)
  }, [engagementId, notReady])

  const startJurisdiction = useCallback(async (j: string) => {
    if (!engagementId || !j) {
      logRisk("start:skipped", { reason: "missing engagement or jurisdiction", engagementId: shortEngagement(engagementId), jurisdiction: j })
      return
    }
    if (startedRef.current.has(j)) {
      logRisk("start:skipped", { reason: "already started", engagementId: shortEngagement(engagementId), jurisdiction: j, ...riskSnapshot(riskRef.current[j]) })
      return
    }
    const startedAt = performance.now()
    logRisk("start:begin", { engagementId: shortEngagement(engagementId), jurisdiction: j })
    setStarted(prev => new Set(prev).add(j))
    startedRef.current = new Set(startedRef.current).add(j)
    try {
      const d = await runWithRetry(
        () => api.startRisks(engagementId, j),
        { retries: 2, recover: () => api.recoverPipeline(engagementId, true) },
      )
      logRisk("start:ok", {
        engagementId: shortEngagement(engagementId),
        jurisdiction: j,
        durationMs: riskElapsedMs(startedAt),
        ...riskSnapshot(d),
      })
      setRisk(j, d)
      if (analyzing(d) && !pollRef.current) pollRef.current = setTimeout(poll, 1200)
    } catch (e) {
      if (e instanceof DraftNotCompleteError) {
        logRisk("start:not-ready", {
          engagementId: shortEngagement(engagementId),
          jurisdiction: j,
          durationMs: riskElapsedMs(startedAt),
        })
        setNotReady(prev => new Set(prev).add(j))
        if (!notReadyIssueRef.current.has(j)) {
          notReadyIssueRef.current.add(j)
          openIssue(
            {
              title: "Finish Draft before Risks",
              message: `Risks run on the completed ${j} draft.`,
              detail: "Complete Draft, then come back and check again.",
              tone: "caution",
              diagnostics: { operation: "start risks", engagementId, jurisdiction: j, blocker: "draft_not_complete" },
            },
            { label: "Go to Draft", onClick: () => onOpenDraft?.() },
            { label: "Check again", onClick: () => retry(j), variant: "ghost" },
          )
        }
      } else {
        console.error("[veritax:risks] start:failed", {
          engagementId: shortEngagement(engagementId),
          jurisdiction: j,
          durationMs: riskElapsedMs(startedAt),
          error: riskError(e),
        })
        void openIssueFromError(
          e,
          "start risk review",
          { label: "Retry risk review", onClick: () => retry(j) },
          { label: "Go to Draft", onClick: () => onOpenDraft?.(), variant: "ghost" },
        )
      }
    }
  }, [engagementId, poll])

  useEffect(() => {
    if (!engagementId || jurisdictions.length === 0) return
    setActive(prev => (jurisdictions.includes(prev) ? prev : jurisdictions[0]))
    startJurisdiction(jurisdictions[0])
    return () => { if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null } }
  }, [engagementId, jurisdictions, startJurisdiction])

  // risks_viewed once per run when the Risks screen is actually on-screen (not merely mounted) (PRD §13, §34).
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) risksViewed()
    }, { threshold: 0.25 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // access_veritax_cta_viewed only when the CTA is >=50% visible — never on mount / below the fold (PRD §14, §35).
  useEffect(() => {
    if (!accessLive) return
    const el = ctaRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting && e.intersectionRatio >= 0.5)) accessVeritaxCtaViewed()
    }, { threshold: [0.5] })
    observer.observe(el)
    return () => observer.disconnect()
  }, [accessLive])

  function selectJurisdiction(j: string) {
    logRisk("jurisdiction:selected", {
      engagementId: shortEngagement(engagementId),
      jurisdiction: j,
      cached: Boolean(riskRef.current[j]),
      started: startedRef.current.has(j),
    })
    setActive(j)
    setOpenFinding(null)
    setSourcePreview(null)
    startJurisdiction(j)
  }

  function retry(j: string) {
    logRisk("retry:begin", { engagementId: shortEngagement(engagementId), jurisdiction: j })
    notReadyIssueRef.current.delete(j)
    setNotReady(prev => { const n = new Set(prev); n.delete(j); return n })
    setStarted(prev => { const n = new Set(prev); n.delete(j); return n })
    startedRef.current = new Set([...startedRef.current].filter(x => x !== j))
    startJurisdiction(j)
  }

  const risk = riskByJuris[activeJurisdiction] ?? null
  const findings = risk?.findings ?? []

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return findings
      .filter(f => view === "all" || f.kind === view)
      .filter(f => !q || `${f.title} ${f.description} ${KIND_LABEL[f.kind]}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  }, [findings, view, search])

  const exposureCount = findings.filter(f => f.kind === "exposure").length
  const contradictionCount = findings.filter(f => f.kind === "discrepancy").length
  const needAttention = findings.filter(f => f.severity === "critical" || f.severity === "high").length

  useEffect(() => {
    if (risk?.status !== "failed") return
    const key = `${engagementId}:${activeJurisdiction}:${risk.error ?? "failed"}`
    if (failureIssueKeyRef.current === key) return
    failureIssueKeyRef.current = key
    openIssue(
      {
        title: "Risk review failed",
        message: "Veritax could not finish the risk analysis for this draft.",
        detail: risk.error || "Retry the risk review. If it repeats, copy diagnostics for backend logs.",
        tone: "caution",
        diagnostics: { operation: "risk review failed", engagementId, jurisdiction: activeJurisdiction, error: risk.error },
      },
      { label: "Retry risk review", onClick: () => retry(activeJurisdiction) },
      { label: "Go to Draft", onClick: () => onOpenDraft?.(), variant: "ghost" },
    )
  }, [activeJurisdiction, engagementId, onOpenDraft, risk])

  function exportRegister() {
    const title = `${entity || "Entity"} — ${activeJurisdiction} · Risk Register`
    const body = findings.map(f => {
      const ev = f.evidence.map(e => `<li><em>${e.kind}</em> — ${e.reference}: ${e.detail}</li>`).join("")
      const rec = f.recommendations.map(r => `<li>${r}</li>`).join("")
      return `<div class="f"><h3>[${f.severity.toUpperCase()} · ${KIND_LABEL[f.kind]}] ${f.title}</h3>` +
        `<p>${f.description}</p>` +
        `<p><strong>Exposure:</strong> ${f.exposure_label ?? "—"}${f.exposure_estimated ? " <em>(estimated)</em>" : ""} · <strong>Confidence:</strong> ${f.confidence}</p>` +
        `<p><strong>Evidence</strong></p><ul>${ev}</ul>` +
        `<p><strong>Options</strong></p><ul>${rec}</ul></div>`
    }).join("\n")
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
      `<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:2.5rem auto;padding:0 1.25rem;line-height:1.6;color:#111}h1{font-size:1.6rem}.f{border-top:1px solid #ddd;padding-top:1rem;margin-top:1rem}h3{font-size:1.05rem}em{color:#666}</style></head>` +
      `<body><h1>${title}</h1><p><em>Exposure figures are flagged estimates, not computed.</em></p>${body}</body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function openSource(evidence: RiskEvidence) {
    setCopiedEvidence(false)
    if (openFinding) riskEvidenceOpened({ ...riskProps(openFinding), evidence_type: documentCategory(evidence.kind) })
    if (!evidence.document_id) {
      logRisk("source:copy-only", { reference: evidence.reference, kind: evidence.kind })
      evidenceSourceViewed({ document_type: documentType(evidence.source_label), locator_type: documentCategory(evidence.kind) })
      await navigator.clipboard?.writeText(evidence.detail).catch(() => undefined)
      setCopiedEvidence(true)
      setTimeout(() => setCopiedEvidence(false), 1200)
      return
    }
    const startedAt = performance.now()
    logRisk("source:open:begin", {
      documentId: `${evidence.document_id.slice(0, 8)}...`,
      reference: evidence.reference,
      kind: evidence.kind,
    })
    setSourceLoading(evidence.document_id)
    try {
      const [doc, factsPayload] = await Promise.all([
        runWithRetry(() => api.getDocumentText(evidence.document_id!), { retries: 1 }),
        runWithRetry(() => api.getDocumentFacts(evidence.document_id!), { retries: 1 }).catch(error => {
          console.warn("[veritax:risks] source:facts:failed", {
            documentId: `${evidence.document_id!.slice(0, 8)}...`,
            error: riskError(error),
          })
          return { document_id: evidence.document_id!, facts: [] }
        }),
      ])
      logRisk("source:open:ok", {
        documentId: `${evidence.document_id.slice(0, 8)}...`,
        durationMs: riskElapsedMs(startedAt),
        status: doc.status,
        textChars: doc.text.length,
        facts: factsPayload.facts.length,
      })
      setSourcePreview({ doc, evidence, facts: factsPayload.facts, highlightQuote: evidence.detail })
      evidenceDocumentOpened({ document_id: evidence.document_id, document_type: documentType(evidence.source_label), document_category: documentCategory(evidence.kind) })
      evidenceSourceViewed({ document_type: documentType(evidence.source_label), locator_type: documentCategory(evidence.kind) })
    } catch (e) {
      console.error("[veritax:risks] source:open:failed", {
        documentId: `${evidence.document_id.slice(0, 8)}...`,
        durationMs: riskElapsedMs(startedAt),
        error: riskError(e),
      })
      const status = parseApiError(e).status
      if (status === 409) {
        openIssue(
          {
            title: "Source is still indexing",
            message: "The document exists, but its text is not ready for preview yet.",
            detail: "Retry opening the source. If it repeats, go to Planning and retry indexing the file.",
            tone: "caution",
            diagnostics: { operation: "open risk source", status, documentId: evidence.document_id, reference: evidence.reference },
          },
          { label: "Retry opening source", onClick: () => void openSource(evidence) },
          { label: "Go to Planning", onClick: () => onOpenPlanning?.(), variant: "ghost" },
        )
      } else if (status === 404) {
        openIssue(
          {
            title: "Source pointer is stale",
            message: "The risk finding points to a document the backend cannot find.",
            detail: "Refresh findings or return to Planning to confirm the file is still attached.",
            tone: "caution",
            diagnostics: { operation: "open risk source", status, documentId: evidence.document_id, reference: evidence.reference },
          },
          { label: "Refresh findings", onClick: () => retry(activeJurisdiction) },
          { label: "Go to Planning", onClick: () => onOpenPlanning?.(), variant: "ghost" },
        )
      } else {
        void openIssueFromError(e, "open risk source", { label: "Retry opening source", onClick: () => void openSource(evidence) })
      }
    } finally {
      setSourceLoading(null)
    }
  }

  function selectSourceFact(fact: FactRead) {
    const quote = fact.sources[0]?.quote
    if (!sourcePreview || !quote) return
    evidenceFactInspected({ fact_type: fact.fact_type, scope_level: fact.scope_level, document_type: documentType(sourcePreview.doc.original_filename) })
    setSourcePreview({ ...sourcePreview, highlightedFactId: fact.id, highlightQuote: quote })
  }

  if (!engagementId) return <main style={{ flex: 1, padding: "3rem 3rem", color: "#888" }}>Preparing session…</main>
  if (jurisdictions.length === 0) return <main style={{ flex: 1, padding: "3rem 3rem", color: "#888" }}>Select a jurisdiction in Planning first.</main>

  const hasFindings = risk?.status !== "failed" && !analyzing(risk) && findings.length > 0

  return (
    <div ref={rootRef} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Jurisdiction tabs (grayscale pills) */}
      <div style={{ background: "#fff", padding: "1rem 3rem 0.75rem", display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
        {jurisdictions.map(j => {
          const isActive = j === activeJurisdiction
          const isStarted = started.has(j)
          const processing = isStarted && analyzing(riskByJuris[j])
          return (
            <button key={j} type="button" onClick={() => selectJurisdiction(j)}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", ...PILL(isActive), opacity: isStarted ? 1 : 0.6 }}>
              {processing && <Loader2 size={11} className="animate-spin" />}
              {j}
            </button>
          )
        })}
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "2rem 3rem", overflowY: "auto" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: "#000", margin: 0 }}>Risks</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
              {hasFindings && (
                <button type="button" onClick={exportRegister} style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", height: 30, padding: "0 0.75rem", borderRadius: 6, border: "1px solid #e5e5e5", background: "#fff", color: "#000", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                  <Download size={14} /> Export register
                </button>
              )}
              {accessLive && (
                <a ref={ctaRef} href="/signup" onClick={() => accessVeritaxClicked()} style={{ display: "inline-flex", alignItems: "center", height: 30, padding: "0 0.875rem", borderRadius: 6, border: "none", background: "#000", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" }}>
                  Access Veritax Live
                </a>
              )}
            </div>
          </div>
          {risk?.analysis_mode === "fake" && (
            <p style={{ fontSize: 12, color: "#8a5a00", background: "#fff8e5", border: "1px solid #f0d58c", borderRadius: 6, padding: "0.625rem 0.75rem", margin: "0 0 0.875rem" }}>
              Development mode: these findings are generated by the fake analyzer, not a real model.
            </p>
          )}
          {risk?.stale && (
            <p style={{ fontSize: 12, color: "#555", background: "#fafafa", border: "1px solid #e5e5e5", borderRadius: 6, padding: "0.625rem 0.75rem", margin: "0 0 0.875rem" }}>
              The draft changed after this run.{" "}
              <button type="button" onClick={() => retry(activeJurisdiction)} style={{ border: "none", background: "transparent", padding: 0, color: "#000", textDecoration: "underline", textUnderlineOffset: 2, cursor: "pointer", fontSize: 12 }}>
                Refresh the risk review
              </button>
              {" "}to replace stale findings.
            </p>
          )}

          {notReady.has(activeJurisdiction) ? (
            <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: "1.5rem", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#555", margin: "0 0 0.75rem" }}>
                Risks run on the finished file. Complete the <strong>Draft</strong> for {activeJurisdiction} first, then check here.
              </p>
              <button type="button" onClick={() => retry(activeJurisdiction)} style={{ height: 28, padding: "0 0.75rem", borderRadius: 6, border: "1px solid #e5e5e5", background: "#fff", color: "#555", fontSize: 12, cursor: "pointer" }}>Check again</button>
            </div>
          ) : analyzing(risk) || !risk ? (
            <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 13, color: "#888" }}>
              <Loader2 size={14} className="animate-spin" /> Analysing the {activeJurisdiction} file for risk…
            </p>
          ) : risk?.status === "failed" ? (
            <p style={{ fontSize: 13, color: "#888" }}>Risk review paused. Use the recovery dialog to retry.</p>
          ) : findings.length === 0 ? (
            <p style={{ fontSize: 13, color: "#888" }}>No risks surfaced for this file.</p>
          ) : (
            <>
              {/* Search + kind toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.875rem" }}>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search findings…"
                  style={{ height: 28, width: 240, padding: "0 0.75rem", borderRadius: 9999, border: "1px solid #e5e5e5", background: "#fff", color: "#000", fontSize: 12, outline: "none" }} />
                {([["all", "All"], ["exposure", "Exposure"], ["discrepancy", "Contradictions"]] as const).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setView(id)} style={PILL(view === id)}>{label}</button>
                ))}
              </div>

              {/* Rollup header */}
              <div data-tour="risks-rollup" style={{ display: "flex", alignItems: "center", gap: "1.5rem", border: "1px solid #e5e5e5", borderRadius: 8, padding: "0.875rem 1.25rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                <Stat label="Findings" value={findings.length} />
                <Divider />
                <Stat label="Exposure" value={exposureCount} />
                <Divider />
                <Stat label="Contradictions" value={contradictionCount} />
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <p style={{ fontSize: 11, color: "#888", margin: "0 0 0.125rem" }}>Need attention</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: "#000", margin: 0 }}>{needAttention}</p>
                </div>
              </div>

              <p style={{ fontSize: 11, color: "#aaa", margin: "0 0 0.75rem" }}>
                Exposure figures are flagged estimates, not computed — verify against the record before acting.
              </p>

              {/* Table */}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={TH}>Severity</th>
                    <th style={TH}>Kind</th>
                    <th style={TH}>Title</th>
                    <th style={TH}>Exposure</th>
                    <th style={TH}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(f => (
                    <tr key={f.id} style={{ cursor: "pointer", background: openFinding?.id === f.id ? "#f2f2f2" : "transparent" }}
                      onClick={() => {
                        riskOpened(riskProps(f))
                        if (f.recommendations.length > 0) riskRecommendationOpened(riskProps(f))
                        setOpenFinding(f); setSourcePreview(null)
                      }}
                      onMouseEnter={e => { if (openFinding?.id !== f.id) e.currentTarget.style.background = "#fafafa" }}
                      onMouseLeave={e => { if (openFinding?.id !== f.id) e.currentTarget.style.background = "transparent" }}>
                      <td style={TD}><Chip style={{ ...SEVERITY_STYLE[f.severity], textTransform: "capitalize", fontWeight: 600 }}>{f.severity}</Chip></td>
                      <td style={TD}><OutlineChip>{KIND_LABEL[f.kind]}</OutlineChip></td>
                      <td style={{ ...TD, fontSize: 13, fontWeight: 500, color: "#000", maxWidth: 360 }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</span>
                      </td>
                      <td style={{ ...TD, fontSize: 12, color: "#555", maxWidth: 220 }}>
                        {f.exposure_amount != null ? (
                          <span style={{ fontVariant: "tabular-nums", color: "#000" }}>{fmt(f.exposure_amount)} <span style={{ color: "#aaa", fontSize: 11 }}>{f.exposure_currency}</span></span>
                        ) : (
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {f.exposure_label || "—"}{f.exposure_estimated && f.exposure_label ? " (est.)" : ""}
                          </span>
                        )}
                      </td>
                      <td style={{ ...TD, fontSize: 12, color: "#888", textTransform: "capitalize" }}>{f.confidence}</td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: "3rem", textAlign: "center", fontSize: 13, color: "#888" }}>No findings match the current view.</td></tr>
                  )}
                </tbody>
              </table>
            </>
          )}
        </main>

        {/* Detail panel — slides in on row click */}
        {openFinding && (
          <aside style={{ width: 380, flexShrink: 0, borderLeft: "1px solid #e5e5e5", background: "#fff", display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", borderBottom: "1px solid #e5e5e5", padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
                <Chip style={{ ...SEVERITY_STYLE[openFinding.severity], textTransform: "capitalize", fontWeight: 600 }}>{openFinding.severity}</Chip>
                <OutlineChip>{KIND_LABEL[openFinding.kind]}</OutlineChip>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpenFinding(null)} style={{ display: "inline-flex", padding: 6, border: "none", background: "transparent", cursor: "pointer", color: "#888" }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "#000", margin: "0 0 0.5rem" }}>{openFinding.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: "#666", margin: 0 }}>{openFinding.description}</p>
              </div>

              <div style={{ height: 1, background: "#e5e5e5" }} />

              {/* Exposure card */}
              <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: 0 }}>Exposure</p>
                {openFinding.exposure_amount != null ? (
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                    <span style={{ fontSize: 24, fontWeight: 600, color: "#000", fontVariant: "tabular-nums" }}>{fmt(openFinding.exposure_amount)}</span>
                    <span style={{ fontSize: 13, color: "#888" }}>{openFinding.exposure_currency}</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: "#000" }}>{openFinding.exposure_label || "—"}</span>
                    {openFinding.exposure_estimated && (
                      <Chip style={{ background: "#dcdcdc", color: "#000", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Estimated</Chip>
                    )}
                  </div>
                )}
                <p style={{ fontSize: 11, color: "#aaa", margin: 0, textTransform: "capitalize" }}>{openFinding.confidence} confidence</p>
                <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>Flagged estimate — verify against the record, not computed.</p>
              </div>

              <div style={{ height: 1, background: "#e5e5e5" }} />

              {/* Evidence (real provenance) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: "0 0 0.25rem" }}>Evidence ({openFinding.evidence.length})</p>
                {openFinding.evidence.map((e, i) => (
                  <div key={i} style={{ border: "1px solid #e5e5e5", background: "#fafafa", borderRadius: 6, padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "#000", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <span style={{ color: "#aaa", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.04em", marginRight: 6 }}>{e.kind}</span>{e.reference}
                      </span>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                        <Chip style={{ background: e.verified ? "#ecfdf3" : "#fff8e5", color: e.verified ? "#027a48" : "#8a5a00", border: "1px solid #e5e5e5", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {e.verified ? <Check size={10} /> : null}{e.verified ? "Verified" : "Needs check"}
                        </Chip>
                        <button type="button" onClick={() => openSource(e)} disabled={!!e.document_id && sourceLoading === e.document_id} style={{
                          display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid #e5e5e5", borderRadius: 9999,
                          background: "#fff", color: "#555", padding: "2px 8px", fontSize: 11, cursor: "pointer",
                        }}>
                          {e.document_id && sourceLoading === e.document_id ? <Loader2 size={10} className="animate-spin" /> : e.document_id ? <FileText size={10} /> : <Copy size={10} />}
                          {e.document_id ? "Open" : copiedEvidence ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                    {e.source_label && <p style={{ fontSize: 11, color: "#aaa", margin: 0 }}>{e.source_label}</p>}
                    <p style={{ fontSize: 12, fontStyle: "italic", color: "#888", margin: 0, lineHeight: 1.5 }}>&ldquo;{e.detail}&rdquo;</p>
                  </div>
                ))}
                {openFinding.evidence.length === 0 && <p style={{ fontSize: 12, color: "#aaa", margin: 0 }}>No evidence pointers recorded.</p>}
                {sourcePreview && (
                  <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, background: "#fff", padding: "0.875rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: 0 }}>Source preview</p>
                    <p style={{ fontSize: 12, color: "#000", margin: 0 }}>{sourcePreview.doc.original_filename}</p>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto", fontSize: 11, lineHeight: 1.55, color: "#555", background: "#fafafa", borderRadius: 6, padding: "0.75rem" }}>
                      {snippet(sourcePreview.doc.text, sourcePreview.highlightQuote ?? sourcePreview.evidence.detail)}
                    </pre>
                    {sourcePreview.facts.length > 0 && (
                      <div style={{ borderTop: "1px solid #eee", paddingTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: 0 }}>Extracted facts</p>
                        {sourcePreview.facts.map(fact => {
                          const source = fact.sources[0]
                          const active = sourcePreview.highlightedFactId === fact.id
                          return (
                            <button key={fact.id} type="button" onClick={() => selectSourceFact(fact)} style={{
                              display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0.25rem",
                              textAlign: "left", border: active ? "1px solid #cfcfcf" : "1px solid #eee",
                              borderRadius: 6, background: active ? "#f7f7f7" : "#fff", padding: "0.625rem",
                              cursor: source?.quote ? "pointer" : "default",
                            }}>
                              <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem" }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#000" }}>{factLabel(fact.fact_type)}</span>
                                <span style={{ fontSize: 11, color: "#888", textTransform: "capitalize" }}>{scopeLabel(fact.scope_level)}</span>
                              </span>
                              <span style={{ fontSize: 12, color: "#555", lineHeight: 1.45 }}>{factValue(fact)}</span>
                              {fact.entity_mention?.canonical_entity_name && (
                                <span style={{ fontSize: 11, color: "#777" }}>Entity: {fact.entity_mention.canonical_entity_name}</span>
                              )}
                              {source && (
                                <>
                                  <span style={{ fontSize: 11, color: "#999" }}>{source.locator}</span>
                                  <span style={{ fontSize: 11, color: "#777", lineHeight: 1.45 }}>&ldquo;{source.quote}&rdquo;</span>
                                </>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: "#e5e5e5" }} />

              {/* Options (recommendations) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "#888", margin: "0 0 0.25rem" }}>Your options</p>
                <ul style={{ margin: 0, padding: "0 0 0 1rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {openFinding.recommendations.map((r, i) => (
                    <li key={i} style={{ fontSize: 13, color: "#555", lineHeight: 1.55 }}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        )}
      </div>
      <ActionModal issue={issue} onClose={() => setIssue(null)} />
    </div>
  )
}
