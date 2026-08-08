"use client"

// Static demo of the Draft stage — renders the prefilled Local File exactly like the real draft view
// (cover + Sections sidebar + A4 pages + tables) but with NO api/auth/step imports. Display-only.

import { useRef, useState, type CSSProperties } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { DEMO_COVER, DEMO_SECTIONS, type DemoTable } from "./localFileDemo"

function TableView({ t }: { t: DemoTable }) {
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

export default function DemoDraft() {
  const [activeId, setActiveId] = useState("cover")
  const scrollRef = useRef<HTMLDivElement>(null)

  function scrollTo(id: string) {
    setActiveId(id)
    scrollRef.current?.querySelector<HTMLElement>(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const navItem = (id: string): CSSProperties => ({
    display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.45rem 0.5rem", width: "100%", border: "none",
    background: activeId === id ? "var(--color-background-primary-soft)" : "transparent",
    cursor: "pointer", borderRadius: "var(--radius-md)", textAlign: "left",
  })

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", minWidth: 0 }}>
      {/* Sections nav */}
      <nav style={{ width: 224, flexShrink: 0, borderRight: "1px solid var(--color-border)", background: "var(--color-surface)", overflowY: "auto", padding: "1rem 0.5rem" }}>
        <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: "var(--font-weight-medium)", padding: "0 0.5rem", marginBottom: "0.375rem" }}>Sections</p>
        <button type="button" onClick={() => scrollTo("draft-cover-page")} style={navItem("cover")}>
          <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)", flexShrink: 0 }}>00</span>
          <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Cover</span>
        </button>
        {DEMO_SECTIONS.map(s => {
          const id = `draft-section-${s.order}`
          return (
            <button key={s.order} type="button" onClick={() => scrollTo(id)} style={navItem(id)}>
              <span style={{ fontSize: "10px", color: "var(--color-text-tertiary)", flexShrink: 0 }}>{String(s.order).padStart(2, "0")}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: "var(--font-text-xs-size)", color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
            </button>
          )
        })}
      </nav>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div ref={scrollRef} className="vt-a4-scroll">
          {/* Cover */}
          <article id="draft-cover-page" className="vt-a4-page">
            <header style={{ minHeight: "230mm", display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "center", padding: "1rem 0 2.25rem", color: "var(--color-text)" }}>
              <div style={{ fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-medium)" }}>Veritax</div>
              <div>
                <h1 style={{ fontSize: "34px", lineHeight: 1.08, fontWeight: 300, letterSpacing: 0, color: "var(--color-text)", margin: "0 0 0.875rem" }}>{DEMO_COVER.title}</h1>
                <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)", margin: 0 }}>{DEMO_COVER.period}</p>
              </div>
              <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", margin: "0 auto", width: "min(100%, 560px)", textAlign: "left" }}>
                <div>
                  <dt style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: "0.375rem" }}>Entity</dt>
                  <dd style={{ margin: 0, fontSize: "16px", color: "var(--color-text)" }}>{DEMO_COVER.entity}</dd>
                </div>
                <div>
                  <dt style={{ fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-text-tertiary)", marginBottom: "0.375rem" }}>Jurisdiction</dt>
                  <dd style={{ margin: 0, fontSize: "16px", color: "var(--color-text)" }}>{DEMO_COVER.jurisdiction}</dd>
                </div>
              </dl>
              <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: 0 }}>Prepared by Veritax · {DEMO_COVER.prepared}</p>
            </header>
          </article>

          {/* Sections */}
          {DEMO_SECTIONS.map(s => (
            <article key={s.order} id={`draft-section-${s.order}`} className="vt-a4-page">
              <h2 style={{ fontSize: "18px", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: "0 0 0.5rem" }}>
                {s.order}. {s.title}
              </h2>
              <div className="tp-draft">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.body}</ReactMarkdown>
              </div>
              {s.tables?.map((t, i) => <TableView key={i} t={t} />)}
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}
