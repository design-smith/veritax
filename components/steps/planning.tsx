"use client"

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Check, ChevronDown, Globe, Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { api } from "@/lib/api"

export type SourceId = "financials" | "agreements" | "public" | "interview"

// Provides the persisted engagement id to nested source inputs (upload zones, connector grid).
const PlanningCtx = createContext<{ engagementId: string | null }>({ engagementId: null })

// ─── Constants ────────────────────────────────────────────────────────────────

// Must match the jurisdictions defined in jurisdiction_requirements.json (backend/app/data).
// ponytail: hardcoded to the 8 with requirement lists; if that set grows, fetch it from the
// backend instead of editing here.
const JURISDICTIONS = [
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
  const raw = err instanceof Error ? err.message : String(err)
  const body = raw.slice(raw.indexOf(": ") + 2)
  try { return JSON.parse(body).detail ?? raw } catch { return raw }
}

// uploading → sent, awaiting response; processing → backend embedding; done → embedded; error → rejected/failed
type UploadStatus = "uploading" | "processing" | "done" | "error"
interface UploadItem { id: number; name: string; status: UploadStatus; error?: string }

// Backend DocumentStatus → chip status. Poll until it settles (embedded/failed).
const DOC_STATUS: Record<string, UploadStatus> = {
  uploaded: "processing", embedding: "processing", embedded: "done", failed: "error",
}
const STATUS_LABEL: Record<UploadStatus, string> = {
  uploading: "Uploading…", processing: "Processing…", done: "Processed", error: "Failed",
}

