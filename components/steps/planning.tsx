"use client"

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Check, ChevronDown, Globe, Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { api, type DocumentRead } from "@/lib/api"
import { Animate } from "@/components/ui/transition"
import { ActionModal } from "@/components/ui/action-modal"
import {
  diagnoseApiFailure,
  parseApiError,
  runWithRetry,
  withActions,
  type ActionableIssue,
  type ActionableIssueBase,
} from "@/lib/actionable-errors"

export type SourceId = "financials" | "agreements" | "public" | "interview"
export type PlanningDocumentMap = Partial<Record<SourceId, DocumentRead[]>>
export type PlanningSourceRow = {
  id: string
  kind: SourceId
  origin: string
  connector_provider: string | null
  url: string | null
}

// Provides the persisted engagement id to nested source inputs (upload zones, connector grid).
const PlanningCtx = createContext<{
  engagementId: string | null
  documentsByKind: PlanningDocumentMap
  updateDocuments: (kind: SourceId, updater: (docs: DocumentRead[]) => DocumentRead[]) => void
  sourceRows: PlanningSourceRow[]
  rememberSourceRow: (source: PlanningSourceRow) => void
  selectedSources: Set<SourceId>
  websiteUrl: string
  onWebsiteUrlChange: (url: string) => void
  persistSelectedSources: (next: Set<SourceId>, nextWebsiteUrl?: string) => void
  showIssue: (base: ActionableIssueBase, primaryAction: ActionableIssue["primaryAction"], secondaryAction?: ActionableIssue["secondaryAction"]) => void
}>({
  engagementId: null,
  documentsByKind: {},
  updateDocuments: () => {},
  sourceRows: [],
  rememberSourceRow: () => {},
  selectedSources: new Set(),
  websiteUrl: "",
  onWebsiteUrlChange: () => {},
  persistSelectedSources: () => {},
  showIssue: () => {},
})

// ─── Constants ────────────────────────────────────────────────────────────────

// Fetched from GET /jurisdictions (single source of truth: jurisdiction_requirements.json).
// This static list is only a fallback if the backend is unreachable.
const JURISDICTIONS_FALLBACK = [
  "Australia", "Canada", "France", "Germany",
  "Ireland", "Netherlands", "United Kingdom", "United States",
]

const FIELD_LABEL: CSSProperties = {
  display: "block", fontSize: "var(--font-text-xs-size)",
  fontWeight: "var(--font-weight-medium)", color: "var(--color-text-tertiary)",
  marginBottom: "0.375rem", letterSpacing: "0.04em", textTransform: "uppercase",
}

const OUTLINE_INPUT: CSSProperties = {
  height: "var(--control-size-sm)", padding: "0 var(--control-gutter-sm)",
  borderRadius: "var(--control-radius-md)", border: "1px solid var(--input-outline-border-color)",
  background: "transparent", fontSize: "var(--control-font-size-md)",
  color: "var(--color-text)", width: "100%", outline: "none",
  boxSizing: "border-box" as const, transition: "border-color var(--transition-duration-basic)",
}

// ─── MultiSelect ──────────────────────────────────────────────────────────────

