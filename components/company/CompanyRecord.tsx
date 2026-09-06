"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { geoCentroid, geoEquirectangular, geoPath } from "d3-geo"
import type { FeatureCollection, Geometry } from "geojson"
import { ArrowLeft, Check, ChevronDown, Download, ExternalLink, Minus, Search, Star } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  compact, getFinancials, getFootprint, getGroup, getIP, getProfile, money,
  type CompanyProfile, type Financials, type Footprint, type Group, type IP, type KeyMetric,
} from "@/lib/companies"
import { useSavedCompanies } from "@/lib/saved-companies"
import { SelectControl } from "@/components/ui/select-control"
import { computePLIs, lines, periodTotals, PLIS, yearsAvailable } from "@/lib/tp"
import { downloadCompanyJSON, downloadCompanyZip, downloadFinancialsCSV } from "@/components/company/download"

const TABS = [
  ["identity", "Identity"], ["business", "Business & Operations"],
  ["financials", "Financials"], ["structure", "Group Structure & Footprint"],
  ["ip", "Intellectual Property"], ["sources", "Sources & Confidence"],
] as const
type TabId = typeof TABS[number][0]

const CARD: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-surface)", padding: "1rem 1.25rem" }
const H: React.CSSProperties = { fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-tertiary)", margin: "0 0 0.75rem" }

export default function CompanyRecord({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>("identity")
  const [saved, toggleSave] = useSavedCompanies()
  // lazy per-tab artifacts
  const [fin, setFin] = useState<Financials | null>(null)
  const [foot, setFoot] = useState<Footprint | null>(null)
  const [ip, setIP] = useState<IP | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [dlOpen, setDlOpen] = useState(false)
  const [dling, setDling] = useState(false)

  useEffect(() => {
    let live = true
    setProfile(null); setError(null); setTab("identity"); setFin(null); setFoot(null); setIP(null); setGroup(null)
    getProfile(slug).then(p => { if (live) setProfile(p) }).catch(() => { if (live) setError("Couldn’t load this company.") })
    return () => { live = false }
  }, [slug])
  useEffect(() => { if (tab === "financials" && !fin) getFinancials(slug).then(setFin).catch(() => {}) }, [tab, slug, fin])
  useEffect(() => { if (tab === "structure" && !foot) getFootprint(slug).then(setFoot).catch(() => {}) }, [tab, slug, foot])
  useEffect(() => { if (tab === "structure" && !group) getGroup(slug).then(setGroup).catch(() => {}) }, [tab, slug, group])
  useEffect(() => { if (tab === "ip" && !ip) getIP(slug).then(setIP).catch(() => {}) }, [tab, slug, ip])

  if (error) return <Centered>{error}</Centered>
  if (!profile) return <Centered>Loading…</Centered>

  const id = profile.identity, hq = id.headquarters
  const place = hq ? [hq.city, hq.country ?? id.jurisdiction].filter(Boolean).join(", ") : (id.jurisdiction ?? "")
  const active = (id.entity_status ?? "").toLowerCase() === "active"
  const isSaved = saved.has(slug)

  async function runDownload(kind: "zip" | "json") {
    setDlOpen(false); setDling(true)
    try {
      const [f, ft, i, g] = await Promise.all([
        fin ?? getFinancials(slug), foot ?? getFootprint(slug), ip ?? getIP(slug), group ?? getGroup(slug),
      ])
      const bundle = { profile: profile!, financials: f, footprint: ft, ip: i, group: g }
      if (kind === "json") downloadCompanyJSON(slug, bundle)
      else await downloadCompanyZip(slug, bundle)
    } finally { setDling(false) }
  }

  return (
    <div style={{ flex: 1, minWidth: 0, overflowY: "auto", overflowX: "hidden", background: "var(--color-canvas, #fff)" }}>
      <div style={{ maxWidth: 1040, width: "100%", boxSizing: "border-box", minWidth: 0, margin: "0 auto", padding: "1.5rem 2rem 3rem" }}>
        <button type="button" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-secondary)", fontSize: "var(--font-text-sm-size)", padding: 0, marginBottom: "1.25rem" }}>
          <ArrowLeft size={15} strokeWidth={1.5} /> Back to search
        </button>

        {/* header line: name + status (left), actions (right) */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-tertiary)", marginBottom: 4 }}>Company record</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "var(--font-heading-lg-size, 26px)", fontWeight: "var(--font-weight-semibold)", margin: 0, color: "var(--color-text)" }}>{id.legal_name}</h1>
              {id.entity_status && <StatusPill active={active} label={id.entity_status} />}
            </div>
            {place && <p style={{ fontSize: "var(--font-text-md-size)", color: "var(--color-text-secondary)", margin: "0.35rem 0 0" }}>{place}{id.listings[0]?.ticker ? `  ·  ${id.listings[0].ticker}${id.listings[0].exchange ? " (" + id.listings[0].exchange + ")" : ""}` : ""}</p>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" onClick={() => toggleSave(slug)} title={isSaved ? "Saved" : "Save"} style={{ ...btn, gap: 6 }}>
              <Star size={15} strokeWidth={1.5} style={{ color: isSaved ? "#f5a623" : "var(--color-text-secondary)", fill: isSaved ? "#f5a623" : "none" }} /> {isSaved ? "Saved" : "Save"}
            </button>
            <div style={{ position: "relative" }}>
              <button type="button" onClick={() => setDlOpen(o => !o)} disabled={dling} style={{ ...btn, gap: 6 }}>
                <Download size={15} strokeWidth={1.5} /> {dling ? "Preparing…" : "Download"} <ChevronDown size={13} />
              </button>
              {dlOpen && (
                <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 20, background: "var(--color-surface-elevated, #fff)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-300)", minWidth: 190, overflow: "hidden" }}>
                  <MenuItem onClick={() => runDownload("zip")}>ZIP — a file per step</MenuItem>
                  <MenuItem onClick={() => runDownload("json")}>JSON — raw data</MenuItem>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* tabs */}
        <nav style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", borderBottom: "1px solid var(--color-border)", margin: "1.5rem 0 1.75rem" }}>
          {TABS.map(([tid, label]) => {
            const on = tab === tid
            return <button key={tid} type="button" onClick={() => setTab(tid)} style={{ padding: "0.6rem 0.9rem", border: "none", background: "transparent", marginBottom: -1, borderBottom: on ? "2px solid var(--color-text)" : "2px solid transparent", color: on ? "var(--color-text)" : "var(--color-text-tertiary)", fontSize: "13px", fontWeight: on ? 600 : 400, cursor: "pointer" }}>{label}</button>
          })}
        </nav>

        {tab === "identity" && <Identity p={profile} />}
        {tab === "business" && <Business p={profile} />}
        {tab === "financials" && <FinancialsTab p={profile} fin={fin} />}
        {tab === "structure" && <StructureTab p={profile} foot={foot} group={group} />}
        {tab === "ip" && <IPTab ip={ip} summary={profile.ip_summary} />}
        {tab === "sources" && <Sources p={profile} />}
      </div>
    </div>
  )
}

