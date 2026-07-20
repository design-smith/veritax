"use client"

import { useEffect, useRef, useState } from "react"
import { MessageSquarePlus, Download } from "lucide-react"
import type { SourceId } from "./planning"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CitationSource {
  id: number
  source: SourceId
  sourceLabel: string
  title: string
  excerpt: string
  reference: string
}

type SectionStatus = "drafted" | "edited" | "needs-attention"

interface DraftSection {
  id: string
  number: number
  title: string
  status: SectionStatus
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const CITATIONS: Record<number, CitationSource> = {
  1: { id: 1, source: "financials", sourceLabel: "Financials", title: "Annual Financial Statements FY2023", excerpt: "Revenue for the financial year ended 31 December 2023 was €24.3 million, representing a 12% increase over the prior year. The entity operates as a limited-risk distributor in the European market.", reference: "Notes to Financial Statements, p. 4" },
  2: { id: 2, source: "interview",  sourceLabel: "Interview",  title: "Management Interview — CEO", excerpt: "\"Our primary function is distribution and marketing within the DACH region. We do not perform any R&D, and IP ownership resides entirely with the US parent. We assume routine market risks only.\"", reference: "Interview transcript, 14:32" },
  3: { id: 3, source: "public",     sourceLabel: "Website",    title: "GlobalTech Inc. — About Us", excerpt: "GlobalTech develops and markets enterprise resource planning software for mid-market manufacturers across 40 countries. The DACH region accounted for 18% of group revenue in 2023.", reference: "globaltech.com/about, retrieved Jan 2024" },
  4: { id: 4, source: "agreements", sourceLabel: "Agreements", title: "Distribution Agreement — GlobalTech US / NL", excerpt: "Article 3.1: The Distributor shall purchase Products from the Principal at transfer prices set out in Schedule A, as amended from time to time by mutual agreement. Total product purchases in FY2023: €14.2 million.", reference: "Distribution Agreement (2019), Schedule A" },
  5: { id: 5, source: "agreements", sourceLabel: "Agreements", title: "Management Services Agreement", excerpt: "Services provided include strategic planning, HR, IT, and finance support. Fee: cost-plus 8% markup on total allocated costs. FY2023 total charge: €2.8 million.", reference: "Management Services Agreement (2021), Schedule B" },
  6: { id: 6, source: "agreements", sourceLabel: "Agreements", title: "Intercompany Loan Agreement", excerpt: "Loan principal: €2.1 million. Interest rate: EURIBOR + 150 basis points, payable semi-annually. Term: 5 years from drawdown date of 15 March 2021.", reference: "Intercompany Loan Agreement (2021), Article 4" },
  7: { id: 7, source: "interview",  sourceLabel: "Interview",  title: "Management Interview — CFO", excerpt: "\"The functional analysis is straightforward — we buy, we sell, we market. We don't own IP, we don't take development risk. Our risk profile is classic limited-risk distribution.\"", reference: "Interview transcript, 09:14" },
  8: { id: 8, source: "financials", sourceLabel: "Financials", title: "Annual Financial Statements FY2023", excerpt: "Operating result: −€291,000 (EBIT margin: −1.2%). Gross margin: 28.4%. The operating loss reflects elevated marketing costs incurred during a planned market expansion phase.", reference: "P&L Statement, p. 2" },
}

const SECTIONS: DraftSection[] = [
  { id: "s1", number: 1, title: "Local Entity Overview",    status: "drafted" },
  { id: "s2", number: 2, title: "Business Description",     status: "drafted" },
  { id: "s3", number: 3, title: "Controlled Transactions",  status: "needs-attention" },
  { id: "s4", number: 4, title: "Functional Analysis",      status: "drafted" },
  { id: "s5", number: 5, title: "Transfer Pricing Method",  status: "drafted" },
  { id: "s6", number: 6, title: "Economic Analysis",        status: "needs-attention" },
]

const STATUS_DOT: Record<SectionStatus, string> = {
  drafted:         "var(--green-400)",
  edited:          "var(--blue-400)",
  "needs-attention": "var(--red-400)",
}

const SOURCE_CHIP_CFG: Record<SourceId, { bg: string; text: string }> = {
  financials: { bg: "var(--color-background-success-soft)",   text: "var(--color-text-success-soft)" },
  agreements: { bg: "var(--color-background-info-soft)",      text: "var(--color-text-info-soft)" },
  public:     { bg: "var(--color-background-caution-soft)",   text: "var(--color-text-caution-soft)" },
  interview:  { bg: "var(--color-background-discovery-soft)", text: "var(--color-text-discovery-soft)" },
}

// ─── Citation mark ────────────────────────────────────────────────────────────

function Cite({ id, active, onSelect }: { id: number; active: boolean; onSelect: (id: number) => void }) {
  return (
    <sup onClick={() => onSelect(id)} style={{
      cursor: "pointer", userSelect: "none",
      fontSize: "10px", fontWeight: "var(--font-weight-semibold)",
      padding: "1px 4px", borderRadius: "3px", marginLeft: "1px",
      color: active ? "var(--color-text-info-solid)" : "var(--color-text-tertiary)",
      background: active ? "var(--color-background-info-soft)" : undefined,
      transition: "all var(--transition-duration-basic)",
    }}>{id}</sup>
  )
}

// ─── Instruct affordance ──────────────────────────────────────────────────────

function useSelectionAffordance(containerRef: React.RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onUp = () => {
      const sel = window.getSelection()
      const text = sel?.toString().trim()
      if (!text || !containerRef.current) { setPos(null); return }
      const anchorNode = sel?.anchorNode
      if (!anchorNode || !containerRef.current.contains(anchorNode)) { setPos(null); return }
      const range = sel!.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const cRect = containerRef.current.getBoundingClientRect()
      setPos({ x: rect.left - cRect.left + rect.width / 2, y: rect.top - cRect.top - 36 })
    }
    document.addEventListener("mouseup", onUp)
    return () => document.removeEventListener("mouseup", onUp)
  }, [containerRef])

  return pos
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DraftStep({ jurisdictions, entity, onContinue, sources: _sources }: {
  jurisdictions: string[]
  entity: string
  sources: Set<import("./planning").SourceId>
  onContinue: () => void
}) {
  const [activeSection, setActiveSection] = useState("s1")
  const [activeCitation, setActiveCitation] = useState<number | null>(null)
  const [activeJurisdiction, setActiveJurisdiction] = useState(jurisdictions[0] ?? "")
  const [instructInput, setInstructInput] = useState("")
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  const centerRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const instructPos = useSelectionAffordance(centerRef)

  const scrollTo = (id: string) => {
    setActiveSection(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const downloadDraft = () => {
    const title = `${entity || "Entity"} — ${activeJurisdiction || (jurisdictions[0] ?? "Draft")}`
    const body = docRef.current?.innerHTML ?? ""
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title>` +
      `<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:2.5rem auto;padding:0 1.25rem;line-height:1.65;color:#111}` +
      `h1{font-size:1.6rem}h2{font-size:1.15rem;margin-top:2rem}sup{color:#666;font-size:.7em}</style></head>` +
      `<body>${body}</body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${title.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const cite = (id: number) => {
    setActiveCitation(prev => prev === id ? null : id)
  }

  const activeCitationData = activeCitation ? CITATIONS[activeCitation] : null

  return (
    <div style={{ flex: 1, display: "flex", overflowY: "auto", borderTop: "1px solid var(--color-border)" }}>

      {/* Floating Sections nav — fixed in the right gutter; shifts left of the source panel when it's open */}
      {/* ponytail: 304px = 280px source panel + gap; 40px = clear of the centered doc when no panel */}
      <nav style={{
        position: "fixed", top: 96, right: activeCitationData ? 304 : 40, zIndex: 15,
        width: 210, maxHeight: "70vh", overflowY: "auto",
        background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-300)",
        padding: "0.75rem 0.5rem",
        display: "flex", flexDirection: "column", gap: 2,
        transition: "right 200ms ease",
      }}>
        <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: "var(--font-weight-medium)", padding: "0 0.5rem", marginBottom: "0.375rem" }}>
          Sections
        </p>
        {SECTIONS.map(sec => {
          const active = activeSection === sec.id
          return (
            <button key={sec.id} type="button" onClick={() => scrollTo(sec.id)}
              className={!active ? "hover:bg-[var(--color-background-primary-ghost-hover)]" : undefined}
              style={{
                display: "flex", alignItems: "center", gap: "0.625rem",
                padding: "0.5rem 0.5rem", textAlign: "left", width: "100%", border: "none",
                background: active ? "var(--color-background-primary-soft)" : "transparent",
                cursor: "pointer", borderRadius: "var(--radius-md)",
              }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_DOT[sec.status], flexShrink: 0 }} />
              <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", fontVariant: "tabular-nums", flexShrink: 0 }}>
                {String(sec.number).padStart(2, "0")}
              </span>
              <span style={{ fontSize: "var(--font-text-sm-size)", color: active ? "var(--color-text)" : "var(--color-text-secondary)", fontWeight: active ? "var(--font-weight-medium)" : "var(--font-weight-normal)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {sec.title}
              </span>
            </button>
          )
        })}

        {/* Download */}
        <div style={{ borderTop: "1px solid var(--color-border)", margin: "0.5rem 0.25rem 0", paddingTop: "0.5rem" }}>
          <button type="button" onClick={downloadDraft}
            className="hover:bg-[var(--color-background-primary-ghost-hover)]"
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.5rem", width: "100%", border: "none", background: "transparent",
              cursor: "pointer", borderRadius: "var(--radius-md)",
              fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", fontWeight: "var(--font-weight-medium)",
            }}>
            <Download size={14} style={{ flexShrink: 0 }} /> Download draft
          </button>
        </div>
      </nav>

      {/* Center — document */}
      <div ref={centerRef} style={{ flex: 1, position: "relative" }}>

        {/* Multi-jurisdiction selector */}
        {jurisdictions.length > 1 && (
          <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)", padding: "0.625rem 2.5rem", display: "flex", gap: "0.25rem" }}>
            {jurisdictions.map(j => (
              <button key={j} type="button" onClick={() => setActiveJurisdiction(j)} style={{
                padding: "0.25rem 0.75rem", borderRadius: "9999px", border: "none",
                background: activeJurisdiction === j ? "var(--color-background-primary-solid)" : "var(--alpha-06)",
                color: activeJurisdiction === j ? "var(--color-text-inverse)" : "var(--color-text-secondary)",
                fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
                cursor: "pointer", transition: "all var(--transition-duration-basic)",
              }}>{j}</button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", alignSelf: "center" }}>
              Generated from the same record
            </span>
          </div>
        )}

        {/* Instruct affordance */}
        {instructPos && (
          <div style={{
            position: "absolute", left: instructPos.x, top: instructPos.y,
            transform: "translateX(-50%)", zIndex: 20,
            background: "var(--color-surface-elevated)", border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-300)",
            display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.375rem 0.625rem",
            fontSize: "var(--font-text-xs-size)", color: "var(--color-text)",
            whiteSpace: "nowrap",
          }}>
            <MessageSquarePlus size={12} style={{ color: "var(--color-text-tertiary)" }} />
            <input
              type="text" placeholder="Instruct the tool to revise…" value={instructInput}
              onChange={e => setInstructInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") setInstructInput("") }}
              style={{ border: "none", outline: "none", background: "transparent", fontSize: "var(--font-text-xs-size)", color: "var(--color-text)", width: 200 }}
            />
          </div>
        )}

        {/* Document body */}
        <div style={{ padding: "2.5rem 3rem", maxWidth: 680, margin: "0 auto" }}>

          <div ref={docRef}>
          <div style={{ marginBottom: "2rem" }}>
            <h1 style={{ fontSize: "var(--font-text-2xl-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", margin: 0 }}>
              {entity || "Entity"} — {activeJurisdiction || (jurisdictions[0] ?? "Draft")}
            </h1>
            <p style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)", marginTop: "0.25rem" }}>
              Financial year ended 31 December 2023
            </p>
          </div>

          {/* Section 1 */}
          <section ref={el => { sectionRefs.current["s1"] = el }} style={{ marginBottom: "2.5rem", scrollMarginTop: "1rem" }}>
            <h2 style={{ fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", marginBottom: "0.75rem" }}>
              1. Local Entity Overview
            </h2>
            <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.75, color: "var(--color-text)", marginBottom: "0.75rem" }}>
              The entity is a limited-liability company incorporated in the Netherlands in 2015. It forms part of the group&apos;s European distribution network and is wholly owned by the US parent, GlobalTech Inc.<Cite id={1} active={activeCitation === 1} onSelect={cite} /> The entity employs 47 full-time staff and generated net revenue of €24.3 million in the financial year ended 31 December 2023.
            </p>
            <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.75, color: "var(--color-text)" }}>
              The entity&apos;s principal activities are the distribution and marketing of the group&apos;s enterprise software products. Management and strategic direction are provided by a five-person board,<Cite id={2} active={activeCitation === 2} onSelect={cite} /> with day-to-day operations overseen by a local CEO reporting to the group CFO.
            </p>
          </section>

          {/* Section 2 */}
          <section ref={el => { sectionRefs.current["s2"] = el }} style={{ marginBottom: "2.5rem", scrollMarginTop: "1rem" }}>
            <h2 style={{ fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", marginBottom: "0.75rem" }}>
              2. Business Description
            </h2>
            <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.75, color: "var(--color-text)", marginBottom: "0.75rem" }}>
              The entity&apos;s principal activity is the distribution and marketing of the group&apos;s enterprise software products within the DACH region (Germany, Austria, Switzerland).<Cite id={3} active={activeCitation === 3} onSelect={cite} /> It operates under a limited-risk distribution model, bearing routine market and credit risk while all significant risks — including IP, development, and strategic risk — are borne by the US parent.
            </p>
            <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.75, color: "var(--color-text)" }}>
              The entity maintains a direct sales force and provides first-level customer support. It does not conduct research or development activities, holds no proprietary intangible assets, and operates exclusively under licences granted by the US parent.<Cite id={2} active={activeCitation === 2} onSelect={cite} />
            </p>
          </section>

          {/* Section 3 */}
          <section ref={el => { sectionRefs.current["s3"] = el }} style={{ marginBottom: "2.5rem", scrollMarginTop: "1rem" }}>
            <h2 style={{ fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", marginBottom: "0.75rem" }}>
              3. Controlled Transactions
            </h2>
            <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.75, color: "var(--color-text)", marginBottom: "0.75rem" }}>
              During FY2023, the entity entered into the following principal intercompany transactions: (i) purchase of finished goods and software licences from GlobalTech US at a transfer price of €14.2 million;<Cite id={4} active={activeCitation === 4} onSelect={cite} /> (ii) receipt of management and support services at cost-plus 8% totalling €2.8 million;<Cite id={5} active={activeCitation === 5} onSelect={cite} /> and (iii) interest payments on an intercompany loan of €2.1 million at EURIBOR + 150bps.<Cite id={6} active={activeCitation === 6} onSelect={cite} />
            </p>
            <div style={{ padding: "0.75rem 1rem", background: "var(--color-background-danger-soft)", borderRadius: "var(--radius-md)", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-danger-soft)" }}>
              ⚠ No benefit test documentation found for management services charge — see Risks section.
            </div>
          </section>

          {/* Section 4 */}
          <section ref={el => { sectionRefs.current["s4"] = el }} style={{ marginBottom: "2.5rem", scrollMarginTop: "1rem" }}>
            <h2 style={{ fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", marginBottom: "0.75rem" }}>
              4. Functional Analysis
            </h2>
            <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.75, color: "var(--color-text)", marginBottom: "0.75rem" }}>
              The entity performs distribution, sales, and customer service functions.<Cite id={7} active={activeCitation === 7} onSelect={cite} /> It employs a direct sales force and maintains customer relationships in the DACH region. The entity does not perform research or development activities and holds no intangible property.
            </p>
            <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.75, color: "var(--color-text)" }}>
              All significant development, enhancement, maintenance, protection, and exploitation ("DEMPE") functions are performed by the US parent.<Cite id={2} active={activeCitation === 2} onSelect={cite} /> The entity assumes routine market and credit risk only; all residual risks are contractually borne by GlobalTech Inc.<Cite id={4} active={activeCitation === 4} onSelect={cite} />
            </p>
          </section>

          {/* Section 5 */}
          <section ref={el => { sectionRefs.current["s5"] = el }} style={{ marginBottom: "2.5rem", scrollMarginTop: "1rem" }}>
            <h2 style={{ fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", marginBottom: "0.75rem" }}>
              5. Transfer Pricing Method
            </h2>
            <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.75, color: "var(--color-text)", marginBottom: "0.75rem" }}>
              The transactional net margin method (TNMM) has been selected as the most appropriate TP method for the distribution activities, with operating margin as the profit level indicator.<Cite id={5} active={activeCitation === 5} onSelect={cite} /> The TNMM is appropriate because the entity is the less complex party, its financials are the most reliable, and comparable data for similar limited-risk distributors is widely available.
            </p>
            <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.75, color: "var(--color-text)" }}>
              The comparable uncontrolled price method has been considered but rejected for the product purchases, as the terms and conditions of the intercompany arrangements differ materially from available external comparables in ways that cannot be reliably adjusted.
            </p>
          </section>

          {/* Section 6 */}
          <section ref={el => { sectionRefs.current["s6"] = el }} style={{ marginBottom: "2.5rem", scrollMarginTop: "1rem" }}>
            <h2 style={{ fontSize: "var(--font-text-lg-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", marginBottom: "0.75rem" }}>
              6. Economic Analysis
            </h2>
            <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.75, color: "var(--color-text)", marginBottom: "0.75rem" }}>
              A benchmarking study identified 28 independent European software distributors. After applying comparability screens (revenue €5M–€200M, five-year data availability, independent ownership), 12 comparables were retained.<Cite id={4} active={activeCitation === 4} onSelect={cite} /> The interquartile range of operating margins was 1.8% to 5.4%, with a median of 3.1%.
            </p>
            <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.75, color: "var(--color-text)", marginBottom: "0.75rem" }}>
              The entity&apos;s FY2023 operating margin of −1.2%<Cite id={8} active={activeCitation === 8} onSelect={cite} /> falls below the lower quartile of the arm&apos;s length range. This result requires analysis as to whether it reflects genuine commercial conditions or a transfer pricing adjustment risk.
            </p>
            <div style={{ padding: "0.75rem 1rem", background: "var(--color-background-danger-soft)", borderRadius: "var(--radius-md)", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-danger-soft)" }}>
              ⚠ Operating result falls below arm&apos;s length range — adjustment risk. See Risks section.
            </div>
          </section>
          </div>

        </div>
      </div>

      {/* Right panel — source context (only when a citation is active) */}
      {activeCitationData && (
      <aside style={{
        width: 280, flexShrink: 0, borderLeft: "1px solid var(--color-border)",
        background: "var(--color-surface-secondary)", overflowY: "auto",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh",
      }}>
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{
                padding: "2px 8px", borderRadius: "9999px", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)",
                background: SOURCE_CHIP_CFG[activeCitationData.source].bg,
                color: SOURCE_CHIP_CFG[activeCitationData.source].text,
              }}>{activeCitationData.sourceLabel}</span>
              <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", fontVariant: "tabular-nums" }}>
                [{activeCitationData.id}]
              </span>
            </div>
            <div>
              <p style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)", margin: "0 0 0.25rem" }}>
                {activeCitationData.title}
              </p>
              <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: 0 }}>
                {activeCitationData.reference}
              </p>
            </div>
            <div style={{ background: "var(--color-background-primary-soft)", borderLeft: "3px solid var(--color-background-primary-solid)", borderRadius: "0 var(--radius-sm) var(--radius-sm) 0", padding: "0.625rem 0.75rem" }}>
              <p style={{ fontSize: "var(--font-text-sm-size)", lineHeight: 1.65, color: "var(--color-text)", margin: 0, fontStyle: "italic" }}>
                {activeCitationData.excerpt}
              </p>
            </div>
            <button type="button" style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, textDecoration: "underline", textUnderlineOffset: "2px" }}>
              Open source document ↗
            </button>
          </div>
      </aside>
      )}

    </div>
  )
}