function MultiSelect({ options, value, onChange, placeholder }: {
  options: string[]; value: string[]
  onChange: (v: string[]) => void; placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  const label = value.length === 0 ? null : value.length === 1 ? value[0] : `${value.length} jurisdictions`
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        ...OUTLINE_INPUT, display: "flex", alignItems: "center", justifyContent: "space-between",
        color: label ? "var(--color-text)" : "var(--input-placeholder-text-color)",
        cursor: "pointer", textAlign: "left",
        borderColor: open ? "var(--input-outline-border-color-focus)" : undefined,
      }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label ?? placeholder}</span>
        <ChevronDown size={14} style={{ color: "var(--color-text-tertiary)", flexShrink: 0, marginLeft: "0.5rem" }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-300)",
          padding: "0.25rem", zIndex: 50, maxHeight: 220, overflowY: "auto",
        }}>
          {options.map(opt => (
            <label key={opt} className="hover:bg-[var(--color-background-primary-ghost-hover)]" style={{
              display: "flex", alignItems: "center", gap: "0.625rem",
              padding: "0.375rem 0.5rem", borderRadius: "var(--radius-sm)",
              cursor: "pointer", fontSize: "var(--font-text-sm-size)", color: "var(--color-text)", userSelect: "none",
            }}>
              <input type="checkbox" checked={value.includes(opt)} onChange={() => toggle(opt)}
                style={{ accentColor: "var(--color-background-primary-solid)", flexShrink: 0 }} />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── UploadZone ───────────────────────────────────────────────────────────────

// The api client throws `API <status> <url>: <body>`; pull the server's detail message for the chip.
function uploadErrorMessage(err: unknown): string {
  const parsed = parseApiError(err)
  return parsed.detail ?? parsed.message
}

// uploading → sent, awaiting response; processing → backend embedding; done → embedded; error → rejected/failed
type UploadStatus = "uploading" | "processing" | "done" | "error"
interface UploadItem { id: string; documentId?: string; name: string; status: UploadStatus; error?: string }

// Backend DocumentStatus → chip status. Poll until it settles (embedded/failed).
const DOC_STATUS: Record<string, UploadStatus> = {
  uploaded: "processing", embedding: "processing", embedded: "done", failed: "error",
}
const STATUS_LABEL: Record<UploadStatus, string> = {
  uploading: "Uploading…", processing: "Processing…", done: "Processed", error: "Failed",
}

const EMPTY_DOCUMENTS: DocumentRead[] = []

const uploadItemFromDocument = (doc: DocumentRead): UploadItem => ({
  id: doc.id,
  documentId: doc.id,
  name: doc.original_filename,
  status: DOC_STATUS[doc.status] ?? "processing",
  error: doc.error ?? undefined,
})

function UploadZone({ kind, accept = "*", hint }: { kind: SourceId; accept?: string; hint?: string }) {
  const { engagementId, documentsByKind, updateDocuments, showIssue } = useContext(PlanningCtx)
  const documents = documentsByKind[kind] ?? EMPTY_DOCUMENTS
  const [dragging, setDragging] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(0)
  const pollingDocIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!engagementId) {
      setItems([])
      return
    }
    const entries = documents.map(uploadItemFromDocument)
    setItems(entries)
    entries.forEach(entry => {
      if (entry.documentId && entry.status === "processing") void pollDoc(entry.documentId)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId, kind, documents])

  // Poll one document's processing status until it settles, then reflect it on its chip.
  // Ceiling is generous — extracting + embedding a large PDF can take a few minutes.
  async function pollDoc(documentId: string) {
    if (pollingDocIds.current.has(documentId)) return
    pollingDocIds.current.add(documentId)
    try {
      for (let i = 0; i < 160; i++) {
        await new Promise(r => setTimeout(r, 1500))
        try {
          const doc = await api.getDocument(documentId)
          const status = DOC_STATUS[doc.status] ?? "processing"
          setItems(p => p.map(x => (x.documentId === documentId ? { ...x, status, error: doc.error ?? undefined } : x)))
          updateDocuments(kind, docs => docs.map(existing => (existing.id === documentId ? doc : existing)))
          if (status === "done" || status === "error") return
        } catch (err) {
          return
        }
      }
    } finally {
      pollingDocIds.current.delete(documentId)
    }
  }

  async function addFiles(list: FileList | null) {
    await uploadFiles(Array.from(list ?? []))
  }

  async function uploadFiles(arr: File[]) {
    if (!arr.length) return
    const entries: UploadItem[] = arr.map(f => ({ id: `local-${nextId.current++}`, name: f.name, status: "uploading" }))
    setItems(p => [...p, ...entries])
    const ids = new Set(entries.map(e => e.id))
    const markAll = (status: UploadStatus, error?: string) =>
      setItems(p => p.map(x => (ids.has(x.id) ? { ...x, status, error } : x)))

    if (!engagementId) {
      // No backend session yet — keep the local chip UX so the user isn't blocked.
      markAll("done")
      return
    }
    try {
      const docs = await runWithRetry(
        () => api.uploadDocuments(engagementId, kind, arr),
        { retries: 2, recover: () => api.recoverPipeline(engagementId, true) },
      )
      // Backend returns documents in file order — correlate each chip to its doc and poll.
      updateDocuments(kind, existing => [...existing, ...docs])
      setItems(p => p.map(x => {
        const idx = entries.findIndex(e => e.id === x.id)
        return idx >= 0 && docs[idx] ? uploadItemFromDocument(docs[idx]) : x
      }))
      docs.forEach(doc => { if ((DOC_STATUS[doc.status] ?? "processing") === "processing") void pollDoc(doc.id) })
    } catch (err) {
      console.error("[veritax] upload failed:", err)
      markAll("error", uploadErrorMessage(err))
      const base = await diagnoseApiFailure(err, { operation: "upload documents", engagementId })
      const status = parseApiError(err).status
      showIssue(
        status === 413
          ? {
              ...base,
              title: "Upload a smaller file",
              message: "The backend rejected this upload because at least one file is too large.",
              detail: "Split the source or upload a smaller version, then try again.",
              tone: "caution",
            }
          : base,
        { label: status === 413 ? "Choose file" : "Try upload again", onClick: () => status === 413 ? inputRef.current?.click() : void uploadFiles(arr) },
        { label: "Cancel", onClick: () => {}, variant: "ghost" },
      )
    }
  }

  const removeFile = (item: UploadItem) => {
    setItems(p => p.filter(x => x.id !== item.id))
    if (item.documentId) {
      const removedDoc = documents.find(doc => doc.id === item.documentId)
      updateDocuments(kind, docs => docs.filter(doc => doc.id !== item.documentId))
      api.deleteDocument(item.documentId).catch(err => {
        console.error("[veritax] delete document failed:", err)
        setItems(p => [...p, item])
        if (removedDoc) updateDocuments(kind, docs => docs.some(doc => doc.id === removedDoc.id) ? docs : [...docs, removedDoc])
      })
    }
  }

  const retryFile = async (item: UploadItem) => {
    if (!engagementId || !item.documentId) return
    setItems(p => p.map(x => (x.id === item.id ? { ...x, status: "processing", error: undefined } : x)))
    try {
      await runWithRetry(() => api.recoverPipeline(engagementId, true), { retries: 2 })
      void pollDoc(item.documentId)
    } catch (err) {
      console.error("[veritax] retry document failed:", err)
      setItems(p => p.map(x => (x.id === item.id ? { ...x, status: "error", error: uploadErrorMessage(err) } : x)))
      const base = await diagnoseApiFailure(err, { operation: "retry document indexing", engagementId })
      showIssue(
        base,
        { label: "Retry indexing", onClick: () => void retryFile(item) },
        { label: "Remove file", onClick: () => removeFile(item), variant: "ghost" },
      )
    }
  }

  function openFailedFile(item: UploadItem) {
    const ocrNeeded = /no extractable text|ocr|locked|encrypted/i.test(item.error ?? "")
    showIssue(
      {
        title: ocrNeeded ? "Upload an OCR'd copy" : "This document did not index",
        message: ocrNeeded
          ? "The backend could not extract readable text from this file."
          : "Veritax needs the document indexed before Requirements can use it.",
        detail: item.error || "Retry indexing, remove it, or upload a replacement.",
        tone: "caution",
        diagnostics: {
          operation: "document indexing",
          engagementId,
          documentId: item.documentId ?? null,
          fileName: item.name,
          error: item.error ?? null,
        },
      },
      item.documentId && !ocrNeeded
        ? { label: "Retry indexing", onClick: () => void retryFile(item) }
        : { label: "Upload replacement", onClick: () => inputRef.current?.click() },
      item.documentId && !ocrNeeded
        ? { label: "Upload replacement", onClick: () => { removeFile(item); inputRef.current?.click() }, variant: "ghost" }
        : { label: "Remove file", onClick: () => removeFile(item), variant: "ghost" },
    )
  }

  return (
    <div>
      <div role="button" tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files) }}
        style={{
          border: `1.5px dashed ${dragging ? "var(--color-border-primary-outline)" : "var(--color-border)"}`,
          borderRadius: "var(--radius-md)", padding: "1rem 1.25rem", textAlign: "center",
          cursor: "pointer", outline: "none",
          background: dragging ? "var(--color-background-primary-soft)" : "transparent",
          transition: "border-color var(--transition-duration-basic), background var(--transition-duration-basic)",
        }}>
        <input ref={inputRef} type="file" multiple accept={accept}
          style={{ display: "none" }} onChange={e => void addFiles(e.target.files)} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}>
          <Upload size={16} style={{ color: "var(--color-text-tertiary)" }} />
          <span style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)" }}>
            Drop files here &middot; or{" "}
            <span style={{ color: "var(--color-text)", textDecoration: "underline", textUnderlineOffset: "2px" }}>browse</span>
          </span>
          {hint && <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>{hint}</span>}
        </div>
      </div>
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", marginTop: "0.5rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {items.map((f, idx) => (
              <Animate key={f.id} as="span" enter="slide-up" duration={130} delay={Math.min(idx, 6) * 16}>
              <span title={f.status === "error" ? f.error : STATUS_LABEL[f.status]} onClick={e => { if (f.status === "error") { e.stopPropagation(); openFailedFile(f) } }} style={{
                display: "inline-flex", alignItems: "center", gap: "0.375rem",
                padding: "0.125rem 0.375rem 0.125rem 0.5rem", borderRadius: "var(--radius-xs)",
                background: f.status === "error" ? "var(--color-background-danger-soft)" : "var(--color-background-primary-soft)",
                fontSize: "var(--font-text-xs-size)", color: "var(--color-text)", maxWidth: 220,
              }}>
                {(f.status === "uploading" || f.status === "processing") && (
                  <span style={{ color: "var(--color-text-tertiary)" }}>{f.status === "uploading" ? "↑" : "…"}</span>
                )}
                {f.status === "done" && <Check size={11} style={{ color: "var(--color-text-success-soft)", flexShrink: 0 }} />}
                {f.status === "error" && <span style={{ color: "var(--color-text-danger-soft)" }}>!</span>}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                {f.status === "error" && f.documentId && (
                  <button type="button" onClick={e => { e.stopPropagation(); void retryFile(f) }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-info-soft)", lineHeight: 1, padding: 0, flexShrink: 0, fontSize: "10px" }}>
                    Retry
                  </button>
                )}
                <button type="button" onClick={e => { e.stopPropagation(); removeFile(f) }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", lineHeight: 1, padding: 0, flexShrink: 0 }}>
                  <X size={10} />
                </button>
              </span>
              </Animate>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Connectors ───────────────────────────────────────────────────────────────

type Connector = { name: string; color: string; logo?: string }

const ERP_CONNECTORS: Connector[] = [
  { name: "SAP",        color: "#0AA1DD" },
  { name: "Oracle",     color: "#C74634", logo: "/oracle-6-logo-svgrepo-com.svg" },
  { name: "NetSuite",   color: "#1F5FA9", logo: "/oracle-netsuite-svgrepo-com.svg" },
  { name: "QuickBooks", color: "#2CA01C", logo: "/brand-quickbooks-svgrepo-com.svg" },
  { name: "Xero",       color: "#13B5EA", logo: "/xero-svgrepo-com.svg" },
]

const NOTETAKER_CONNECTORS: Connector[] = [
  { name: "Fireflies", color: "#7C4DFF", logo: "/Fireflies-ai.svg" },
  { name: "Otter",     color: "#00A0DC", logo: "/otter.ai.svg" },
  { name: "Granola",   color: "#E8613C", logo: "/granola.svg" },
]

function OrDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
      <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
      <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>or connect</span>
      <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
    </div>
  )
}

function ConnectorGrid({ kind, connectors }: { kind: SourceId; connectors: Connector[] }) {
  const { engagementId, sourceRows, rememberSourceRow, selectedSources, persistSelectedSources, showIssue } = useContext(PlanningCtx)
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [statusByProvider, setStatusByProvider] = useState<Record<string, string>>({})

  // Pull the registry so tiles reflect backend availability (all "available" for now).
  useEffect(() => {
    api.getConnectors()
      .then(list => setStatusByProvider(Object.fromEntries(list.map(c => [c.provider, c.status]))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const savedProviders = new Set(
      sourceRows
        .filter(source => source.kind === kind && source.origin === "connected" && source.connector_provider)
        .map(source => source.connector_provider!.toLowerCase()),
    )
    setConnected(new Set(connectors.filter(c => savedProviders.has(c.name.toLowerCase())).map(c => c.name)))
  }, [connectors, kind, sourceRows])

  async function recordConnector(name: string) {
    if (!engagementId) return
    try {
      const source = await runWithRetry(
        () => api.createSource(engagementId, { kind, origin: "connected", connector_provider: name.toLowerCase() }),
        { retries: 1 },
      )
      rememberSourceRow({
        id: source.id,
        kind,
        origin: "connected",
        connector_provider: name.toLowerCase(),
        url: null,
      })
    } catch (err) {
      console.error("[veritax] failed to record connected source:", err)
      const base = await diagnoseApiFailure(err, { operation: "save connector source", engagementId })
      showIssue(
        base,
        { label: "Retry save", onClick: () => void recordConnector(name) },
        { label: "Cancel", onClick: () => setConnected(p => { const s = new Set(p); s.delete(name); return s }), variant: "ghost" },
      )
    }
  }

  function toggle(name: string) {
    const on = connected.has(name)
    setConnected(p => { const s = new Set(p); on ? s.delete(name) : s.add(name); return s })
    if (!on && engagementId) {
      const nextSources = new Set(selectedSources)
      nextSources.add(kind)
      persistSelectedSources(nextSources)
      // Record a connected-source stub (no OAuth yet).
      void recordConnector(name)
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: "0.5rem" }}>
      {connectors.map(c => {
        const on = connected.has(c.name)
        const providerStatus = statusByProvider[c.name.toLowerCase()]
        const unavailable = providerStatus !== undefined && providerStatus !== "available"
        return (
          <button key={c.name} type="button" onClick={() => !unavailable && toggle(c.name)} disabled={unavailable}
            className={cn(!on && !unavailable && "hover:bg-[var(--color-background-primary-ghost-hover)]")}
            style={{
              position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem",
              padding: "0.75rem 0.5rem", borderRadius: "var(--radius-md)", cursor: unavailable ? "not-allowed" : "pointer",
              opacity: unavailable ? 0.45 : 1,
              border: `1px solid ${on ? "var(--color-background-primary-solid)" : "var(--color-border)"}`,
              background: on ? "var(--color-background-primary-soft)" : "transparent",
              transition: "border-color var(--transition-duration-basic), background var(--transition-duration-basic)",
            }}>
            {on && (
              <span style={{ position: "absolute", top: 4, right: 4, display: "inline-flex", color: "var(--color-text-success-soft)" }}>
                <Check size={12} />
              </span>
            )}
            {c.logo ? (
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 30 }}>
                {/* definite height so SVGs without intrinsic width/height (Fireflies, Granola) still render */}
                <img src={c.logo} alt="" aria-hidden style={{ height: 28, width: "auto", maxWidth: 72, objectFit: "contain" }} />
              </span>
            ) : (
              <span aria-hidden style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 30, height: 30, borderRadius: 7, background: c.color,
                color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", flexShrink: 0,
              }}>{c.name.charAt(0)}</span>
            )}
            <span style={{ fontSize: "var(--font-text-xs-size)", color: on ? "var(--color-text)" : "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)", textAlign: "center" }}>{c.name}</span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Source inputs ────────────────────────────────────────────────────────────

function FinancialsInput() {
  return (
    <div style={{ paddingLeft: "2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <UploadZone kind="financials" accept=".pdf,.xlsx,.xls,.csv" hint="PDF, Excel, CSV · up to 50 MB each" />
      <OrDivider />
      <ConnectorGrid kind="financials" connectors={ERP_CONNECTORS} />
    </div>
  )
}

function AgreementsInput() {
  return (
    <div style={{ paddingLeft: "2rem" }}>
      <UploadZone kind="agreements" accept=".pdf,.doc,.docx,.xlsx,.xls" hint="PDF, Word, Excel · up to 50 MB each" />
    </div>
  )
}

function WebsiteInput() {
  const { selectedSources, websiteUrl, onWebsiteUrlChange, persistSelectedSources } = useContext(PlanningCtx)

  async function saveUrl() {
    const trimmed = websiteUrl.trim()
    onWebsiteUrlChange(trimmed)
    const nextSources = new Set(selectedSources)
    if (trimmed) nextSources.add("public")
    else nextSources.delete("public")
    persistSelectedSources(nextSources, trimmed)
  }

  return (
    <div style={{ paddingLeft: "2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <input type="url" placeholder="https://example.com" value={websiteUrl} onChange={e => onWebsiteUrlChange(e.target.value)}
        onFocus={e => { e.currentTarget.style.borderColor = "var(--input-outline-border-color-focus)" }}
        onBlur={e => { e.currentTarget.style.borderColor = "var(--input-outline-border-color)"; void saveUrl() }}
        style={OUTLINE_INPUT} />
      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>
        <Globe size={11} />The tool will pull publicly available information from this URL.
      </span>
    </div>
  )
}

function InterviewInput() {
  return (
    <div style={{ paddingLeft: "2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <UploadZone kind="interview" accept=".txt,.pdf,.docx,.vtt,.srt" hint="TXT, PDF, Word, VTT, SRT · up to 50 MB each" />
      <OrDivider />
      <ConnectorGrid kind="interview" connectors={NOTETAKER_CONNECTORS} />
    </div>
  )
}

// ─── Sources list ─────────────────────────────────────────────────────────────

const SOURCES: { id: SourceId; label: string; primary?: true; render?: () => ReactNode }[] = [
  { id: "financials", label: "Financial statements",                    render: () => <FinancialsInput /> },
  { id: "agreements", label: "Agreements, prior files, questionnaires", render: () => <AgreementsInput /> },
  { id: "public",     label: "Website / public info",                   render: () => <WebsiteInput /> },
  { id: "interview",  label: "Interview",            primary: true,     render: () => <InterviewInput /> },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlanningStep({
  engagementId,
  jurisdictions, onJurisdictionsChange,
  entity, onEntityChange,
  documentsByKind, updateDocuments,
  sourceRows, rememberSourceRow,
  websiteUrl, onWebsiteUrlChange,
  sources, onSourcesChange, onContinue,
}: {
  engagementId: string | null
  jurisdictions: string[]
  onJurisdictionsChange: (v: string[]) => void
  entity: string
  onEntityChange: (v: string) => void
  documentsByKind: PlanningDocumentMap
  updateDocuments: (kind: SourceId, updater: (docs: DocumentRead[]) => DocumentRead[]) => void
  sourceRows: PlanningSourceRow[]
  rememberSourceRow: (source: PlanningSourceRow) => void
  websiteUrl: string
  onWebsiteUrlChange: (url: string) => void
  sources: Set<SourceId>
  onSourcesChange: (v: Set<SourceId>) => void
  onContinue: () => void
}) {
  const [jurisdictionOptions, setJurisdictionOptions] = useState<string[]>(JURISDICTIONS_FALLBACK)
  const [issue, setIssue] = useState<ActionableIssue | null>(null)

  function showIssue(
    base: ActionableIssueBase,
    primaryAction: ActionableIssue["primaryAction"],
    secondaryAction?: ActionableIssue["secondaryAction"],
  ) {
    setIssue(withActions(base, primaryAction, secondaryAction))
  }

  function persistSelectedSources(next: Set<SourceId>, nextWebsiteUrl = websiteUrl) {
    onSourcesChange(new Set(next))
    if (!engagementId) return
    runWithRetry(
      () => api.patchEngagement(engagementId, {
        selected_source_kinds: Array.from(next),
        website_url: nextWebsiteUrl,
      }),
      { retries: 1 },
    ).catch(async err => {
      console.error("[veritax] failed to save planning source selection:", err)
      const base = await diagnoseApiFailure(err, { operation: "save planning source selection", engagementId })
      showIssue(
        base,
        { label: "Retry save", onClick: () => persistSelectedSources(next, nextWebsiteUrl) },
        { label: "Cancel", onClick: () => {}, variant: "ghost" },
      )
    })
  }

  useEffect(() => {
    api.getJurisdictions()
      .then(js => { if (js.length) setJurisdictionOptions(js) })
      .catch(async e => {
        console.error("[veritax] failed to load jurisdictions; using fallback:", e)
        const base = await diagnoseApiFailure(e, { operation: "load jurisdictions", engagementId })
        showIssue(
          { ...base, message: "Veritax is using the built-in jurisdiction list until the backend responds." },
          { label: "Retry list", onClick: () => void api.getJurisdictions().then(js => { if (js.length) setJurisdictionOptions(js) }) },
          { label: "Keep fallback", onClick: () => {}, variant: "ghost" },
        )
      })
  }, [])

  const toggle = (id: SourceId) => {
    const next = new Set(sources)
    const removing = next.has(id)
    removing ? next.delete(id) : next.add(id)
    let nextWebsiteUrl = websiteUrl
    if (id === "public" && removing) {
      nextWebsiteUrl = ""
      onWebsiteUrlChange("")
    }
    persistSelectedSources(next, nextWebsiteUrl)
  }
  const canContinue = jurisdictions.length > 0 && entity.trim().length > 0 && sources.size > 0

  return (
    <PlanningCtx.Provider value={{
      engagementId,
      documentsByKind,
      updateDocuments,
      sourceRows,
      rememberSourceRow,
      selectedSources: sources,
      websiteUrl,
      onWebsiteUrlChange,
      persistSelectedSources,
      showIssue,
    }}>
    <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "3rem 3.5rem", maxWidth: 760, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", marginBottom: "2.5rem" }}>
        <div style={{ flex: "0 0 240px" }}>
          <label style={FIELD_LABEL}>Jurisdiction</label>
          <MultiSelect options={jurisdictionOptions} value={jurisdictions} onChange={onJurisdictionsChange} placeholder="Select jurisdiction" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL}>Entity</label>
          <input type="text" placeholder="Entity name" value={entity} onChange={e => onEntityChange(e.target.value)}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--input-outline-border-color-focus)" }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--input-outline-border-color)" }}
            style={OUTLINE_INPUT} />
        </div>
        <button type="button" disabled={!canContinue} onClick={onContinue} style={{
          height: "var(--control-size-md)", padding: "0 var(--control-gutter-lg)",
          borderRadius: "var(--control-radius-md)", border: "none", flexShrink: 0,
          background: canContinue ? "var(--color-background-primary-solid)" : "var(--alpha-08)",
          color: canContinue ? "var(--color-text-inverse)" : "var(--color-text-tertiary)",
          fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)",
          cursor: canContinue ? "pointer" : "not-allowed",
          transition: "background var(--transition-duration-basic), color var(--transition-duration-basic)",
        }}>Continue</button>
      </div>

      <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)", marginBottom: "0.75rem", letterSpacing: "0.02em", textTransform: "uppercase", fontWeight: "var(--font-weight-medium)" }}>
        What do you have to work with?
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {SOURCES.map(({ id, label, primary, render }) => {
          const on = sources.has(id)
          return (
            <li key={id}>
              <div className={cn(!on && "hover:bg-[var(--color-background-primary-ghost-hover)]")} style={{
                borderRadius: "var(--radius-md)",
                transition: "background var(--transition-duration-basic) var(--transition-ease-basic)",
                padding: "0.75rem 1rem", paddingBottom: on && render ? "1rem" : "0.75rem",
              }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.875rem", cursor: "pointer", userSelect: "none" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 18, height: 18, flexShrink: 0, borderRadius: "var(--radius-xs)",
                    border: `1.5px solid ${on ? "var(--color-background-primary-solid)" : "var(--color-border-primary-outline)"}`,
                    background: on ? "var(--color-background-primary-solid)" : "transparent",
                    transition: "border-color var(--transition-duration-basic), background var(--transition-duration-basic)",
                  }}>
                    {on && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" style={{ display: "block", color: "var(--color-text-inverse)" }}>
                        <path d="M1 4L3.8 7L9 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span style={{
                    fontSize: "var(--font-text-sm-size)", lineHeight: "var(--font-text-sm-line-height)",
                    color: on ? "var(--color-text)" : "var(--color-text-secondary)",
                    fontWeight: on ? "var(--font-weight-medium)" : "var(--font-weight-normal)",
                    transition: "color var(--transition-duration-basic)",
                  }}>{label}</span>
                  {primary && (
                    <span style={{
                      marginLeft: "auto", fontSize: "10px", fontWeight: "var(--font-weight-semibold)",
                      letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-tertiary)",
                      border: "1px solid var(--color-border)", borderRadius: "var(--radius-xs)",
                      padding: "1px 5px", lineHeight: 1.5, flexShrink: 0,
                    }}>Key source</span>
                  )}
                  <input type="checkbox" checked={on} onChange={() => toggle(id)}
                    style={{ position: "absolute", opacity: 0, pointerEvents: "none" }} aria-label={label} />
                </label>
                {on && render && <div style={{ marginTop: "0.75rem" }}>{render()}</div>}
              </div>
            </li>
          )
        })}
      </ul>
    </main>
    <ActionModal issue={issue} onClose={() => setIssue(null)} />
    </PlanningCtx.Provider>
  )
}