// ---------------- Identity ----------------
function Identity({ p }: { p: CompanyProfile }) {
  const id = p.identity, hq = id.headquarters, c = p.classification
  const office = hq ? [hq.address_line, hq.city, hq.region, hq.postal_code, hq.country].filter(Boolean).join(", ") : ""
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <section><h2 style={H}>Identity</h2>
        <FieldCard>
          <Field label="Legal name">{id.legal_name}</Field>
          <Field label="Former names">{id.former_names.length ? id.former_names.join(", ") : null}</Field>
          <Field label="Entity type">{id.entity_type?.replace(/_/g, " ")}</Field>
          <Field label="Status">{id.entity_status}</Field>
          <Field label="Incorporation jurisdiction">{id.jurisdiction}</Field>
          <Field label="Headquarters">{office || null}</Field>
          <Field label="Website">{id.website}</Field>
          <Field label="Industry">{c.sic_description}</Field>
          <Field label="SIC">{c.sic}</Field>
          <Field label={`NAICS${c.approximate ? " (approx.)" : ""}`}>{c.naics ? `${c.naics} · ${c.naics_label}` : null}</Field>
          <Field label={`NACE${c.approximate ? " (approx.)" : ""}`}>{c.nace ? `${c.nace} · ${c.nace_label}` : null}</Field>
          <Field label="Sector">{c.sector}</Field>
        </FieldCard>
      </section>
      <section><h2 style={H}>Listings & identifiers</h2>
        <FieldCard>
          <Field label="Ticker">{id.listings[0]?.ticker}</Field>
          <Field label="Exchange">{id.listings[0]?.exchange}</Field>
          <Field label="CIK">{id.cik}</Field>
          <Field label="LEI">{id.lei}</Field>
          <Field label="SEC file number">{id.sec_file_number}</Field>
        </FieldCard>
      </section>
      <section><h2 style={H}>Characteristics</h2>
        <FieldCard>
          <Field label="Public / private">{id.entity_type === "public_company" ? "Public" : id.entity_type?.replace(/_/g, " ")}</Field>
          <Field label="Company position">{id.is_subsidiary ? "Controlled subsidiary" : "Ultimate parent / independent"}</Field>
          <Field label="Immediate parent">{id.is_subsidiary ? id.parent_legal_name : null}</Field>
          <Field label="Consolidated">{null}</Field>
        </FieldCard>
      </section>
    </div>
  )
}

// ---------------- Business & Operations ----------------
function Business({ p }: { p: CompanyProfile }) {
  const b = p.business
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      {b.description && <section><h2 style={H}>Business description</h2><div style={CARD}><p style={{ margin: 0, fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{b.description}</p></div></section>}
      <section><h2 style={H}>Activities (evidence-backed)</h2>
        {b.activity_tags.length ? (
          <div style={{ ...CARD, display: "grid", gap: "0.7rem" }}>
            {b.activity_tags.map(t => (
              <div key={t.tag} style={{ display: "flex", gap: "0.7rem", alignItems: "baseline" }}>
                <Pill>{t.tag}</Pill>
                <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>“{t.evidence}”</span>
              </div>
            ))}
          </div>
        ) : <NotResearched what="activity classification" />}
      </section>
      {b.segments.length > 0 && <section><h2 style={H}>Reportable segments</h2><div style={{ ...CARD, display: "grid", gap: "0.6rem" }}>{b.segments.map((s, i) => <p key={i} style={{ margin: 0, fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{s}</p>)}</div></section>}
      <section><h2 style={H}>R&D</h2>
        <FieldCard>
          <Field label="Conducts R&D">{b.rnd.conducts ? "Yes" : "No"}</Field>
          <Field label="R&D spend">{b.rnd.spend != null ? money(b.rnd.spend, p.financials_currency) : null}</Field>
          <Field label="Employees">{b.employees != null ? b.employees.toLocaleString() : null}</Field>
        </FieldCard>
        {b.rnd.description && <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: "0.5rem 0 0" }}>{b.rnd.description}</p>}
      </section>
      <section><h2 style={H}>Operational footprint</h2><NotResearched what="facility, manufacturing and R&D locations" /></section>
    </div>
  )
}

// ---------------- Financials ----------------
function FinancialsTab({ p, fin }: { p: CompanyProfile; fin: Financials | null }) {
  return (
    <div style={{ display: "grid", gap: "1.5rem", minWidth: 0, maxWidth: "100%" }}>
      <section><h2 style={H}>Headline metrics · latest fiscal year</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "0.75rem" }}>
          {p.key_metrics.map((m: KeyMetric) => (
            <div key={m.label} style={CARD}>
              <div style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: "20px", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)" }}>{money(m.value, m.currency, m.unit)}</div>
              <div style={{ fontSize: "11px", color: "var(--color-text-tertiary)", marginTop: 4 }}>FY{m.fy}</div>
            </div>
          ))}
        </div>
      </section>

      <section><h2 style={H}>Key financials · all years</h2>
        {fin ? <KeyFinancials fin={fin} /> : <Centered>Loading…</Centered>}
      </section>

      {fin && <TPAnalysis slug={p.slug} fin={fin} />}

      <section><h2 style={H}>Normalized facts · {fin?.standard || p.accounting_standard} ({p.facts_count.toLocaleString()} facts)</h2>
        {fin ? <Pivot fin={fin} /> : <Centered>Loading facts…</Centered>}
      </section>
    </div>
  )
}

// Transfer-pricing analysis: pick a multi-year period → pooled weighted-average financials + PLIs.
const tpTh: React.CSSProperties = { padding: "0.4rem 0.6rem", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--color-text-tertiary)", borderBottom: "1px solid var(--color-border)" }
const tpTd: React.CSSProperties = { padding: "0.4rem 0.6rem", fontSize: "var(--font-text-sm-size)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap" }
const fmtPLI = (v: number | null, kind: "pct" | "ratio") => v == null ? "—" : kind === "pct" ? (v * 100).toFixed(2) + "%" : v.toFixed(2)

