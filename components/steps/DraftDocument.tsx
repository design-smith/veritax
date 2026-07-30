"use client"

import { useState, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Download, Loader2 } from "lucide-react"
import { api, type DocChart, type DocTable, type DraftSection } from "@/lib/api"

// On-brand chart palette (design-system primitives) — concrete hex so SVG fills resolve reliably.
const PALETTE = ["#0285ff", "#04b84c", "#ffc300", "#e02e2a", "#8046d9", "#ff66ad", "#fb6a22"]
const MARKER = /\[\[(table|chart):([^\]]+)\]\]/g
const DRAFT_TITLE = "Transfer Pricing Local File"

function TableView({ t }: { t: DocTable }) {
  const th: React.CSSProperties = { border: "1px solid var(--color-border)", padding: "0.4rem 0.6rem", textAlign: "left",
    background: "var(--color-background-primary-soft)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }
  const td: React.CSSProperties = { border: "1px solid var(--color-border)", padding: "0.4rem 0.6rem", color: "var(--color-text-secondary)", verticalAlign: "top" }
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
      minHeight: 520,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      textAlign: "center",
      padding: "1rem 0 2.25rem",
      marginBottom: "2.25rem",
      borderBottom: "1px solid var(--color-border)",
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
  const text = (s.content ?? "").replace(/^\s*#{1,4}\s+.*\n+/, "")  // heading rendered separately
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

export default function DraftDocument({ engagementId, jurisdiction, entity, sections }: {
  engagementId: string; jurisdiction: string; entity: string; sections: DraftSection[]
}) {
  const [downloading, setDownloading] = useState(false)
  const ordered = [...sections].sort((a, b) => a.element_order - b.element_order)

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

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", minWidth: 0 }}>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0.5rem 1rem", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <button type="button" onClick={download} disabled={downloading} style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem", height: "var(--control-size-sm)", padding: "0 var(--control-gutter-md)",
            borderRadius: "var(--control-radius-md)", border: "1px solid var(--color-border)", background: "transparent",
            color: "var(--color-text-secondary)", fontSize: "var(--control-font-size-md)", fontWeight: "var(--font-weight-medium)", cursor: "pointer" }}>
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {downloading ? "Preparing…" : "Download Word"}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", background: "var(--color-surface-secondary)" }}>
          <article style={{ maxWidth: 820, margin: "1.5rem auto", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "3rem 3.5rem" }}>
            <DraftCover entity={entity} jurisdiction={jurisdiction} />
            {ordered.map(s => (
              <section key={s.id} id={`sec-${s.element_order}`} style={{ marginBottom: "1.5rem" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: "1.25rem 0 0.5rem" }}>
                  {s.element_order}. {s.element_name}
                </h2>
                {renderSection(s)}
              </section>
            ))}
          </article>
        </div>
      </main>

      {ordered.length > 0 && (
        <nav style={{ width: 210, flexShrink: 0, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", overflowY: "auto", padding: "1rem 0.5rem" }}>
          <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: "var(--font-weight-medium)", padding: "0 0.5rem", marginBottom: "0.375rem" }}>Sections</p>
          {ordered.map(s => (
            <button key={s.id} type="button" onClick={() => document.getElementById(`sec-${s.element_order}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{ display: "flex", gap: "0.5rem", padding: "0.4rem 0.5rem", width: "100%", border: "none", background: "transparent", cursor: "pointer", borderRadius: "var(--radius-md)", textAlign: "left" }}>
              <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)", flexShrink: 0 }}>{String(s.element_order).padStart(2, "0")}</span>
              <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.element_name}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
