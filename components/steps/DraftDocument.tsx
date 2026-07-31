"use client"

import { useEffect, useState, type CSSProperties, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Download, Edit3, Loader2, Save, X } from "lucide-react"
import { api, type DocChart, type DocTable, type DraftSection } from "@/lib/api"

const PALETTE = ["#0285ff", "#04b84c", "#ffc300", "#e02e2a", "#8046d9", "#ff66ad", "#fb6a22"]
const MARKER = /\[\[(table|chart):([^\]]+)\]\]/g
const DRAFT_TITLE = "Transfer Pricing Local File"
const stripLeadingSectionHeading = (content: string) => content.replace(/^\s*#{1,4}\s+.*\n+/, "")

function TableView({ t }: { t: DocTable }) {
  const th: CSSProperties = {
    border: "1px solid var(--color-border)", padding: "0.4rem 0.6rem", textAlign: "left",
    background: "var(--color-background-primary-soft)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)",
  }
  const td: CSSProperties = {
    border: "1px solid var(--color-border)", padding: "0.4rem 0.6rem", color: "var(--color-text-secondary)", verticalAlign: "top",
  }
  return (
    <figure style={{ margin: "1rem 0", overflowX: "auto" }}>
      {t.title && <figcaption style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", marginBottom: "0.375rem" }}>{t.title}</figcaption>}
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "var(--font-text-sm-size)" }}>
        <thead><tr>{t.columns.map((c, i) => <th key={i} style={th}>{c}</th>)}</tr></thead>
        <tbody>{t.rows.map((r, ri) => <tr key={ri}>{r.map((v, ci) => <td key={ci} style={td}>{v}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  )
}

function ChartView({ c }: { c: DocChart }) {
  const inner = (() => {
    if (c.type === "pie") {
      const data = c.categories.map((cat, i) => ({ name: cat, value: c.series[0]?.values[i] ?? 0 }))
      return (
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={95} label>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip /><Legend />
        </PieChart>
      )
    }
    const data = c.categories.map((cat, i) => {
      const row: Record<string, string | number> = { name: cat }
      c.series.forEach(s => { row[s.name] = s.values[i] ?? 0 })
      return row
    })
    if (c.type === "line") {
      return (
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend />
          {c.series.map((s, i) => <Line key={s.name} type="monotone" dataKey={s.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} />)}
        </LineChart>
      )
    }
    return (
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="name" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Legend />
        {c.series.map((s, i) => <Bar key={s.name} dataKey={s.name} fill={PALETTE[i % PALETTE.length]} />)}
      </BarChart>
    )
  })()
  return (
    <figure style={{ margin: "1.25rem 0" }}>
      {c.title && <figcaption style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", marginBottom: "0.375rem", textAlign: "center" }}>{c.title}</figcaption>}
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">{inner}</ResponsiveContainer>
      </div>
    </figure>
  )
}

function Prose({ children }: { children: string }) {
  return <div className="tp-draft"><ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown></div>
}

export function DraftCover({ entity, jurisdiction }: { entity: string; jurisdiction: string }) {
  return (
    <header style={{
      minHeight: "230mm",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      textAlign: "center",
      padding: "1rem 0 2.25rem",
      color: "var(--color-text)",
    }}>
      <div style={{ fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" }}>
        Veritax
      </div>

      <div>
        <h1 style={{ fontSize: "34px", lineHeight: 1.08, fontWeight: 300, letterSpacing: 0, color: "var(--color-text)", margin: "0 0 0.875rem" }}>
          {DRAFT_TITLE}
        </h1>
        <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)", margin: 0 }}>
          Draft prepared for review
        </p>
      </div>

      <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", margin: "0 auto", width: "min(100%, 560px)", textAlign: "left" }}>
        <div>
          <dt style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: "0.375rem" }}>
            Entity
          </dt>
          <dd style={{ margin: 0, fontSize: "16px", color: "var(--color-text)" }}>{entity || "Entity"}</dd>
        </div>
        <div>
          <dt style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: "0.375rem" }}>
            Jurisdiction
          </dt>
          <dd style={{ margin: 0, fontSize: "16px", color: "var(--color-text)" }}>{jurisdiction}</dd>
        </div>
      </dl>

      <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: 0 }}>
        Prepared by Veritax
      </p>
    </header>
  )
}