function StatMini({ label, value }: { label: string; value: React.ReactNode }) {
  return <div style={{ ...CARD, padding: "0.75rem 0.9rem" }}><div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: 3 }}>{label}</div><div style={{ fontSize: 18, fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)" }}>{value}</div></div>
}

function YearRange({ years, value, onChange }: { years: number[]; value: [number, number]; onChange: (v: [number, number]) => void }) {
  if (years.length < 2) return null
  const max = years.length - 1
  const i0 = Math.max(0, years.indexOf(value[0])), i1 = years.indexOf(value[1]) < 0 ? max : years.indexOf(value[1])
  return (
    <div className="vt-range">
      <div className="vt-range-track"><div className="vt-range-fill" style={{ left: `${(i0 / max) * 100}%`, right: `${100 - (i1 / max) * 100}%` }} /></div>
      <input type="range" className="vt-range-input" min={0} max={max} value={i0} aria-label="Start year" onChange={e => { const j = Math.min(Number(e.target.value), i1); onChange([years[j], years[i1]]) }} />
      <input type="range" className="vt-range-input" min={0} max={max} value={i1} aria-label="End year" onChange={e => { const j = Math.max(Number(e.target.value), i0); onChange([years[i0], years[j]]) }} />
    </div>
  )
}

function TPAnalysis({ slug, fin }: { slug: string; fin: Financials }) {
  const L = useMemo(() => lines(fin), [fin])
  const years = useMemo(() => yearsAvailable(fin), [fin])
  const [range, setRange] = useState<[number, number] | null>(null)
  const [pliKey, setPliKey] = useState("op_margin")
  useEffect(() => {
    if (!years.length) { setRange(null); return }
    setRange([years[Math.max(0, years.length - 3)], years[years.length - 1]])
  }, [years])

  if (!years.length) return <section><h2 style={H}>Transfer-pricing analysis</h2><NotResearched what="annual financials for a multi-year analysis" /></section>
  const [y0, y1] = range ?? [years[0], years[years.length - 1]]
  const sel = years.filter(y => y >= y0 && y <= y1)
  const totals = periodTotals(L, sel)
  const plis = computePLIs(L, sel)
  const active = plis.find(p => p.key === pliKey) ?? plis[0]
  const cur = fin.currency
  const span = `FY${y0}${y1 !== y0 ? `–FY${y1}` : ""}`

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <h2 style={{ ...H, margin: 0 }}>Transfer-pricing analysis</h2>
        <button type="button" style={{ ...btn, gap: 6 }} onClick={() => downloadFinancialsCSV(slug, fin, sel)}><Download size={14} strokeWidth={1.5} /> Financials (CSV)</button>
      </div>

      <div style={{ ...CARD, marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: years.length > 1 ? "0.6rem" : 0 }}>
          <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)" }}>Analysis period · {sel.length} {sel.length === 1 ? "year" : "years"}</span>
          <span style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)" }}>{span}</span>
        </div>
        <YearRange years={years} value={[y0, y1]} onChange={setRange} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        <StatMini label={`Revenue · ${sel.length}y total`} value={money(totals.revenue, cur)} />
        <StatMini label="EBIT · total" value={money(totals.ebit, cur)} />
        <StatMini label="Net income · total" value={money(totals.netIncome, cur)} />
        <StatMini label="Operating margin" value={fmtPLI(totals.opMargin, "pct")} />
        <StatMini label="Net margin" value={fmtPLI(totals.netMargin, "pct")} />
      </div>

      <div style={CARD}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)" }}>PLI</span>
          <SelectControl size="sm" variant="outline" value={pliKey} onValueChange={setPliKey}>
            {PLIS.map(pl => <SelectControl.Item key={pl.key} value={pl.key}>{pl.label} · {pl.short}</SelectControl.Item>)}
          </SelectControl>
          <span style={{ marginLeft: "auto", fontSize: 24, fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>{fmtPLI(active.value, active.kind)}</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginBottom: "0.6rem" }}>Pooled weighted average · {span} · {active.short}</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={tpTh}>Fiscal year</th><th style={{ ...tpTh, textAlign: "right" }}>Numerator</th><th style={{ ...tpTh, textAlign: "right" }}>Denominator</th><th style={{ ...tpTh, textAlign: "right" }}>Ratio</th></tr></thead>
            <tbody>
              {active.perYear.map(r => (
                <tr key={r.year}>
                  <td style={tpTd}>FY{r.year}</td>
                  <td style={{ ...tpTd, textAlign: "right" }}>{money(r.num, cur)}</td>
                  <td style={{ ...tpTd, textAlign: "right" }}>{money(r.den, cur)}</td>
                  <td style={{ ...tpTd, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtPLI(r.ratio, active.kind)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...tpTd, fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)" }}>Weighted (pooled)</td>
                <td style={{ ...tpTd, textAlign: "right", fontWeight: "var(--font-weight-medium)" }}>{money(active.sumNum, cur)}</td>
                <td style={{ ...tpTd, textAlign: "right", fontWeight: "var(--font-weight-medium)" }}>{money(active.sumDen, cur)}</td>
                <td style={{ ...tpTd, textAlign: "right", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>{fmtPLI(active.value, active.kind)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "0.75rem 0 0", lineHeight: 1.5 }}>PLIs indicate profitability, not comparability — screen candidates qualitatively; don&apos;t pick comparables just to hit a target margin.</p>
      </div>
    </section>
  )
}

// Curated financial highlights: line items as rows, fiscal years as columns, YoY change under each.
const LINE_ITEMS: [string, string[]][] = [
  ["Revenue", ["us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax", "us-gaap:Revenues", "us-gaap:SalesRevenueNet", "ifrs-full:Revenue"]],
  ["Gross profit", ["us-gaap:GrossProfit", "ifrs-full:GrossProfit"]],
  ["EBITDA", ["__ebitda__"]],
  ["Operating income (EBIT)", ["us-gaap:OperatingIncomeLoss", "ifrs-full:ProfitLossFromOperatingActivities"]],
  ["Interest expense", ["us-gaap:InterestExpense", "us-gaap:InterestExpenseNonoperating", "ifrs-full:InterestExpense"]],
  ["Pre-tax income (EBT)", ["us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", "us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments", "ifrs-full:ProfitLossBeforeTax"]],
  ["Net income", ["us-gaap:NetIncomeLoss", "ifrs-full:ProfitLoss"]],
  ["R&D expense", ["us-gaap:ResearchAndDevelopmentExpense", "ifrs-full:ResearchAndDevelopmentExpense"]],
  ["Total assets", ["us-gaap:Assets", "ifrs-full:Assets"]],
  ["Total equity", ["us-gaap:StockholdersEquity", "ifrs-full:Equity"]],
  ["Operating cash flow", ["us-gaap:NetCashProvidedByUsedInOperatingActivities", "ifrs-full:CashFlowsFromUsedInOperatingActivities"]],
]
const DA_CONCEPTS = ["us-gaap:DepreciationDepletionAndAmortization", "us-gaap:DepreciationAmortizationAndAccretionNet", "ifrs-full:DepreciationAndAmortisationExpense"]

function KeyFinancials({ fin }: { fin: Financials }) {
  const byConcept = useMemo(() => new Map(fin.rows.map(r => [r.concept, r.values])), [fin])
  const pick = (concepts: string[]) => { for (const c of concepts) { const v = byConcept.get(c); if (v) return v } return null }
  const ebit = pick(["us-gaap:OperatingIncomeLoss", "ifrs-full:ProfitLossFromOperatingActivities"])
  const da = pick(DA_CONCEPTS)

  const rows = LINE_ITEMS.map(([label, concepts]) => {
    let vals: Record<string, number | null> | null
    if (concepts[0] === "__ebitda__") {
      if (!ebit || !da) vals = null
      else { vals = {}; for (const y of Object.keys(ebit)) vals[y] = (ebit[y] != null && da[y] != null) ? (ebit[y]! + da[y]!) : null }
    } else vals = pick(concepts)
    return { label, vals }
  }).filter(r => r.vals && Object.values(r.vals).some(v => v != null)) as { label: string; vals: Record<string, number | null> }[]

  const years = [...new Set(rows.flatMap(r => Object.keys(r.vals)))].map(Number).sort((a, b) => a - b)
  if (!years.length) return <Centered>No annual figures available.</Centered>

  const stickyL: React.CSSProperties = { position: "sticky", left: 0, zIndex: 1, background: "var(--color-surface)" }
  const th: React.CSSProperties = { padding: "0.5rem 0.9rem", textAlign: "right", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--color-text-tertiary)", borderBottom: "1px solid var(--color-border)", whiteSpace: "nowrap", position: "sticky", top: 0, background: "var(--color-surface)" }
  const td: React.CSSProperties = { padding: "0.5rem 0.9rem", textAlign: "right", fontSize: "var(--font-text-sm-size)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }

  return (
    <div>
      <div style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", marginBottom: 6 }}>{fin.standard} · {fin.currency || "reported currency"} · figures abbreviated (K/M/B)</div>
      <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left", ...stickyL, zIndex: 2 }}>Fiscal year</th>
                {years.map(y => <th key={y} style={th}>{y}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <Fragment key={r.label}>
                  <tr>
                    <td style={{ ...td, textAlign: "left", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)", borderTop: "1px solid var(--color-border)", ...stickyL }}>{r.label}</td>
                    {years.map(y => <td key={y} style={{ ...td, color: "var(--color-text)", borderTop: "1px solid var(--color-border)" }}>{r.vals[y] != null ? money(r.vals[y], fin.currency) : "—"}</td>)}
                  </tr>
                  <tr>
                    <td style={{ ...td, textAlign: "left", fontStyle: "italic", fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", ...stickyL }}>Change</td>
                    {years.map((y, i) => {
                      const prev = i > 0 ? r.vals[years[i - 1]] : null, cur = r.vals[y]
                      const c = (i === 0 || cur == null || prev == null || prev === 0) ? null : (cur - prev) / Math.abs(prev)
                      return <td key={y} style={{ ...td, fontStyle: "italic", fontSize: "var(--font-text-xs-size)", color: c == null ? "var(--color-text-tertiary)" : c >= 0 ? "var(--color-text-success, #137333)" : "#b91c1c" }}>{c == null ? "" : `${c >= 0 ? "+" : ""}${(c * 100).toFixed(2)}%`}</td>
                    })}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Pivot({ fin }: { fin: Financials }) {
  const [q, setQ] = useState("")
  const [stmt, setStmt] = useState<string>("all")
  const years = useMemo(() => [...new Set(fin.rows.flatMap(r => Object.keys(r.values)))].map(Number).sort((a, b) => b - a).slice(0, 8), [fin])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return fin.rows.filter(r => (stmt === "all" || r.statement === stmt) && (!needle || (r.label || "").toLowerCase().includes(needle) || r.concept.toLowerCase().includes(needle)))
  }, [fin, q, stmt])
  const STMTS = [["all", "All"], ["income", "Income"], ["balance", "Balance sheet"], ["cashflow", "Cash flow"], ["other", "Other"]]
  const th: React.CSSProperties = { padding: "0.4rem 0.6rem", fontSize: "11px", textTransform: "uppercase", color: "var(--color-text-tertiary)", borderBottom: "1px solid var(--color-border)", position: "sticky", top: 0, background: "var(--color-surface)", textAlign: "right", whiteSpace: "nowrap" }
  const cell: React.CSSProperties = { padding: "0.4rem 0.6rem", fontSize: "var(--font-text-sm-size)", borderBottom: "1px solid var(--color-border)", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }
  return (
    <div style={{ minWidth: 0, maxWidth: "100%" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
          <Search size={14} strokeWidth={1.5} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-tertiary)" }} />
          <Input controlSize="sm" placeholder="Filter concept…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        <select value={stmt} onChange={e => setStmt(e.target.value)} style={{ height: "var(--control-size-sm)", borderRadius: "var(--control-radius-sm)", border: "1px solid var(--input-outline-border-color)", background: "transparent", color: "var(--color-text)", fontSize: "var(--control-font-size-sm)", padding: "0 0.6rem" }}>
          {STMTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden", minWidth: 0, maxWidth: "100%" }}>
        <div style={{ maxHeight: 460, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead><tr><th style={{ ...th, textAlign: "left" }}>Concept</th>{years.map(y => <th key={y} style={th}>FY{y}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.concept}>
                  <td style={{ ...cell, textAlign: "left", maxWidth: 280, whiteSpace: "normal", overflowWrap: "anywhere" }}>{r.label || r.concept}</td>
                  {years.map(y => <td key={y} style={cell}>{r.values[y] != null ? money(r.values[y], r.currency, r.unit) : "—"}</td>)}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={years.length + 1} style={{ ...cell, textAlign: "center", color: "var(--color-text-tertiary)" }}>No matching concepts.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------------- Global Footprint ----------------
// ---------------- footprint world map ----------------
type World = FeatureCollection<Geometry, { iso: string; name: string; c: [number, number] | null }>
let worldPromise: Promise<World> | null = null
const loadWorld = () => (worldPromise ||= fetch("/companies/world.geo.json").then(r => r.json()))
const MW = 1000, MH = 500
// Micro-jurisdictions the 110m basemap omits but corporate footprints hit constantly (SG, HK, Cayman…).
const MICRO: Record<string, [number, number]> = {
  SG: [103.8, 1.35], HK: [114.1, 22.3], KY: [-81.2, 19.3], BM: [-64.75, 32.3], MU: [57.5, -20.3], JE: [-2.1, 49.2],
  MT: [14.4, 35.9], VG: [-64.6, 18.4], GI: [-5.35, 36.14], GG: [-2.58, 49.46], BB: [-59.5, 13.1], IM: [-4.5, 54.2], LI: [9.55, 47.16],
}

function FootprintMap({ p, foot }: { p: CompanyProfile; foot: Footprint | null }) {
  const [world, setWorld] = useState<World | null>(null)
  useEffect(() => { loadWorld().then(setWorld).catch(() => {}) }, [])
  const summary = p.footprint_summary
  const active = useMemo(() => (foot?.countries || []).filter(c => c.entities.length > 0), [foot])
  const hqName = p.identity.headquarters?.country || null

  // One d3 projection drives land, hub and nodes so every marker sits exactly on its country.
  const geo = useMemo(() => {
    if (!world) return null
    const projection = geoEquirectangular().fitSize([MW, MH], world)
    const path = geoPath(projection)
    const byIso = new Map<string, [number, number]>()
    const q = (hqName || "").toLowerCase()
    let hq: [number, number] | null = null
    for (const f of world.features) {
      const cen = geoCentroid(f) as [number, number]
      if (f.properties?.iso) byIso.set(f.properties.iso, cen)
      const name = (f.properties?.name || "").toLowerCase()
      if (q && name && (name.includes(q) || q.includes(name))) hq = cen
    }
    for (const [iso, ll] of Object.entries(MICRO)) if (!byIso.has(iso)) byIso.set(iso, ll)
    return { projection, path, byIso, hq }
  }, [world, hqName])

  if (!world || !geo) return <div className="vt-skeleton" style={{ height: 320, borderRadius: 14, background: "#0b1a33" }} />

  const { projection, path, byIso, hq } = geo
  const hubLL = hq ?? active.map(a => byIso.get(a.code)).find(Boolean) ?? [0, 20]
  const hubXY = projection(hubLL as [number, number]) ?? [MW / 2, MH / 2]
  const nodes = active
    .map(c => { const ll = byIso.get(c.code); const xy = ll ? projection(ll) : null; return xy ? { c, xy } : null })
    .filter((n): n is { c: Footprint["countries"][number]; xy: [number, number] } => n !== null)
  const markets = summary.n_countries >= 100 ? "100+" : String(summary.n_countries || 0)

  return (
    <>
      <svg viewBox={`0 0 ${MW} ${MH}`} style={{ width: "100%", display: "block" }} preserveAspectRatio="xMidYMid meet">
        {world.features.map((f, i) => { const d = path(f); return d ? <path key={i} d={d} fill="#16294d" stroke="#20386b" strokeWidth={0.4} /> : null })}
        {nodes.map(({ xy }, i) => {
          const mx = (hubXY[0] + xy[0]) / 2, my = (hubXY[1] + xy[1]) / 2
          const lift = Math.hypot(xy[0] - hubXY[0], xy[1] - hubXY[1]) * 0.22
          return <path key={i} d={`M${hubXY[0]} ${hubXY[1]} Q ${mx} ${my - lift} ${xy[0]} ${xy[1]}`} fill="none" stroke="rgba(150,185,255,0.4)" strokeWidth={0.8} />
        })}
        {nodes.map(({ c, xy }, i) => {
          const col = c.status === "found" ? "#dce9ff" : "#ffd48a", r = 1.8 + Math.min(4.5, Math.sqrt(c.entities.length))
          return <g key={i}><circle cx={xy[0]} cy={xy[1]} r={r * 2.6} fill={col} opacity={0.14} /><circle cx={xy[0]} cy={xy[1]} r={r} fill={col} /></g>
        })}
        <circle cx={hubXY[0]} cy={hubXY[1]} r={14} fill="#8ab4ff" opacity={0.2}>
          <animate attributeName="r" values="11;20;11" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.24;0.06;0.24" dur="3.2s" repeatCount="indefinite" />
        </circle>
        <circle cx={hubXY[0]} cy={hubXY[1]} r={5} fill="#fff" />
        <text x={hubXY[0]} y={hubXY[1] - 15} textAnchor="middle" fill="#fff" fontSize={16} fontWeight={600}>{p.identity.legal_name}</text>
      </svg>
      <div style={{ display: "flex", gap: "2.5rem", padding: "1rem 1.5rem 1.25rem" }}>
        <div><div style={{ fontSize: 30, fontWeight: 300, color: "#eaf1ff", lineHeight: 1 }}>{p.group_summary.n_subsidiaries.toLocaleString()}</div><div style={statLabel}>Linked entities</div></div>
        <div><div style={{ fontSize: 30, fontWeight: 300, color: "#eaf1ff", lineHeight: 1 }}>{markets}</div><div style={statLabel}>Markets</div></div>
        {summary.n_entities > 0 && <div><div style={{ fontSize: 30, fontWeight: 300, color: "#eaf1ff", lineHeight: 1 }}>{summary.n_entities.toLocaleString()}</div><div style={statLabel}>Mapped entities</div></div>}
      </div>
    </>
  )
}

// Collapsible "Map" card — solid dark card matching the map; open by default.
function MapCard({ p, foot }: { p: CompanyProfile; foot: Footprint | null }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", background: "linear-gradient(180deg,#0a1730,#0c1d3a)", border: "1px solid var(--color-border)" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "0.8rem 1.25rem", background: "transparent", border: "none", cursor: "pointer" }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#cdddff" }}>Map</span>
        <ChevronDown size={16} strokeWidth={1.5} style={{ color: "#8ea6cf", transform: open ? "none" : "rotate(-90deg)", transition: "transform 150ms ease" }} />
      </button>
      {open && <FootprintMap p={p} foot={foot} />}
    </div>
  )
}
const statLabel: React.CSSProperties = { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8ea6cf", marginTop: 6 }

// ---------------- Group & Footprint workspace ----------------
// Three distinct concepts are kept visually separate: disclosed subsidiary (SEC) · verified legal entity (GLEIF)
// · operational presence (not yet researched).
function StructureTab({ p, foot, group }: { p: CompanyProfile; foot: Footprint | null; group: Group | null }) {
  const id = p.identity, summary = p.footprint_summary
  const ultimate = id.is_subsidiary ? id.parent_legal_name : id.legal_name
  const nSubs = p.group_summary.n_subsidiaries
  return (
    <div style={{ display: "grid", gap: "1.75rem" }}>
      <MapCard p={p} foot={foot} />
      {/* summary layer */}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: "0.75rem" }}>
          <StatCard label="Position" value={id.is_subsidiary ? "Subsidiary" : "Ultimate parent"} />
          <StatCard label="Subsidiaries" value={nSubs.toLocaleString()} sub="SEC-disclosed" />
          <StatCard label="Countries" value={summary.n_countries || 0} />
          <StatCard label="Verified entities" value={summary.n_entities || 0} sub="GLEIF-matched" />
        </div>
        <p style={{ margin: 0, fontSize: "var(--font-text-md-size)", color: "var(--color-text-secondary)" }}>
          <strong style={{ color: "var(--color-text)", fontWeight: "var(--font-weight-medium)" }}>{ultimate}</strong>{" "}
          is {id.is_subsidiary ? "a controlled subsidiary" : "the ultimate parent of a group"} with {nSubs.toLocaleString()} disclosed {nSubs === 1 ? "subsidiary" : "subsidiaries"}
          {summary.n_countries ? ` across ${summary.n_countries} ${summary.n_countries === 1 ? "country" : "countries"}` : ""}.
        </p>
      </div>

      {/* legal footprint — map + entity panel */}
      <section>
        <h2 style={H}>Legal footprint</h2>
        <LegalFootprintPanel summary={summary} foot={foot} />
      </section>

      {/* subsidiaries */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <h2 style={{ ...H, margin: 0 }}>Subsidiaries</h2>
          {group && <span style={{ fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)" }}>{group.subsidiaries.length.toLocaleString()}</span>}
        </div>
        <SubsidiariesTable group={group} />
      </section>

      {/* group structure */}
      <section><h2 style={H}>Group structure</h2><GroupStructure parentName={ultimate || id.legal_name} group={group} /></section>

      {/* unavailable — compact disabled cards, not empty blocks */}
      <NotResearchedCard title="Shareholders" text="Significant owners and ownership percentages are not yet available." />
      <NotResearchedCard title="Operational footprint" text="Facilities, R&D sites, manufacturing locations and country-level revenue are not yet available." />
    </div>
  )
}

function LegalFootprintPanel({ summary, foot }: { summary: CompanyProfile["footprint_summary"]; foot: Footprint | null }) {
  const [sel, setSel] = useState<string | null>(null)
  if (foot == null && summary.n_countries > 0) return <div style={{ ...CARD }}><Centered>Loading…</Centered></div>
  const withEnt = (foot?.countries || []).filter(c => c.entities.length > 0).sort((a, b) => b.entities.length - a.entities.length)
  if (withEnt.length === 0) return <NotResearchedCard title="Legal footprint" text="No geolocated legal entities on file for this company yet." />
  const sc = summary.status_counts || {}
  const shown = sel ? withEnt.filter(c => c.code === sel) : withEnt
  const td: React.CSSProperties = { padding: "0.4rem 1rem", fontSize: "var(--font-text-sm-size)", verticalAlign: "top" }
  return (
    <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "0.85rem 1rem", borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ fontSize: "var(--font-text-sm-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>{summary.n_entities} verified legal entities across {summary.n_countries} countries</div>
        <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "var(--color-text-tertiary)" }}>
          <Dot color="#137333">{sc.found || 0} Found</Dot><Dot color="#b7791f">{sc.partial || 0} Partial</Dot><Dot color="#c7c7c7">{sc.not_found || 0} Not found</Dot>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {withEnt.map(c => { const on = sel === c.code; return <button key={c.code} type="button" onClick={() => setSel(on ? null : c.code)} style={chipStyle(on)}>{c.code} <span style={{ opacity: 0.55 }}>{c.entities.length}</span></button> })}
        </div>
      </div>
      <div style={{ maxHeight: 360, overflow: "auto" }}>
        {shown.map(c => (
          <div key={c.code}>
            <div style={{ padding: "0.45rem 1rem", fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", color: "var(--color-text-secondary)", background: "var(--color-background-primary-soft)", position: "sticky", top: 0 }}>{c.name} · {c.entities.length} {c.entities.length === 1 ? "entity" : "entities"}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {c.entities.map((e, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ ...td, color: "var(--color-text)" }}>{e.name}</td>
                    <td style={{ ...td, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>{cityOf(e.office)}</td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{e.status ? <StatusText status={e.status} /> : "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}><Lei lei={e.lei} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  )
}

function SubsidiariesTable({ group }: { group: Group | null }) {
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<"all" | "verified" | "unmatched">("all")
  if (!group) return <Centered>Loading…</Centered>
  if (group.subsidiaries.length === 0) return <NotResearchedCard title="Subsidiaries" text="No subsidiary records on file." />
  const rows = group.subsidiaries.filter(s => {
    const v = !!s.lei
    if (filter === "verified" && !v) return false
    if (filter === "unmatched" && v) return false
    return !q || s.name.toLowerCase().includes(q.toLowerCase())
  })
  const th: React.CSSProperties = { textAlign: "left", padding: "0.5rem 0.75rem", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", color: "var(--color-text-tertiary)", borderBottom: "1px solid var(--color-border)", position: "sticky", top: 0, background: "var(--color-surface)" }
  const td: React.CSSProperties = { padding: "0.5rem 0.75rem", fontSize: "var(--font-text-sm-size)", borderBottom: "1px solid var(--color-border)" }
  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={14} strokeWidth={1.5} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-tertiary)" }} />
          <Input controlSize="sm" placeholder="Search subsidiaries…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        {(["all", "verified", "unmatched"] as const).map(f => <button key={f} type="button" onClick={() => setFilter(f)} style={chipStyle(filter === f)}>{f === "all" ? "All" : f === "verified" ? "Verified" : "Unmatched"}</button>)}
      </div>
      <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ maxHeight: 460, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={th}>Subsidiary</th><th style={th}>Country</th><th style={th}>LEI</th><th style={th}>Match</th></tr></thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={i}>
                  <td style={{ ...td, color: "var(--color-text)" }}>{s.name}</td>
                  <td style={{ ...td, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{s.jurisdiction || "—"}</td>
                  <td style={td}><Lei lei={s.lei} /></td>
                  <td style={td}><MatchBadge verified={!!s.lei} /></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "var(--color-text-tertiary)" }}>No matches.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 6 }}>{rows.length.toLocaleString()} of {group.subsidiaries.length.toLocaleString()}</div>
    </div>
  )
}

function GroupStructure({ parentName, group }: { parentName: string; group: Group | null }) {
  const [view, setView] = useState<"table" | "tree">("table")
  if (!group) return <Centered>Loading…</Centered>
  if (group.subsidiaries.length === 0) return <NotResearchedCard title="Group structure" text="No relationship data on file." />
  const CAP = 120, subs = group.subsidiaries, shown = subs.slice(0, CAP), rest = subs.length - shown.length
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: "0.75rem" }}>
        <button type="button" onClick={() => setView("table")} style={chipStyle(view === "table")}>Table</button>
        <button type="button" onClick={() => setView("tree")} style={chipStyle(view === "tree")}>Tree</button>
      </div>
      {view === "table" ? (
        <div style={CARD}>
          <div style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", marginBottom: 6 }}>{parentName} <span style={{ color: "var(--color-text-tertiary)", fontWeight: 400 }}>· parent</span></div>
          <div style={{ display: "grid", gap: 2, maxHeight: 380, overflow: "auto" }}>
            {shown.map((s, i) => <div key={i} style={{ paddingLeft: 14, fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)" }}><span style={{ color: "var(--color-text)" }}>{s.name}</span>{s.jurisdiction ? ` · ${s.jurisdiction}` : ""}</div>)}
            {rest > 0 && <div style={{ paddingLeft: 14, fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>+{rest.toLocaleString()} more</div>}
          </div>
        </div>
      ) : (
        <div style={{ ...CARD, fontFamily: "var(--font-mono, monospace)", fontSize: 12, color: "var(--color-text-secondary)", maxHeight: 380, overflow: "auto", whiteSpace: "pre" }}>
          <div style={{ color: "var(--color-text)" }}>{parentName}</div>
          {shown.map((s, i) => <div key={i}>{(i === shown.length - 1 && rest === 0 ? "└── " : "├── ") + s.name}</div>)}
          {rest > 0 && <div>{"└── +" + rest.toLocaleString() + " more"}</div>}
        </div>
      )}
    </div>
  )
}

// ---- small shared bits for the workspace ----
function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={{ ...CARD, padding: "0.85rem 1rem" }}>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
function NotResearchedCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ ...CARD, background: "var(--color-background-primary-soft)", borderStyle: "dashed" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: "var(--font-text-md-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text-secondary)" }}>{title}</h3>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-tertiary)", border: "1px solid var(--color-border)", borderRadius: 9999, padding: "2px 8px", whiteSpace: "nowrap" }}>Not researched</span>
      </div>
      <p style={{ margin: "0.4rem 0 0", fontSize: "var(--font-text-sm-size)", color: "var(--color-text-tertiary)" }}>{text}</p>
    </div>
  )
}
function Lei({ lei }: { lei: string | null }) {
  const [copied, setCopied] = useState(false)
  if (!lei) return <span style={{ color: "var(--color-text-tertiary)" }}>—</span>
  return (
    <button type="button" title={`${lei} — click to copy`} onClick={() => { navigator.clipboard?.writeText(lei); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
      style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
      {copied ? "copied ✓" : lei.slice(0, 8) + "…"}
    </button>
  )
}
function MatchBadge({ verified }: { verified: boolean }) {
  return <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 9999, fontSize: 11, fontWeight: "var(--font-weight-medium)", background: verified ? "var(--color-background-success-soft, #e6f4ea)" : "var(--color-background-primary-soft)", color: verified ? "var(--color-text-success, #137333)" : "var(--color-text-tertiary)" }}>{verified ? "Verified" : "Not matched"}</span>
}
function StatusText({ status }: { status: string }) {
  const s = status.toLowerCase(), active = s.includes("active") && !s.includes("inactive")
  return <span style={{ color: active ? "var(--color-text-success, #137333)" : "var(--color-text-secondary)", textTransform: "capitalize" }}>{s}</span>
}
function Dot({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />{children}</span>
}
const cityOf = (office: string | null) => { if (!office) return "—"; const c = office.split(",")[0].trim(); return c ? c.toLowerCase().replace(/\b\w/g, m => m.toUpperCase()) : "—" }
const chipStyle = (active: boolean): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 8, border: `1px solid ${active ? "var(--color-border-strong, #999)" : "var(--color-border)"}`, background: active ? "var(--color-background-primary-soft)" : "var(--color-surface)", color: active ? "var(--color-text)" : "var(--color-text-secondary)", fontSize: "var(--font-text-xs-size)", cursor: "pointer" })

// ---------------- Intellectual Property ----------------
function IPTab({ ip, summary }: { ip: IP | null; summary: CompanyProfile["ip_summary"] }) {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  if (summary.count === 0) return <NotResearched what="intellectual-property records" />
  const jur = Object.entries(summary.by_jurisdiction).sort((a, b) => b[1] - a[1])
  const items = ip?.items ?? []
  const filtered = q ? items.filter(i => (i.number || "").toLowerCase().includes(q.toLowerCase())) : items
  const PAGE = 50, pages = Math.max(1, Math.ceil(filtered.length / PAGE)), pg = Math.min(page, pages - 1)
  const shown = filtered.slice(pg * PAGE, pg * PAGE + PAGE)
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <section><h2 style={H}>Patent portfolio</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.75rem" }}>
          <div style={CARD}><div style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>Total patents</div><div style={{ fontSize: "22px", fontWeight: "var(--font-weight-semibold)" }}>{summary.count.toLocaleString()}</div></div>
          {jur.slice(0, 5).map(([j, n]) => <div key={j} style={CARD}><div style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>{j}</div><div style={{ fontSize: "20px", fontWeight: "var(--font-weight-semibold)" }}>{n.toLocaleString()}</div></div>)}
        </div>
        <p style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", margin: "0.5rem 0 0" }}>Trademarks, filing/grant dates and technology classifications are not yet researched.</p>
      </section>
      <section><h2 style={H}>Patents</h2>
        {!ip ? <Centered>Loading patents…</Centered> : (
          <>
            <div style={{ position: "relative", maxWidth: 300, marginBottom: "0.75rem" }}>
              <Search size={14} strokeWidth={1.5} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-tertiary)" }} />
              <Input controlSize="sm" placeholder="Filter by number…" value={q} onChange={e => { setQ(e.target.value); setPage(0) }} style={{ paddingLeft: 30 }} />
            </div>
            <div style={{ ...CARD, display: "grid", gap: 3 }}>
              {shown.map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: "var(--font-text-sm-size)" }}>
                  <span>{it.uspto ? <a href={it.uspto} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-text-link, #1a56db)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>{it.number} <ExternalLink size={11} /></a> : it.number}</span>
                  <span style={{ color: "var(--color-text-tertiary)" }}>{it.jurisdiction}</span>
                </div>
              ))}
            </div>
            {pages > 1 && <div style={{ display: "flex", gap: "1rem", justifyContent: "center", alignItems: "center", marginTop: "0.75rem", fontSize: "var(--font-text-sm-size)" }}>
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} style={pagerBtn(pg === 0)}>Prev</button>
              <span style={{ color: "var(--color-text-secondary)" }}>Page {pg + 1} of {pages}</span>
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} style={pagerBtn(pg >= pages - 1)}>Next</button>
            </div>}
          </>
        )}
      </section>
    </div>
  )
}

// ---------------- Sources & Confidence ----------------
function Sources({ p }: { p: CompanyProfile }) {
  const s = p.sources
  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <section><h2 style={H}>Coverage</h2>
        <div style={{ ...CARD, display: "grid", gap: "0.5rem" }}>
          {s.coverage.map(c => {
            const ok = c.status === "complete"
            return <div key={c.area} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "var(--font-text-sm-size)" }}>
              <span style={{ display: "inline-flex", width: 18, height: 18, borderRadius: 9999, alignItems: "center", justifyContent: "center", flexShrink: 0, background: ok ? "var(--color-background-success-soft, #e6f4ea)" : "var(--color-background-primary-soft)", color: ok ? "var(--color-text-success, #137333)" : "var(--color-text-tertiary)" }}>{ok ? <Check size={12} strokeWidth={2.5} /> : <Minus size={12} strokeWidth={2.5} />}</span>
              <span style={{ flex: 1, color: "var(--color-text)", textTransform: "capitalize" }}>{c.area.replace(/_/g, " ")}</span>
              <span style={{ fontSize: "11px", color: "var(--color-text-tertiary)", textTransform: "capitalize" }}>{c.status.replace(/_/g, " ")}</span>
            </div>
          })}
        </div>
      </section>
      <section><h2 style={H}>Sources used</h2><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{s.families.map(fam => <Pill key={fam}>{fam}</Pill>)}</div></section>
      {s.gaps.length > 0 && <section><h2 style={H}>Gaps ({s.gaps.length})</h2><div style={{ ...CARD, display: "grid", gap: "0.6rem" }}>{s.gaps.map((g, i) => <div key={i} style={{ fontSize: "var(--font-text-sm-size)" }}><span style={{ fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>{g.field}</span><span style={{ color: "var(--color-text-secondary)" }}> — {g.description}</span></div>)}</div></section>}
      <section><h2 style={H}>Confidence</h2><FieldCard>
        <Field label="Completeness">{Math.round(s.completeness * 100)}%</Field>
        <Field label="Overall"><span style={{ textTransform: "capitalize" }}>{s.confidence}</span></Field>
      </FieldCard></section>
    </div>
  )
}

// ---------------- shared bits ----------------
function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  const empty = children == null || children === ""
  return <div><div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", marginBottom: 4 }}>{label}</div><div style={{ fontSize: "var(--font-text-md-size)", fontWeight: "var(--font-weight-medium)", color: empty ? "var(--color-text-tertiary)" : "var(--color-text)" }}>{empty ? "Not on file" : children}</div></div>
}
function FieldCard({ children }: { children: React.ReactNode }) {
  return <div style={{ ...CARD, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.25rem 1.5rem" }}>{children}</div>
}
function Pill({ children, title }: { children: React.ReactNode; title?: string }) {
  return <span title={title} style={{ display: "inline-block", padding: "2px 10px", borderRadius: 9999, fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", background: "var(--color-background-primary-soft)", color: "var(--color-text-secondary)", cursor: title ? "help" : "default" }}>{children}</span>
}
function StatusPill({ active, label }: { active: boolean; label: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 10px", borderRadius: 9999, fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", textTransform: "capitalize", background: active ? "var(--color-background-success-soft, #e6f4ea)" : "var(--color-background-primary-soft)", color: active ? "var(--color-text-success, #137333)" : "var(--color-text-secondary)" }}><span style={{ width: 6, height: 6, borderRadius: 9999, background: active ? "var(--color-text-success, #137333)" : "var(--color-text-tertiary)" }} />{label}</span>
}
function NotResearched({ what }: { what: string }) {
  return <div style={{ ...CARD, borderStyle: "dashed", color: "var(--color-text-tertiary)", fontSize: "var(--font-text-sm-size)" }}>Not yet researched — {what} isn’t in the current data. This lights up when the research pipeline provides it.</div>
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: "var(--font-text-sm-size)" }}>{children}</div>
}
function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", border: "none", background: "transparent", cursor: "pointer", fontSize: "var(--font-text-sm-size)", color: "var(--color-text)" }} onMouseEnter={e => e.currentTarget.style.background = "var(--color-background-primary-soft)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{children}</button>
}
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", padding: "0.4rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", cursor: "pointer" }
const pagerBtn = (disabled: boolean): React.CSSProperties => ({ padding: "0.3rem 0.8rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: disabled ? "var(--color-text-tertiary)" : "var(--color-text)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 })
