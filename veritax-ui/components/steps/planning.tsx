"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Check, ChevronDown, Globe, Link2, Mic, Upload, X } from "lucide-react"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { cn } from "@/lib/utils"

export type SourceId = "financials" | "agreements" | "public" | "interview"

// ─── Constants ────────────────────────────────────────────────────────────────

const JURISDICTIONS = [
  "Australia","Belgium","Brazil","Canada","China","Denmark",
  "France","Germany","Hong Kong","India","Ireland","Italy",
  "Japan","Luxembourg","Mexico","Netherlands","New Zealand",
  "Singapore","South Korea","Spain","Sweden","Switzerland",
  "United Kingdom","United States",
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

const CONNECT_BTN: CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
  height: "var(--control-size-sm)", padding: "0 var(--control-gutter-sm)",
  borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)",
  background: "transparent", fontSize: "var(--control-font-size-md)",
  fontWeight: "var(--font-weight-medium)", color: "var(--color-text)",
  cursor: "pointer", width: "100%", transition: "background var(--transition-duration-basic)",
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

function UploadZone({ accept = "*", hint }: { accept?: string; hint?: string }) {
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const addFiles = (list: FileList | null) => { if (list) setFiles(p => [...p, ...Array.from(list)]) }
  const removeFile = (i: number) => setFiles(p => p.filter((_, j) => j !== i))
  return (
    <div>
      <div role="button" tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        style={{
          border: `1.5px dashed ${dragging ? "var(--color-border-primary-outline)" : "var(--color-border)"}`,
          borderRadius: "var(--radius-md)", padding: "1rem 1.25rem", textAlign: "center",
          cursor: "pointer", outline: "none",
          background: dragging ? "var(--color-background-primary-soft)" : "transparent",
          transition: "border-color var(--transition-duration-basic), background var(--transition-duration-basic)",
        }}>
        <input ref={inputRef} type="file" multiple accept={accept}
          style={{ display: "none" }} onChange={e => addFiles(e.target.files)} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}>
          <Upload size={16} style={{ color: "var(--color-text-tertiary)" }} />
          <span style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)" }}>
            Drop files here &middot; or{" "}
            <span style={{ color: "var(--color-text)", textDecoration: "underline", textUnderlineOffset: "2px" }}>browse</span>
          </span>
          {hint && <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>{hint}</span>}
        </div>
      </div>
      {files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.5rem" }}>
          {files.map((f, i) => (
            <span key={i} style={{
              display: "inline-flex", alignItems: "center", gap: "0.25rem",
              padding: "0.125rem 0.375rem 0.125rem 0.5rem", borderRadius: "var(--radius-xs)",
              background: "var(--color-background-primary-soft)",
              fontSize: "var(--font-text-xs-size)", color: "var(--color-text)", maxWidth: 200,
            }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              <button type="button" onClick={e => { e.stopPropagation(); removeFile(i) }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-tertiary)", lineHeight: 1, padding: 0, flexShrink: 0 }}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function ConnectedBadge({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-success-soft)", padding: "0.25rem 0" }}>
      <Check size={12} />{label}
    </div>
  )
}

// ─── Source inputs ────────────────────────────────────────────────────────────

function FinancialsInput() {
  const [erpConnected, setErpConnected] = useState(false)
  return (
    <div style={{ paddingLeft: "2rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      <UploadZone accept=".pdf,.xlsx,.xls,.csv" hint="PDF, Excel, CSV" />
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
        <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>or</span>
        <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
      </div>
      {erpConnected
        ? <ConnectedBadge label="Accounting system connected" />
        : <button type="button" style={CONNECT_BTN} className="hover:bg-[var(--color-background-primary-ghost-hover)]" onClick={() => setErpConnected(true)}>
            <Link2 size={14} style={{ color: "var(--color-text-tertiary)" }} />
            Connect accounting system / ERP
          </button>}
    </div>
  )
}

function AgreementsInput() {
  return (
    <div style={{ paddingLeft: "2rem" }}>
      <UploadZone accept=".pdf,.doc,.docx,.xlsx,.xls" hint="PDF, Word, Excel" />
    </div>
  )
}

function WebsiteInput() {
  const [url, setUrl] = useState("")
  return (
    <div style={{ paddingLeft: "2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <input type="url" placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)}
        onFocus={e => { e.currentTarget.style.borderColor = "var(--input-outline-border-color-focus)" }}
        onBlur={e => { e.currentTarget.style.borderColor = "var(--input-outline-border-color)" }}
        style={OUTLINE_INPUT} />
      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>
        <Globe size={11} />The tool will pull publicly available information from this URL.
      </span>
    </div>
  )
}

type InterviewMode = "live" | "upload" | "import"
const PLATFORMS = ["Fireflies", "Otter", "Fathom"] as const
type Platform = (typeof PLATFORMS)[number]

function InterviewInput() {
  const [mode, setMode] = useState<InterviewMode>("live")
  const [platform, setPlatform] = useState<Platform>("Fireflies")
  const [liveConnected, setLiveConnected] = useState(false)
  const [importConnected, setImportConnected] = useState(false)
  return (
    <div style={{ paddingLeft: "2rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <SegmentedControl value={mode} onChange={setMode} aria-label="Interview source" size="sm" block>
        <SegmentedControl.Option value="live">Live note-taker</SegmentedControl.Option>
        <SegmentedControl.Option value="upload">Upload transcript</SegmentedControl.Option>
        <SegmentedControl.Option value="import">Import</SegmentedControl.Option>
      </SegmentedControl>
      {mode === "live" && (liveConnected
        ? <ConnectedBadge label="Meeting tool connected" />
        : <button type="button" style={CONNECT_BTN} className="hover:bg-[var(--color-background-primary-ghost-hover)]" onClick={() => setLiveConnected(true)}>
            <Mic size={14} style={{ color: "var(--color-text-tertiary)" }} />Connect meeting tool
          </button>)}
      {mode === "upload" && <UploadZone accept=".txt,.pdf,.docx,.vtt,.srt" hint="TXT, PDF, Word, VTT, SRT" />}
      {mode === "import" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", gap: "0.375rem" }}>
            {PLATFORMS.map(p => {
              const active = platform === p
              return (
                <button key={p} type="button" onClick={() => { setPlatform(p); setImportConnected(false) }} style={{
                  padding: "0.25rem 0.625rem", borderRadius: "9999px",
                  border: `1px solid ${active ? "var(--color-background-primary-solid)" : "var(--color-border)"}`,
                  background: active ? "var(--color-background-primary-solid)" : "transparent",
                  color: active ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
                  fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
                  cursor: "pointer", transition: "all var(--transition-duration-basic)",
                }}>{p}</button>
              )
            })}
          </div>
          {importConnected
            ? <ConnectedBadge label={`${platform} connected`} />
            : <button type="button" style={CONNECT_BTN} className="hover:bg-[var(--color-background-primary-ghost-hover)]" onClick={() => setImportConnected(true)}>
                <Link2 size={14} style={{ color: "var(--color-text-tertiary)" }} />Connect {platform}
              </button>}
        </div>
      )}
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
  jurisdictions, onJurisdictionsChange,
  entity, onEntityChange,
  sources, onSourcesChange, onContinue,
}: {
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
  )
}
