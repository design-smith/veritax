"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { geoCentroid, geoEquirectangular, geoPath } from "d3-geo"
import type { FeatureCollection, Geometry } from "geojson"
import { ArrowLeft, Check, ChevronDown, Copy, Download, ExternalLink, Search, Star } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Input } from "@/components/ui/input"
import {
  compact, getFinancials, getFootprint, getGroup, getIP, getProfile, money,
  type CompanyProfile, type Financials, type Footprint, type Group, type IP,
} from "@/lib/companies"
import { useRequireAuth } from "@/lib/require-auth"
import { useSavedCompanies } from "@/lib/saved-companies"
import { SelectControl } from "@/components/ui/select-control"
import { computePLIs, lines, periodTotals, PLIS, yearsAvailable } from "@/lib/tp"
import { downloadCompanyJSON, downloadCompanyZip, downloadFinancialsCSV } from "@/components/company/download"

const TABS = [
  ["identity", "Identity"], ["business", "Business & Operations"],
  ["financials", "Financials"], ["structure", "Group Structure & Footprint"],
  ["ip", "Intellectual Property"],
] as const
type TabId = typeof TABS[number][0]
type SourceLink = { label: string; href: string }

const CARD: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", background: "var(--color-surface)", padding: "1rem 1.25rem" }
const H: React.CSSProperties = { fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-semibold)", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-tertiary)", margin: "0 0 0.75rem" }

function textOf(n: React.ReactNode): string {
  if (n == null || typeof n === "boolean") return ""
  if (typeof n === "string" || typeof n === "number") return String(n)
  if (Array.isArray(n)) return n.map(textOf).join("")
  if (typeof n === "object" && n !== null && "props" in n) {
    return textOf((n as React.ReactElement<{ children?: React.ReactNode }>).props.children)
  }
  return ""
}

function Copyable({ text, label, block, children }: { text?: string; label?: string; block?: boolean; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const copy = (text ?? textOf(children)).trim()
  const Tag = block ? "div" : "span"
  if (!copy || copy === "—" || copy === "Not on file") return <>{children}</>
  return (
    <Tag className={block ? "vt-copyable is-block" : "vt-copyable"}>
      <Tag className="vt-copyable-value">{children}</Tag>
      <button
        type="button"
        className="vt-copy"
        aria-label={copied ? `${label ?? "Value"} copied` : `Copy ${label ?? "value"}`}
        title={copied ? "Copied" : "Copy"}
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          void navigator.clipboard?.writeText(copy)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        }}
      >
        {copied ? <Check size={11} strokeWidth={2} /> : <Copy size={11} strokeWidth={2} />}
      </button>
    </Tag>
  )
}