function renderSection(s: DraftSection): ReactNode[] {
  const tables = new Map(s.tables.map(t => [t.id, t]))
  const charts = new Map(s.charts.map(c => [c.id, c]))
  const text = stripLeadingSectionHeading(s.content ?? "")
  const parts: ReactNode[] = []
  const used = new Set<string>()
  let last = 0, k = 0, m: RegExpExecArray | null
  MARKER.lastIndex = 0
  while ((m = MARKER.exec(text)) !== null) {
    const pre = text.slice(last, m.index)
    if (pre.trim()) parts.push(<Prose key={`p${k++}`}>{pre}</Prose>)
    const [, kind, id] = m
    used.add(id)
    if (kind === "table" && tables.has(id)) parts.push(<TableView key={`t${k++}`} t={tables.get(id)!} />)
    else if (kind === "chart" && charts.has(id)) parts.push(<ChartView key={`c${k++}`} c={charts.get(id)!} />)
    last = m.index + m[0].length
  }
  const tail = text.slice(last)
  if (tail.trim()) parts.push(<Prose key={`p${k++}`}>{tail}</Prose>)
  s.tables.forEach(t => { if (!used.has(t.id)) parts.push(<TableView key={`t${t.id}`} t={t} />) })
  s.charts.forEach(c => { if (!used.has(c.id)) parts.push(<ChartView key={`c${c.id}`} c={c} />) })
  return parts
}