function UploadZone({ kind, accept = "*", hint }: { kind: SourceId; accept?: string; hint?: string }) {
  const { engagementId } = useContext(PlanningCtx)
  const [dragging, setDragging] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(0)

  // Poll one document's processing status until it settles, then reflect it on its chip.
  // Ceiling is generous — extracting + embedding a large PDF can take a few minutes.
  async function pollDoc(itemId: number, documentId: string) {
    for (let i = 0; i < 160; i++) {
      await new Promise(r => setTimeout(r, 1500))
      try {
        const doc = await api.getDocument(documentId)
        const status = DOC_STATUS[doc.status] ?? "processing"
        setItems(p => p.map(x => (x.id === itemId ? { ...x, status, error: doc.error ?? undefined } : x)))
        if (status === "done" || status === "error") return
      } catch (err) {
        console.error("[veritax] status poll failed:", err)
        return
      }
    }
  }

  async function addFiles(list: FileList | null) {
    const arr = Array.from(list ?? [])
    if (!arr.length) return
    const entries: UploadItem[] = arr.map(f => ({ id: nextId.current++, name: f.name, status: "uploading" }))
    setItems(p => [...p, ...entries])
    const ids = new Set(entries.map(e => e.id))
    const markAll = (status: UploadStatus, error?: string) =>
      setItems(p => p.map(x => (ids.has(x.id) ? { ...x, status, error } : x)))

    if (!engagementId) {
      // No backend session yet — keep the local chip UX so the user isn't blocked.
      console.warn("[veritax] no engagement id; file kept locally, not uploaded")
      markAll("done")
      return
    }
    try {
      const docs = await api.uploadDocuments(engagementId, kind, arr)
      // Backend returns documents in file order — correlate each chip to its doc and poll.
      setItems(p => p.map(x => {
        const idx = entries.findIndex(e => e.id === x.id)
        return idx >= 0 && docs[idx] ? { ...x, status: "processing" as UploadStatus } : x
      }))
      entries.forEach((e, idx) => { if (docs[idx]) void pollDoc(e.id, docs[idx].id) })
    } catch (err) {
      console.error("[veritax] upload failed:", err)
      markAll("error", uploadErrorMessage(err))
    }
  }

  const removeFile = (id: number) => setItems(p => p.filter(x => x.id !== id))

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
            {items.map(f => (
              <span key={f.id} title={f.status === "error" ? f.error : STATUS_LABEL[f.status]} style={{
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
                <button type="button" onClick={e => { e.stopPropagation(); removeFile(f.id) }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", lineHeight: 1, padding: 0, flexShrink: 0 }}>
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          {items.filter(f => f.status === "error" && f.error).map(f => (
            <span key={f.id} style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-danger-soft)" }}>
              {f.name}: {f.error}
            </span>
          ))}
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
  const { engagementId } = useContext(PlanningCtx)
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [statusByProvider, setStatusByProvider] = useState<Record<string, string>>({})

  // Pull the registry so tiles reflect backend availability (all "available" for now).
  useEffect(() => {
    api.getConnectors()
      .then(list => setStatusByProvider(Object.fromEntries(list.map(c => [c.provider, c.status]))))
      .catch(err => console.error("[veritax] failed to load connectors:", err))
  }, [])

  function toggle(name: string) {
    const on = connected.has(name)
    setConnected(p => { const s = new Set(p); on ? s.delete(name) : s.add(name); return s })
    if (!on && engagementId) {
      // Record a connected-source stub (no OAuth yet).
      api.createSource(engagementId, { kind, origin: "connected", connector_provider: name.toLowerCase() })
        .catch(err => console.error("[veritax] failed to record connected source:", err))
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
  const { engagementId } = useContext(PlanningCtx)
  const [url, setUrl] = useState("")

  function saveUrl() {
    if (!engagementId) return
    api.patchEngagement(engagementId, { website_url: url.trim() })
      .catch(err => console.error("[veritax] failed to save website url:", err))
  }

  return (
    <div style={{ paddingLeft: "2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <input type="url" placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)}
        onFocus={e => { e.currentTarget.style.borderColor = "var(--input-outline-border-color-focus)" }}
        onBlur={e => { e.currentTarget.style.borderColor = "var(--input-outline-border-color)"; saveUrl() }}
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
  sources, onSourcesChange, onContinue,
}: {
  engagementId: string | null
  jurisdictions: string[]
  onJurisdictionsChange: (v: string[]) => void
  entity: string
  onEntityChange: (v: string) => void
  sources: Set<SourceId>
  onSourcesChange: (v: Set<SourceId>) => void
  onContinue: () => void
}) {
  const toggle = (id: SourceId) => {
    const next = new Set(sources)
    next.has(id) ? next.delete(id) : next.add(id)
    onSourcesChange(next)
  }
  const canContinue = jurisdictions.length > 0 && entity.trim().length > 0 && sources.size > 0

  return (
    <PlanningCtx.Provider value={{ engagementId }}>
    <main style={{ flex: 1, display: "flex", flexDirection: "column", padding: "3rem 3.5rem", maxWidth: 640, overflowY: "auto" }}>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2.5rem" }}>
        <div style={{ flex: "0 0 240px" }}>
          <label style={FIELD_LABEL}>Jurisdiction</label>
          <MultiSelect options={JURISDICTIONS} value={jurisdictions} onChange={onJurisdictionsChange} placeholder="Select jurisdiction" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={FIELD_LABEL}>Entity</label>
          <input type="text" placeholder="Entity name" value={entity} onChange={e => onEntityChange(e.target.value)}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--input-outline-border-color-focus)" }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--input-outline-border-color)" }}
            style={OUTLINE_INPUT} />
        </div>
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

      <div style={{ marginTop: "2rem" }}>
        <button type="button" disabled={!canContinue} onClick={onContinue} style={{
          height: "var(--control-size-md)", padding: "0 var(--control-gutter-lg)",
          borderRadius: "var(--control-radius-md)", border: "none",
          background: canContinue ? "var(--color-background-primary-solid)" : "var(--alpha-08)",
          color: canContinue ? "var(--color-text-inverse)" : "var(--color-text-tertiary)",
          fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)",
          cursor: canContinue ? "pointer" : "not-allowed",
          transition: "background var(--transition-duration-basic), color var(--transition-duration-basic)",
        }}>Continue</button>
      </div>
    </main>
    </PlanningCtx.Provider>
  )
}