export default function CompanyRecord({ slug, onBack, fromSearch = false }: { slug: string; onBack: () => void; fromSearch?: boolean }) {
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>("identity")
  const [scrolled, setScrolled] = useState(false)
  const [saved, toggleSave] = useSavedCompanies()
  const requireAuth = useRequireAuth()
  // lazy per-tab artifacts
  const [fin, setFin] = useState<Financials | null>(null)
  const [foot, setFoot] = useState<Footprint | null>(null)
  const [ip, setIP] = useState<IP | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [dlOpen, setDlOpen] = useState(false)
  const [dling, setDling] = useState(false)
  const [finDlPinned, setFinDlPinned] = useState(false)
  const finDlRun = useRef<(() => void) | null>(null)
  const recordRef = useRef<HTMLDivElement>(null)
  const onFinDownload = useCallback((state: { pinned: boolean; run: () => void } | null) => {
    finDlRun.current = state?.run ?? null
    setFinDlPinned(Boolean(state?.pinned))
  }, [])

  const applyShade = useCallback((el: HTMLElement) => {
    const slot = Math.round(el.clientHeight * 0.75)
    el.style.setProperty("--vt-shade-slot-h", `${slot}px`)
    const compact = 60
    const range = Math.max(1, slot - compact)
    const pad = el.querySelector(".vt-record-scroll-pad")
    if (pad instanceof HTMLElement && el.scrollTop < 2) {
      const overflow = el.scrollHeight - pad.offsetHeight - el.clientHeight
      const need = Math.max(0, range - Math.max(0, overflow))
      if (Math.abs(pad.offsetHeight - need) > 1) pad.style.height = `${need}px`
    }
    const max = el.scrollHeight - el.clientHeight
    if (max <= 1) {
      if (el.scrollTop) el.scrollTop = 0
      el.style.setProperty("--vt-shade-p", "0")
      setScrolled(false)
      return
    }
    const p = Math.min(1, el.scrollTop / range)
    el.style.setProperty("--vt-shade-p", p.toFixed(4))
    setScrolled(s => (p >= 0.72 ? true : p <= 0.28 ? false : s))
  }, [])

  useEffect(() => {
    let live = true
    setProfile(null); setError(null); setTab("identity"); setScrolled(false); setFin(null); setFoot(null); setIP(null); setGroup(null)
    getProfile(slug).then(p => { if (live) setProfile(p) }).catch(() => { if (live) setError("Couldn’t load this company.") })
    return () => { live = false }
  }, [slug])
  useEffect(() => { if (tab === "financials" && !fin) getFinancials(slug).then(setFin).catch(() => {}) }, [tab, slug, fin])
  useEffect(() => { if (tab === "structure" && !foot) getFootprint(slug).then(setFoot).catch(() => {}) }, [tab, slug, foot])
  useEffect(() => { if (tab === "structure" && !group) getGroup(slug).then(setGroup).catch(() => {}) }, [tab, slug, group])
  useEffect(() => { if (tab === "ip" && !ip) getIP(slug).then(setIP).catch(() => {}) }, [tab, slug, ip])
  useLayoutEffect(() => {
    const el = recordRef.current
    if (el) applyShade(el)
  }, [tab, profile, fin, foot, group, ip, applyShade])
  useEffect(() => {
    const el = recordRef.current
    if (!el) return
    const inner = el.querySelector(".vt-record-inner")
    if (!inner) return
    const ro = new ResizeObserver(() => applyShade(el))
    ro.observe(inner)
    return () => ro.disconnect()
  }, [applyShade, profile])
  useEffect(() => {
    const btn = document.querySelector(".vt-record-tabs-list button.is-on")
    const list = btn?.parentElement
    if (!(btn instanceof HTMLElement) || !(list instanceof HTMLElement)) return
    const left = btn.offsetLeft
    const right = left + btn.offsetWidth
    if (left < list.scrollLeft) list.scrollLeft = left
    else if (right > list.scrollLeft + list.clientWidth) list.scrollLeft = right - list.clientWidth
  }, [tab, finDlPinned])

  if (error) return <Centered>{error}</Centered>
  if (!profile) return <Centered>Loading…</Centered>

  const id = profile.identity
  const isSaved = saved.has(slug)

  async function runDownload(kind: "zip" | "json") {
    if (!(await requireAuth())) return
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

  async function onToggleSave() {
    if (!(await requireAuth())) return
    toggleSave(slug)
  }

  return (
    <div
      ref={recordRef}
      className={scrolled ? "vt-record is-scrolled" : "vt-record"}
      onScroll={e => applyShade(e.currentTarget)}
    >
      <header className="vt-record-shade">
        <div className="vt-record-shade-bar">
          <RecordWho name={id.legal_name} logo={id.logo} compact />
          <div className="vt-record-shade-acts">
            <button type="button" className="vt-record-ghost" onClick={() => void onToggleSave()} title={isSaved ? "Saved" : "Save"}>
              <Star size={14} strokeWidth={1.5} style={{ color: isSaved ? "#f5a623" : "currentColor", fill: isSaved ? "#f5a623" : "none" }} /> {isSaved ? "Saved" : "Save"}
            </button>
            <div style={{ position: "relative" }}>
              <button type="button" className="vt-record-ghost" onClick={() => setDlOpen(o => !o)} disabled={dling}>
                <Download size={14} strokeWidth={1.5} /> {dling ? "Preparing…" : "Download"} <ChevronDown size={12} />
              </button>
              {dlOpen && (
                <div className="vt-record-menu">
                  <button type="button" onClick={() => runDownload("zip")}>ZIP — a file per step</button>
                  <button type="button" onClick={() => runDownload("json")}>JSON — raw data</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="vt-record-shade-foot">
          <div className="vt-record-shade-lead">
            {fromSearch && (
              <button type="button" className="vt-record-back" onClick={onBack}>
                <ArrowLeft size={15} strokeWidth={1.5} /> Back to search
              </button>
            )}
            <RecordWho name={id.legal_name} logo={id.logo} />
          </div>
          <ShadeFacts p={profile} />
        </div>
      </header>
      <div className="vt-record-shade-gap" aria-hidden />

      <div className="vt-record-inner">
        <nav className="vt-record-tabs">
          <div className="vt-record-tabs-top">
            <div className="vt-record-tabs-list">
              {TABS.map(([tid, label]) => (
                <button key={tid} type="button" className={tab === tid ? "is-on" : undefined} onClick={() => setTab(tid)}>{label}</button>
              ))}
            </div>
            {tab === "financials" && finDlPinned && (
              <button type="button" className="vt-fin-dl vt-fin-dl--dock" onClick={() => finDlRun.current?.()}>
                <Download size={14} strokeWidth={1.5} /> Download financials
              </button>
            )}
          </div>
          <SectionSources links={sourceLinks(profile, tab)} />
        </nav>

        {tab === "identity" && <Identity p={profile} />}
        {tab === "business" && <Business p={profile} />}
        {tab === "financials" && <FinancialsTab p={profile} fin={fin} scrolled={scrolled} onFinDownload={onFinDownload} requireAuth={requireAuth} />}
        {tab === "structure" && <StructureTab p={profile} foot={foot} group={group} />}
        {tab === "ip" && <IPTab p={profile} ip={ip} summary={profile.ip_summary} />}
      </div>
      <div className="vt-record-scroll-pad" aria-hidden />
    </div>
  )
}

function RecordWho({ name, logo, compact }: { name: string; logo?: string | null; compact?: boolean }) {
  return (
    <div className={compact ? "vt-record-who vt-record-who--compact" : "vt-record-who"}>
      <span className="vt-record-mark">
        {logo
          ? <img src={logo} alt="" />
          : <span className="vt-record-mono">{monogram(name)}</span>}
      </span>
      <h1>{name}</h1>
    </div>
  )
}

function ShadeFacts({ p }: { p: CompanyProfile }) {
  const id = p.identity, hq = id.headquarters, c = p.classification
  const listing = id.listings[0]
  const office = hq
    ? [hq.address_line, prettyPlace(hq.city), prettyPlace(hq.region), hq.postal_code, hq.country].filter(Boolean).join(", ")
    : prettyPlace(id.jurisdiction)
  const host = id.website ? hostOf(id.website) : ""
  const rows: { label: string; copy: string; node?: React.ReactNode }[] = [
    { label: "Ticker", copy: listing ? `${listing.ticker}${listing.exchange ? " · " + listing.exchange : ""}` : "" },
    { label: "Status", copy: prettyPlace(id.entity_status) },
    { label: "Entity", copy: prettyPlace((id.entity_type ?? "").replace(/_/g, " ")) },
    { label: "Company position", copy: id.is_subsidiary ? "Controlled subsidiary" : "Ultimate parent / independent" },
    { label: "Headquarters", copy: office },
    { label: "Website", copy: host, node: id.website ? <a href={id.website} target="_blank" rel="noopener noreferrer">{host}</a> : null },
    { label: "Industry", copy: [c.sic, c.sic_description].filter(Boolean).join(" · ") },
    { label: "Founded", copy: id.founded ?? "" },
    { label: "Employees", copy: p.business.employees != null ? p.business.employees.toLocaleString() : "" },
    { label: "CIK", copy: id.cik ?? "" },
    { label: "LEI", copy: id.lei ?? "" },
  ]
  return (
    <dl className="vt-record-facts">
      {rows.filter(r => r.copy).map(r => (
        <ShadeFact key={r.label} label={r.label} copy={r.copy}>{r.node ?? r.copy}</ShadeFact>
      ))}
    </dl>
  )
}

function ShadeFact({ label, copy, children }: { label: string; copy: string; children: React.ReactNode }) {
  return (
    <div className="vt-record-fact">
      <dt>{label}</dt>
      <dd><Copyable label={label} text={copy}>{children}</Copyable></dd>
    </div>
  )
}

// ---------------- Identity ----------------
function padCik(cik: string | null | undefined): string | null {
  if (!cik) return null
  const digits = cik.replace(/\D/g, "")
  return digits ? digits.padStart(10, "0") : null
}

function used(p: CompanyProfile, ...ids: string[]): boolean {
  const fam = p.sources.families
  return ids.some(id => fam.includes(id))
}

function sourceLinks(p: CompanyProfile, tab: TabId): SourceLink[] {
  const cik = padCik(p.identity.cik)
  const lei = p.identity.lei
  const ticker = p.identity.listings[0]?.ticker
  const out: SourceLink[] = []
  const add = (label: string, href: string) => {
    if (!out.some(row => row.href === href)) out.push({ label, href })
  }
  if ((tab === "identity" || tab === "business" || tab === "financials" || tab === "structure") && cik && used(p, "sec_submissions", "sec_filings", "sec_edgar_archive", "sec_companyfacts", "sec_structured")) {
    add("SEC EDGAR", `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`)
  }
  if ((tab === "identity" || tab === "structure") && lei && used(p, "gleif_api")) {
    add("GLEIF", `https://search.gleif.org/#/record/${lei}`)
  }
  if (tab === "financials" && ticker) {
    add("Yahoo Finance", `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}`)
  }
  if (tab === "ip" && (used(p, "uspto_odp", "uspto") || p.ip_summary.count > 0)) {
    add("USPTO", "https://ppubs.uspto.gov/pubwebapp/")
  }
  if (!out.length && cik && (tab === "identity" || tab === "business" || tab === "financials" || tab === "structure")) {
    add("SEC EDGAR", `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`)
  }
  return out
}

function SectionSources({ links }: { links: SourceLink[] }) {
  if (!links.length) return null
  return (
    <footer className="vt-record-sources">
      <span>Sources</span>
      {links.map((link, i) => (
        <span key={link.href}>
          {i > 0 ? <span className="vt-record-sources-sep">·</span> : null}
          <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
        </span>
      ))}
    </footer>
  )
}

function Identity({ p }: { p: CompanyProfile }) {
  const id = p.identity, hq = id.headquarters, c = p.classification
  const office = hq ? [hq.address_line, prettyPlace(hq.city), prettyPlace(hq.region), hq.postal_code, hq.country].filter(Boolean).join(", ") : ""
  const text = p.business.overview || p.business.description
  const paras = text ? text.split(/\n\n+/).map(s => s.trim()).filter(Boolean) : []
  const codes = [
    c.sic ? `${c.sic} (SIC)` : null,
    c.naics ? `${c.naics} (NAICS)` : null,
    c.nace ? `${c.nace} (NACE)` : null,
  ].filter(Boolean).join("\n")
  return (
    <div>
      {paras.length > 0 && (
        <Copyable label="Overview" text={text ?? ""} block>
          <div className="vt-record-overview">
            {paras.map((para, i) => <p key={i}>{para}</p>)}
          </div>
        </Copyable>
      )}
      <dl className="vt-record-vitals">
        <Vital label="Status">{prettyPlace(id.entity_status)}</Vital>
        <Vital label="Founded">{id.founded}</Vital>
        <Vital label="Headquarters">{office || prettyPlace(id.jurisdiction)}</Vital>
        <Vital label="Industry">{c.sic_description}</Vital>
        <Vital label="Codes" copy={codes}>{codeLines(c)}</Vital>
        <Vital label="Sector">{c.sector}</Vital>
      </dl>
    </div>
  )
}

// ---------------- Business & Operations ----------------
function Business({ p }: { p: CompanyProfile }) {
  const b = p.business
  const rndFields = [
    ["Conducts R&D", b.rnd.conducts ? "Yes" : "No"],
    ["R&D spend", b.rnd.spend != null ? money(b.rnd.spend, p.financials_currency) : null],
    ["Employees", b.employees != null ? b.employees.toLocaleString() : null],
  ].filter(([, v]) => v != null && v !== "") as [string, string][]
  return (
    <div style={{ display: "grid", gap: "1.75rem" }}>
      {(rndFields.length > 0 || b.rnd.description) && (
        <div style={{ display: "grid", gap: "1.15rem" }}>
          {rndFields.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1.15rem 1.75rem" }}>
              {rndFields.map(([label, value]) => <Field key={label} label={label}>{value}</Field>)}
            </div>
          )}
          {b.rnd.description && (
            <Copyable label="R&D" text={b.rnd.description} block>
              <p style={{ margin: 0, fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{b.rnd.description}</p>
            </Copyable>
          )}
        </div>
      )}
      {b.activity_tags.length > 0 && (
        <section>
          <h2 style={H}>Activities (evidence-backed)</h2>
          <div style={{ display: "grid", gap: "0.7rem" }}>
            {b.activity_tags.map(t => (
              <div key={t.tag} style={{ display: "flex", gap: "0.7rem", alignItems: "baseline" }}>
                <Copyable label="Activity" text={t.tag}><Pill>{t.tag}</Pill></Copyable>
                <Copyable label="Evidence" text={t.evidence}>
                  <span style={{ fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)", lineHeight: 1.5 }}>“{t.evidence}”</span>
                </Copyable>
              </div>
            ))}
          </div>
        </section>
      )}
      {b.segments.length > 0 && (
        <section>
          <h2 style={H}>Reportable segments</h2>
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {b.segments.map((s, i) => (
              <Copyable key={i} label="Segment" text={s} block>
                <p style={{ margin: 0, fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>{s}</p>
              </Copyable>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ---------------- Financials ----------------
const fmtPLI = (v: number | null, kind: "pct" | "ratio") => v == null ? "—" : kind === "pct" ? (v * 100).toFixed(2) + "%" : v.toFixed(2)

function PliTable({ fin, sel }: { fin: Financials; sel: number[] }) {
  const L = useMemo(() => lines(fin), [fin])
  const [pliKey, setPliKey] = useState("op_margin")
  const plis = computePLIs(L, sel)
  const active = plis.find(p => p.key === pliKey) ?? plis[0]
  const cur = fin.currency
  if (!active) return null
  return (
    <section>
      <div className="vt-fin-pli-head">
        <h2 style={{ ...H, margin: 0 }}>PLI</h2>
        <SelectControl size="sm" variant="outline" value={pliKey} onValueChange={setPliKey}>
          {PLIS.map(pl => <SelectControl.Item key={pl.key} value={pl.key}>{pl.label} · {pl.short}</SelectControl.Item>)}
        </SelectControl>
        <Copyable label={active.short}>
          <span style={{ fontSize: 16, fontWeight: 500, color: "#0d0d0d", fontVariantNumeric: "tabular-nums" }}>{fmtPLI(active.value, active.kind)}</span>
        </Copyable>
      </div>
      <div className="vt-fin-scroll">
        <table className="vt-fin-table">
          <thead>
            <tr>
              <th>Fiscal year</th>
              <th>Numerator</th>
              <th>Denominator</th>
              <th>Ratio</th>
            </tr>
          </thead>
          <tbody>
            {active.perYear.map(r => (
              <tr key={r.year}>
                <td><Copyable label="Fiscal year">{`FY${r.year}`}</Copyable></td>
                <td><Copyable label="Numerator">{money(r.num, cur)}</Copyable></td>
                <td><Copyable label="Denominator">{money(r.den, cur)}</Copyable></td>
                <td><Copyable label="Ratio">{fmtPLI(r.ratio, active.kind)}</Copyable></td>
              </tr>
            ))}
            <tr>
              <td>Weighted (pooled)</td>
              <td><Copyable label="Numerator">{money(active.sumNum, cur)}</Copyable></td>
              <td><Copyable label="Denominator">{money(active.sumDen, cur)}</Copyable></td>
              <td><Copyable label="Ratio">{fmtPLI(active.value, active.kind)}</Copyable></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FinancialsTab({ p, fin, scrolled, onFinDownload, requireAuth }: {
  p: CompanyProfile
  fin: Financials | null
  scrolled: boolean
  onFinDownload: (state: { pinned: boolean; run: () => void } | null) => void
  requireAuth: () => Promise<boolean>
}) {
  const listing = p.identity.listings[0]
  const years = useMemo(() => fin ? yearsAvailable(fin) : [], [fin])
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const dlRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!years.length) return
    const y0 = years[Math.max(0, years.length - 3)]
    const y1 = years[years.length - 1]
    setFrom(`${y0}-01-01`)
    setTo(`${y1}-12-31`)
  }, [years])
  const start = from && to && from > to ? to : from
  const end = from && to && from > to ? from : to
  const y0 = Number((start || "").slice(0, 4))
  const y1 = Number((end || "").slice(0, 4))
  const sel = years.filter(y => (!y0 || y >= y0) && (!y1 || y <= y1))
  const min = years.length ? `${years[0]}-01-01` : undefined
  const max = years.length ? `${years[years.length - 1]}-12-31` : undefined
  const runDownload = useCallback(() => {
    void requireAuth().then(ok => {
      if (ok && fin) downloadFinancialsCSV(p.slug, fin, sel)
    })
  }, [fin, p.slug, sel, requireAuth])
  const runRef = useRef(runDownload)
  runRef.current = runDownload
  useEffect(() => {
    const el = dlRef.current
    if (!el || !fin) {
      onFinDownload(null)
      return
    }
    const root = el.closest(".vt-record")
    const io = new IntersectionObserver(([e]) => {
      onFinDownload({ pinned: scrolled && !e.isIntersecting, run: () => runRef.current() })
    }, { root: root instanceof Element ? root : null, threshold: 0, rootMargin: "-128px 0px 0px 0px" })
    io.observe(el)
    return () => {
      io.disconnect()
      onFinDownload(null)
    }
  }, [fin, scrolled, onFinDownload])
  return (
    <div className="vt-fin">
      {years.length > 0 && (
        <div className="vt-fin-toolbar">
          <div className="vt-fin-period">
            <label htmlFor="vt-fin-from">From</label>
            <input id="vt-fin-from" type="date" value={from} min={min} max={max} onChange={e => setFrom(e.target.value)} />
            <span className="vt-fin-period-dash">–</span>
            <label htmlFor="vt-fin-to">To</label>
            <input id="vt-fin-to" type="date" value={to} min={min} max={max} onChange={e => setTo(e.target.value)} />
          </div>
          {fin && (
            <button ref={dlRef} type="button" className="vt-fin-dl" onClick={runDownload}>
              <Download size={14} strokeWidth={1.5} /> Download financials
            </button>
          )}
        </div>
      )}
      <div className="vt-fin-split">
        <StockChart symbol={listing?.ticker || null} exchange={listing?.exchange} from={start} to={end} />
        {fin ? <AnalysisNums fin={fin} sel={sel} /> : <Centered>Loading…</Centered>}
      </div>
      {fin && sel.length > 0 && <PliTable fin={fin} sel={sel} />}
      {fin && sel.length > 0 && (
        <section>
          <h2 style={H}>Key financials</h2>
          <KeyFinancials fin={fin} years={sel} />
        </section>
      )}
      {fin && p.facts_count > 0 && (
        <section>
          <h2 style={H}>Normalized facts · {fin.standard}</h2>
          <Pivot fin={fin} years={sel} />
        </section>
      )}
    </div>
  )
}

const fmtDay = (t: number) => new Date(t * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })

function StockChart({ symbol, exchange, from, to }: { symbol: string | null; exchange?: string | null; from: string; to: string }) {
  const [data, setData] = useState<{ last: number; prev: number | null; currency: string; points: { t: number; c: number }[] } | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    if (!symbol || !from || !to) { setData(null); return }
    const ac = new AbortController()
    setErr(false)
    const q = new URLSearchParams({ symbol, from, to })
    if (exchange) q.set("exchange", exchange)
    fetch(`/api/quote?${q}`, { signal: ac.signal })
      .then(r => { if (!r.ok) throw new Error("quote") ; return r.json() })
      .then(setData)
      .catch(e => { if (e.name !== "AbortError") { setData(null); setErr(true) } })
    return () => ac.abort()
  }, [symbol, exchange, from, to])
  const last = data?.points.at(-1)?.c
  const first = data?.points[0]?.c
  const chg = last != null && first ? (last - first) / first : null
  return (
    <div className="vt-fin-chart">
      <div className="vt-fin-chart-head">
        <span className="vt-fin-chart-sym">{[symbol, exchange].filter(Boolean).join(" · ") || "Quote"}</span>
        {last != null && (
          <span className="vt-fin-chart-px">
            {last.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            {chg != null && <small className={chg >= 0 ? "is-up" : "is-down"}>{`${chg >= 0 ? "+" : ""}${(chg * 100).toFixed(2)}%`}</small>}
          </span>
        )}
      </div>
      {!symbol ? <div className="vt-fin-chart-empty">No listed ticker.</div>
        : err ? <div className="vt-fin-chart-empty">Quote unavailable for this window.</div>
        : !data ? <div className="vt-fin-chart-empty">Loading quote…</div>
        : (
          <div className="vt-fin-chart-plot">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="vt-quote-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d0d0d" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#0d0d0d" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tickFormatter={fmtDay} minTickGap={48} stroke="#dfdfdf" tick={{ fill: "#5d5d5d", fontSize: 10, fontFamily: "var(--font-plex)" }} axisLine={{ stroke: "#dfdfdf" }} tickLine={false} />
                <YAxis domain={["auto", "auto"]} orientation="right" width={56} stroke="#dfdfdf" tick={{ fill: "#5d5d5d", fontSize: 10, fontFamily: "var(--font-plex)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  labelFormatter={v => fmtDay(Number(v))}
                  formatter={(v) => [typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v ?? ""), "Close"]}
                  contentStyle={{ background: "#fcfcfc", border: "1px solid #dfdfdf", borderRadius: 4, fontFamily: "var(--font-plex)", fontSize: 12, color: "#0d0d0d" }}
                />
                <Area type="monotone" dataKey="c" stroke="#0d0d0d" fill="url(#vt-quote-fill)" strokeWidth={1.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
    </div>
  )
}

function AnalysisNums({ fin, sel }: { fin: Financials; sel: number[] }) {
  const L = useMemo(() => lines(fin), [fin])
  if (!sel.length) return <div className="vt-fin-chart-empty">No years in this window.</div>
  const totals = periodTotals(L, sel)
  const cur = fin.currency
  const n = sel.length
  return (
    <div className="vt-fin-nums">
      <Field label={`Revenue · ${n}y`}>{money(totals.revenue, cur)}</Field>
      <Field label="EBIT">{money(totals.ebit, cur)}</Field>
      <Field label="Net income">{money(totals.netIncome, cur)}</Field>
      <Field label="Operating margin">{fmtPLI(totals.opMargin, "pct")}</Field>
      <Field label="Net margin">{fmtPLI(totals.netMargin, "pct")}</Field>
    </div>
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

function KeyFinancials({ fin, years: yearFilter }: { fin: Financials; years: number[] }) {
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
  const allYears = [...new Set(rows.flatMap(r => Object.keys(r.vals)))].map(Number).sort((a, b) => a - b)
  const years = yearFilter.length ? allYears.filter(y => yearFilter.includes(y)) : allYears
  if (!years.length) return <Centered>No annual figures in this window.</Centered>
  return (
    <div className="vt-fin-scroll">
      <table className="vt-fin-table">
        <thead>
          <tr>
            <th>Line</th>
            {years.map(y => <th key={y}>{y}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td>{r.label}</td>
              {years.map((y, i) => {
                const cur = r.vals[y]
                const v = cur != null ? money(cur, fin.currency) : "—"
                const prev = i > 0 ? r.vals[years[i - 1]] : null
                const c = (i === 0 || cur == null || prev == null || prev === 0) ? null : (cur - prev) / Math.abs(prev)
                const shown = c == null ? "" : `${c >= 0 ? "+" : ""}${(c * 100).toFixed(1)}%`
                return (
                  <td key={y}>
                    <Copyable label={r.label} text={v === "—" ? "" : v}>{v}</Copyable>
                    {shown && <span className={`vt-fin-chg${c != null && c >= 0 ? " is-up" : c != null ? " is-down" : ""}`}>{shown}</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pivot({ fin, years: yearFilter }: { fin: Financials; years: number[] }) {
  const [q, setQ] = useState("")
  const [stmt, setStmt] = useState<string>("all")
  const years = useMemo(() => {
    const all = [...new Set(fin.rows.flatMap(r => Object.keys(r.values)))].map(Number).sort((a, b) => a - b)
    const clipped = yearFilter.length ? all.filter(y => yearFilter.includes(y)) : all
    return clipped.slice(-8)
  }, [fin, yearFilter])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return fin.rows.filter(r => (stmt === "all" || r.statement === stmt) && (!needle || (r.label || "").toLowerCase().includes(needle) || r.concept.toLowerCase().includes(needle)))
  }, [fin, q, stmt])
  const STMTS = [["all", "All"], ["income", "Income"], ["balance", "Balance sheet"], ["cashflow", "Cash flow"], ["other", "Other"]]
  return (
    <div style={{ minWidth: 0, maxWidth: "100%" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 0 }}>
          <Search size={14} strokeWidth={1.5} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-tertiary)" }} />
          <Input controlSize="sm" placeholder="Filter concept…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        <select value={stmt} onChange={e => setStmt(e.target.value)} style={{ height: 32, borderRadius: 2, border: "1px solid #dfdfdf", background: "transparent", color: "var(--color-text)", fontSize: 12, padding: "0 0.6rem" }}>
          {STMTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div className="vt-fin-scroll" style={{ maxHeight: 460, overflow: "auto" }}>
        <table className="vt-fin-table">
          <thead><tr><th>Concept</th>{years.map(y => <th key={y}>FY{y}</th>)}</tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.concept}>
                <td><Copyable label="Concept">{r.label || r.concept}</Copyable></td>
                {years.map(y => {
                  const v = r.values[y] != null ? money(r.values[y], r.currency, r.unit) : "—"
                  return <td key={y}><Copyable label={String(y)} text={v === "—" ? "" : v}>{v}</Copyable></td>
                })}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={years.length + 1} style={{ textAlign: "center", color: "#5d5d5d" }}>No matching concepts.</td></tr>}
          </tbody>
        </table>
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

function FootprintMap({ p, foot, sel, onSel }: {
  p: CompanyProfile
  foot: Footprint | null
  sel: string | null
  onSel: (code: string | null) => void
}) {
  const [world, setWorld] = useState<World | null>(null)
  const [hover, setHover] = useState<{ iso: string; name: string; n: number; x: number; y: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  useEffect(() => { loadWorld().then(setWorld).catch(() => {}) }, [])
  const summary = p.footprint_summary
  const active = useMemo(() => (foot?.countries || []).filter(c => c.entities.length > 0), [foot])
  const byCode = useMemo(() => new Map(active.map(c => [c.code, c])), [active])
  const hqName = p.identity.headquarters?.country || null

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

  function tipFromEvent(iso: string, name: string, e: React.MouseEvent) {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    const n = byCode.get(iso)?.entities.length ?? 0
    setHover({ iso, name, n, x: e.clientX - box.left, y: e.clientY - box.top })
  }

  if (!world || !geo) return <div className="vt-fmap-skel" />

  const { projection, path, byIso, hq } = geo
  const hubLL = hq ?? active.map(a => byIso.get(a.code)).find(Boolean) ?? [0, 20]
  const hubXY = projection(hubLL as [number, number]) ?? [MW / 2, MH / 2]
  const nodes = active
    .map(c => { const ll = byIso.get(c.code); const xy = ll ? projection(ll) : null; return xy ? { c, xy } : null })
    .filter((n): n is { c: Footprint["countries"][number]; xy: [number, number] } => n !== null)
  const markets = summary.n_countries >= 100 ? "100+" : String(summary.n_countries || 0)
  const hot = hover?.iso ?? sel

  return (
    <div className="vt-fmap" ref={wrapRef} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${MW} ${MH}`} className="vt-fmap-svg" preserveAspectRatio="xMidYMid meet">
        {world.features.map((f, i) => {
          const d = path(f)
          if (!d) return null
          const iso = f.properties?.iso || ""
          const name = f.properties?.name || iso
          const present = byCode.has(iso)
          const on = sel === iso
          const isHot = hot === iso
          return (
            <path
              key={i}
              d={d}
              className={`vt-fmap-land${present ? " is-present" : ""}${on ? " is-on" : ""}${isHot ? " is-hot" : ""}`}
              onMouseEnter={e => tipFromEvent(iso, name, e)}
              onMouseMove={e => tipFromEvent(iso, name, e)}
              onClick={() => present && onSel(on ? null : iso)}
            />
          )
        })}
        {nodes.map(({ c, xy }, i) => {
          const mx = (hubXY[0] + xy[0]) / 2, my = (hubXY[1] + xy[1]) / 2
          const lift = Math.hypot(xy[0] - hubXY[0], xy[1] - hubXY[1]) * 0.22
          const lit = hot === c.code || sel === c.code
          return <path key={`a${i}`} d={`M${hubXY[0]} ${hubXY[1]} Q ${mx} ${my - lift} ${xy[0]} ${xy[1]}`} className={lit ? "vt-fmap-arc is-hot" : "vt-fmap-arc"} />
        })}
        {nodes.map(({ c, xy }, i) => {
          const r = 1.8 + Math.min(4.5, Math.sqrt(c.entities.length))
          const lit = hot === c.code || sel === c.code
          return (
            <g
              key={`n${i}`}
              className={lit ? "vt-fmap-node is-lit" : "vt-fmap-node"}
              onMouseEnter={e => tipFromEvent(c.code, c.name, e)}
              onMouseMove={e => tipFromEvent(c.code, c.name, e)}
              onClick={() => onSel(sel === c.code ? null : c.code)}
            >
              <circle cx={xy[0]} cy={xy[1]} r={r * 2.4} className="vt-fmap-halo" />
              <circle cx={xy[0]} cy={xy[1]} r={r} />
            </g>
          )
        })}
        <circle cx={hubXY[0]} cy={hubXY[1]} r={5} className="vt-fmap-hub" />
        <text x={hubXY[0]} y={hubXY[1] - 14} textAnchor="middle" className="vt-fmap-hub-label">{p.identity.legal_name}</text>
      </svg>
      {hover && (
        <div className="vt-fmap-tip" style={{ left: hover.x, top: hover.y }}>
          <strong>{hover.name}</strong>
          {hover.n > 0 ? <span>{hover.n} {hover.n === 1 ? "entity" : "entities"}</span> : <span>No mapped entities</span>}
        </div>
      )}
      <div className="vt-fmap-stats">
        <div><div className="vt-fmap-stat"><Copyable label="Linked entities">{p.group_summary.n_subsidiaries.toLocaleString()}</Copyable></div><div className="vt-fmap-stat-l">Linked entities</div></div>
        <div><div className="vt-fmap-stat"><Copyable label="Markets">{markets}</Copyable></div><div className="vt-fmap-stat-l">Markets</div></div>
        {summary.n_entities > 0 && <div><div className="vt-fmap-stat"><Copyable label="Mapped entities">{summary.n_entities.toLocaleString()}</Copyable></div><div className="vt-fmap-stat-l">Mapped entities</div></div>}
      </div>
    </div>
  )
}

function MapCard({ p, foot, sel, onSel }: {
  p: CompanyProfile
  foot: Footprint | null
  sel: string | null
  onSel: (code: string | null) => void
}) {
  return (
    <div className="vt-fmap-card">
      <h2 style={H}>Map</h2>
      <FootprintMap p={p} foot={foot} sel={sel} onSel={onSel} />
    </div>
  )
}

// ---------------- Group & Footprint workspace ----------------
// Three distinct concepts are kept visually separate: disclosed subsidiary (SEC) · verified legal entity (GLEIF)
// · operational presence (not yet researched).
function StructureTab({ p, foot, group }: { p: CompanyProfile; foot: Footprint | null; group: Group | null }) {
  const id = p.identity, summary = p.footprint_summary
  const ultimate = id.is_subsidiary ? id.parent_legal_name : id.legal_name
  const nSubs = p.group_summary.n_subsidiaries
  const [sel, setSel] = useState<string | null>(null)
  return (
    <div style={{ display: "grid", gap: "1.75rem" }}>
      <MapCard p={p} foot={foot} sel={sel} onSel={setSel} />
      <p style={{ margin: 0, fontSize: "var(--font-text-md-size)", color: "var(--color-text-secondary)" }}>
        <Copyable
          label="Group"
          text={`${ultimate} is ${id.is_subsidiary ? "a controlled subsidiary" : "the ultimate parent of a group"} with ${nSubs.toLocaleString()} disclosed ${nSubs === 1 ? "subsidiary" : "subsidiaries"}${summary.n_countries ? ` across ${summary.n_countries} ${summary.n_countries === 1 ? "country" : "countries"}` : ""}.`}
          block
        >
          <span>
            <strong style={{ color: "var(--color-text)", fontWeight: "var(--font-weight-medium)" }}>{ultimate}</strong>{" "}
            is {id.is_subsidiary ? "a controlled subsidiary" : "the ultimate parent of a group"} with {nSubs.toLocaleString()} disclosed {nSubs === 1 ? "subsidiary" : "subsidiaries"}
            {summary.n_countries ? ` across ${summary.n_countries} ${summary.n_countries === 1 ? "country" : "countries"}` : ""}.
          </span>
        </Copyable>
      </p>

      {/* legal footprint — map + entity panel */}
      <section>
        <h2 style={H}>Legal footprint</h2>
        <LegalFootprintPanel summary={summary} foot={foot} sel={sel} onSel={setSel} />
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

function LegalFootprintPanel({ summary, foot, sel, onSel }: {
  summary: CompanyProfile["footprint_summary"]
  foot: Footprint | null
  sel: string | null
  onSel: (code: string | null) => void
}) {
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
          {withEnt.map(c => { const on = sel === c.code; return <button key={c.code} type="button" onClick={() => onSel(on ? null : c.code)} style={chipStyle(on)}>{c.code} <span style={{ opacity: 0.55 }}>{c.entities.length}</span></button> })}
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
                    <td style={{ ...td, color: "var(--color-text)" }}><Copyable label="Entity" text={e.name}>{e.name}</Copyable></td>
                    <td style={{ ...td, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}><Copyable label="City">{cityOf(e.office)}</Copyable></td>
                    <td style={{ ...td, whiteSpace: "nowrap" }}>{e.status ? <Copyable label="Status" text={e.status}><StatusText status={e.status} /></Copyable> : "—"}</td>
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
                  <td style={{ ...td, color: "var(--color-text)" }}><Copyable label="Subsidiary" text={s.name}>{s.name}</Copyable></td>
                  <td style={{ ...td, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}><Copyable label="Country">{s.jurisdiction || "—"}</Copyable></td>
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
          <div style={{ fontWeight: "var(--font-weight-semibold)", color: "var(--color-text)", marginBottom: 6 }}><Copyable label="Parent" text={parentName}>{parentName}</Copyable> <span style={{ color: "var(--color-text-tertiary)", fontWeight: 400 }}>· parent</span></div>
          <div style={{ display: "grid", gap: 2, maxHeight: 380, overflow: "auto" }}>
            {shown.map((s, i) => <div key={i} style={{ paddingLeft: 14, fontSize: "var(--font-text-sm-size)", color: "var(--color-text-secondary)" }}><Copyable label="Subsidiary" text={s.name}><span style={{ color: "var(--color-text)" }}>{s.name}</span></Copyable>{s.jurisdiction ? ` · ${s.jurisdiction}` : ""}</div>)}
            {rest > 0 && <div style={{ paddingLeft: 14, fontSize: "var(--font-text-xs-size)", color: "var(--color-text-tertiary)" }}>+{rest.toLocaleString()} more</div>}
          </div>
        </div>
      ) : (
        <div style={{ ...CARD, fontFamily: "var(--font-mono, monospace)", fontSize: 12, color: "var(--color-text-secondary)", maxHeight: 380, overflow: "auto", whiteSpace: "pre" }}>
          <div style={{ color: "var(--color-text)" }}><Copyable label="Parent" text={parentName}>{parentName}</Copyable></div>
          {shown.map((s, i) => <div key={i}><Copyable label="Subsidiary" text={s.name}>{(i === shown.length - 1 && rest === 0 ? "└── " : "├── ") + s.name}</Copyable></div>)}
          {rest > 0 && <div>{"└── +" + rest.toLocaleString() + " more"}</div>}
        </div>
      )}
    </div>
  )
}

// ---- small shared bits for the workspace ----
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
  if (!lei) return <span style={{ color: "var(--color-text-tertiary)" }}>—</span>
  return (
    <Copyable label="LEI" text={lei}>
      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--color-text-tertiary)" }}>{lei.slice(0, 8) + "…"}</span>
    </Copyable>
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
function IPTab({ p, ip, summary }: { p: CompanyProfile; ip: IP | null; summary: CompanyProfile["ip_summary"] }) {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  if (summary.count === 0) return <NotResearched what="intellectual-property records" />
  const jur = Object.entries(summary.by_jurisdiction).sort((a, b) => b[1] - a[1])
  const items = ip?.items ?? []
  const listed = ip?.listed ?? items.length
  const filtered = q
    ? items.filter(i => `${i.title || ""} ${i.number || ""} ${i.application || ""}`.toLowerCase().includes(q.toLowerCase()))
    : items
  const PAGE = 50, pages = Math.max(1, Math.ceil(filtered.length / PAGE)), pg = Math.min(page, pages - 1)
  const shown = filtered.slice(pg * PAGE, pg * PAGE + PAGE)
  const lede = listed > 0 && listed < summary.count
    ? `${summary.count.toLocaleString()} granted US patents (USPTO). Showing the ${listed.toLocaleString()} most recently granted.`
    : `${summary.count.toLocaleString()} granted US patents from USPTO.`
  return (
    <div className="vt-ip">
      <section>
        <h2 style={H}>Patent portfolio</h2>
        <p className="vt-ip-lede">{lede}</p>
        <div className="vt-ip-stats">
          <div>
            <div className="vt-ip-stat-label">Total patents</div>
            <Copyable label="Total patents"><div className="vt-ip-stat-value">{summary.count.toLocaleString()}</div></Copyable>
          </div>
          {jur.slice(0, 5).map(([j, n]) => (
            <div key={j}>
              <div className="vt-ip-stat-label">{j}</div>
              <Copyable label={j}><div className="vt-ip-stat-value">{n.toLocaleString()}</div></Copyable>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 style={H}>Patents</h2>
        {!ip ? <Centered>Loading patents…</Centered> : (
          <>
            <div className="vt-ip-filter">
              <Search size={14} strokeWidth={1.5} />
              <Input controlSize="sm" placeholder="Filter by title or number…" value={q} onChange={e => { setQ(e.target.value); setPage(0) }} />
            </div>
            <div className="vt-ip-scroll">
              <table className="vt-ip-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Number</th>
                    <th>Filed</th>
                    <th>Granted</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((it, i) => {
                    const title = it.title || it.number || "—"
                    const copy = [it.title, it.number].filter(Boolean).join(" · ")
                    return (
                      <tr key={`${it.number || it.application || i}`}>
                        <td>
                          <Copyable label="Patent" text={copy}>
                            <span className="vt-ip-title">{title}</span>
                          </Copyable>
                        </td>
                        <td className="vt-ip-num">
                          <Copyable label="Number" text={it.number ?? ""}>
                            {it.uspto
                              ? <a href={it.uspto} target="_blank" rel="noopener noreferrer">{formatPatentNo(it.number)} <ExternalLink size={11} /></a>
                              : formatPatentNo(it.number)}
                          </Copyable>
                        </td>
                        <td className="vt-ip-num"><Copyable label="Filed">{it.filed || "—"}</Copyable></td>
                        <td className="vt-ip-num"><Copyable label="Granted">{it.granted || "—"}</Copyable></td>
                        <td><Copyable label="Status">{it.status || it.type || "—"}</Copyable></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && <div className="vt-ip-pager">
              <button type="button" disabled={pg === 0} onClick={() => setPage(pg - 1)} style={pagerBtn(pg === 0)}>Prev</button>
              <span>Page {pg + 1} of {pages}</span>
              <button type="button" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)} style={pagerBtn(pg >= pages - 1)}>Next</button>
            </div>}
          </>
        )}
      </section>
    </div>
  )
}
function formatPatentNo(value: string | null | undefined): string {
  if (!value) return "—"
  const match = value.match(/^([A-Za-z]*)(\d+)$/)
  if (match && match[2].length >= 7 && match[2].length <= 8) {
    return `${match[1]}${Number(match[2]).toLocaleString("en-US")}`
  }
  return value
}

// ---------------- shared bits ----------------
function Vital({ label, children, copy }: { label: string; children?: React.ReactNode; copy?: string }) {
  const empty = children == null || children === ""
  return (
    <div className="vt-record-vital">
      <dt>{label}</dt>
      <dd className={empty ? "is-empty" : undefined}>{empty ? "—" : <Copyable label={label} text={copy}>{children}</Copyable>}</dd>
    </div>
  )
}
function codeLines(c: CompanyProfile["classification"]): React.ReactNode {
  const rows = [
    c.sic ? `${c.sic} (SIC)` : null,
    c.naics ? `${c.naics} (NAICS)` : null,
    c.nace ? `${c.nace} (NACE)` : null,
  ].filter(Boolean) as string[]
  if (!rows.length) return null
  return <span className="vt-record-codes">{rows.map(row => <span key={row}>{row}</span>)}</span>
}
function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  const empty = children == null || children === ""
  return (
    <div>
      <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-tertiary)", marginBottom: 4 }}>{label}</div>
      {empty
        ? <div style={{ fontSize: "var(--font-text-md-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text-tertiary)" }}>Not on file</div>
        : <Copyable label={label} block><div style={{ fontSize: "var(--font-text-md-size)", fontWeight: "var(--font-weight-medium)", color: "var(--color-text)" }}>{children}</div></Copyable>}
    </div>
  )
}
function FieldCard({ children }: { children: React.ReactNode }) {
  return <div style={{ ...CARD, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1.25rem 1.5rem" }}>{children}</div>
}
function Pill({ children, title }: { children: React.ReactNode; title?: string }) {
  return <span title={title} style={{ display: "inline-block", padding: "2px 10px", borderRadius: 9999, fontSize: "var(--font-text-xs-size)", fontWeight: "var(--font-weight-medium)", background: "var(--color-background-primary-soft)", color: "var(--color-text-secondary)", cursor: title ? "help" : "default" }}>{children}</span>
}
function NotResearched({ what }: { what: string }) {
  return <div style={{ ...CARD, borderStyle: "dashed", color: "var(--color-text-tertiary)", fontSize: "var(--font-text-sm-size)" }}>Not yet researched — {what} isn’t in the current data. This lights up when the research pipeline provides it.</div>
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "3rem", textAlign: "center", color: "var(--color-text-tertiary)", fontSize: "var(--font-text-sm-size)" }}>{children}</div>
}
const btn: React.CSSProperties = { display: "inline-flex", alignItems: "center", padding: "0.4rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", fontSize: "var(--font-text-sm-size)", cursor: "pointer" }
function prettyPlace(s: string | null | undefined): string {
  if (!s) return ""
  const t = s.trim()
  if (!t) return ""
  if (t.length <= 3) return t.toUpperCase()
  return t.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())
}
function hostOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, "") } catch { return url.replace(/^https?:\/\//, "").replace(/^www\./, "") }
}
function monogram(name: string): string {
  const skip = new Set(["inc", "inc.", "corp", "corp.", "corporation", "ltd", "ltd.", "llc", "plc", "sa", "ag", "nv", "co", "co.", "the", "and", "of", "company"])
  const words = name.split(/[\s,/]+/).filter(w => !skip.has(w.toLowerCase().replace(/[.,]/g, "")))
  if (!words.length) return name.slice(0, 1).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
const pagerBtn = (disabled: boolean): React.CSSProperties => ({ padding: "0.3rem 0.8rem", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)", background: "var(--color-surface)", color: disabled ? "var(--color-text-tertiary)" : "var(--color-text)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1 })