export default function DraftDocument({ engagementId, jurisdiction, entity, sections, onSectionsChange }: {
  engagementId: string
  jurisdiction: string
  entity: string
  sections: DraftSection[]
  onSectionsChange?: (sections: DraftSection[]) => void
}) {
  const [downloading, setDownloading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [docSections, setDocSections] = useState<DraftSection[]>(sections)
  const [draftText, setDraftText] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [saveError, setSaveError] = useState<Record<string, string>>({})
  const ordered = [...docSections].sort((a, b) => a.element_order - b.element_order)

  useEffect(() => {
    setDocSections(sections)
    setDraftText(Object.fromEntries(
      sections.map(s => [s.id, stripLeadingSectionHeading(s.content ?? "").trim()]),
    ))
    setSaveError({})
  }, [sections])

  async function download() {
    setDownloading(true)
    try {
      const blob = await api.downloadDraftDocx(engagementId, jurisdiction)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${(entity || "Entity")} ${jurisdiction} Local File`.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") + ".docx"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error("[veritax] docx download failed:", e)
    } finally {
      setDownloading(false)
    }
  }

  async function saveSection(section: DraftSection) {
    const content = (draftText[section.id] ?? "").trim()
    if (!content) {
      setSaveError(prev => ({ ...prev, [section.id]: "Section text cannot be empty." }))
      return
    }
    setSaving(prev => ({ ...prev, [section.id]: true }))
    setSaveError(prev => ({ ...prev, [section.id]: "" }))
    try {
      const updated = await api.updateDraftSection(section.id, { content })
      setDocSections(prev => {
        const next = prev.map(s => (s.id === updated.id ? updated : s))
        onSectionsChange?.(next)
        return next
      })
      setDraftText(prev => ({ ...prev, [updated.id]: stripLeadingSectionHeading(updated.content ?? "").trim() }))
    } catch (e) {
      console.error("[veritax] draft section save failed:", e)
      setSaveError(prev => ({ ...prev, [section.id]: e instanceof Error ? e.message : String(e) }))
    } finally {
      setSaving(prev => ({ ...prev, [section.id]: false }))
    }
  }

  function cancelSection(section: DraftSection) {
    setDraftText(prev => ({ ...prev, [section.id]: stripLeadingSectionHeading(section.content ?? "").trim() }))
    setSaveError(prev => ({ ...prev, [section.id]: "" }))
  }

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", minWidth: 0 }}>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", padding: "0.5rem 1rem", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <p style={{ margin: 0, fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>
            A4 page preview
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button type="button" onClick={() => setEditing(v => !v)} style={{
              display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "var(--control-size-sm)", padding: "0 var(--control-gutter-md)",
              borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", background: editing ? "var(--color-background-primary-solid)" : "transparent",
              color: editing ? "var(--color-text-inverse)" : "var(--color-text-secondary)", fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)", cursor: "pointer" }}>
              <Edit3 size={14} /> {editing ? "Preview" : "Edit draft"}
            </button>
            <button type="button" onClick={download} disabled={downloading} style={{
              display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "var(--control-size-sm)", padding: "0 var(--control-gutter-md)",
              borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", background: "transparent",
              color: "var(--color-text-secondary)", fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)", cursor: "pointer" }}>
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {downloading ? "Preparing..." : "Download Word"}
            </button>
          </div>
        </div>

        <div className="vt-a4-scroll">
          <article id="draft-cover-page" className="vt-a4-page">
            <span className="vt-a4-page-label">Page 1</span>
            <DraftCover entity={entity} jurisdiction={jurisdiction} />
          </article>
          {ordered.map((s, idx) => {
            const value = draftText[s.id] ?? ""
            const original = stripLeadingSectionHeading(s.content ?? "").trim()
            const dirty = value.trim() !== original
            return (
              <article key={s.id} id={`sec-${s.element_order}`} className="vt-a4-page">
                <span className="vt-a4-page-label">Page {idx + 2}</span>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", margin: "0 0 0.5rem" }}>
                  <h2 style={{ fontSize: "18px", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: 0 }}>
                    {s.element_order}. {s.element_name}
                  </h2>
                  {editing && (
                    <div style={{ display: "flex", gap: "0.375rem", flexShrink: 0 }}>
                      <button type="button" onClick={() => saveSection(s)} disabled={!dirty || saving[s.id]} style={{
                        display: "inline-flex", alignItems: "center", gap: "0.25rem", height: 28, padding: "0 0.625rem",
                        borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)",
                        background: dirty ? "var(--color-background-primary-solid)" : "transparent",
                        color: dirty ? "var(--color-text-inverse)" : "var(--color-text-tertiary)",
                        cursor: dirty && !saving[s.id] ? "pointer" : "not-allowed",
                        fontSize: "var(--font-text-xs-size)",
                      }}>
                        {saving[s.id] ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                      </button>
                      <button type="button" onClick={() => cancelSection(s)} disabled={!dirty || saving[s.id]} style={{
                        display: "inline-flex", alignItems: "center", gap: "0.25rem", height: 28, padding: "0 0.5rem",
                        borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "transparent",
                        color: "var(--color-text-secondary)", cursor: dirty && !saving[s.id] ? "pointer" : "not-allowed",
                        fontSize: "var(--font-text-xs-size)",
                      }}>
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  )}
                </div>
                {editing ? (
                  <>
                    <textarea
                      value={value}
                      onChange={e => setDraftText(prev => ({ ...prev, [s.id]: e.target.value }))}
                      className="vt-draft-editor"
                      aria-label={`Edit ${s.element_name}`}
                    />
                    {s.tables.length + s.charts.length > 0 && (
                      <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: "0.625rem 0 0" }}>
                        Keep table/chart markers like [[table:id]] in the text where those objects should render.
                      </p>
                    )}
                    {saveError[s.id] && (
                      <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-danger-soft)", margin: "0.625rem 0 0" }}>
                        {saveError[s.id]}
                      </p>
                    )}
                  </>
                ) : renderSection(s)}
              </article>
            )
          })}
        </div>
      </main>

      {ordered.length > 0 && (
        <nav style={{ width: 210, flexShrink: 0, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", overflowY: "auto", padding: "1rem 0.5rem" }}>
          <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: "var(--font-weight-medium)", padding: "0 0.5rem", marginBottom: "0.375rem" }}>Sections</p>
          <button type="button" onClick={() => document.getElementById("draft-cover-page")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            style={{ display: "flex", gap: "0.5rem", padding: "0.4rem 0.5rem", width: "100%", border: "none", background: "transparent", cursor: "pointer", borderRadius: "var(--radius-md)", textAlign: "left" }}>
            <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)", flexShrink: 0 }}>01</span>
            <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Cover</span>
          </button>
          {ordered.map(s => (
            <button key={s.id} type="button" onClick={() => document.getElementById(`sec-${s.element_order}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{ display: "flex", gap: "0.5rem", padding: "0.4rem 0.5rem", width: "100%", border: "none", background: "transparent", cursor: "pointer", borderRadius: "var(--radius-md)", textAlign: "left" }}>
              <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)", flexShrink: 0 }}>{String(s.element_order + 1).padStart(2, "0")}</span>
              <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.element_name}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
