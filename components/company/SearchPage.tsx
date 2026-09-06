"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKey, type MouseEvent as ReactMouse, type ReactNode } from "react"
import { Check, ChevronDown, Search, Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectControl } from "@/components/ui/select-control"
import { loadIndex, money, type IndexRow } from "@/lib/companies"
import { useSavedCompanies } from "@/lib/saved-companies"

type Scheme = "sic" | "naics" | "nace"
type Mode = "inc" | "exc"
type FacetKey = "sector" | "hq" | "op" | "subs" | "region" | "exchange" | "std" | "tags" | "conf"
const FACETS: FacetKey[] = ["sector", "hq", "op", "subs", "region", "exchange", "std", "tags", "conf"]
type SetMap = Record<FacetKey, Set<string>>
type Filters = { inc: SetMap; exc: SetMap; revMin: number; revMax: number; hasRnd: boolean; hasPatents: boolean; hasIntl: boolean }
type Query = { q: string; scheme: Scheme; classQ: string; classCodes: string[]; filters: Filters }

// Revenue range — log scale from $1M to $1T so millions and billions are both reachable on one slider.
const REV_MIN = 1e6, REV_MAX = 1e12, REV_STEPS = 240
const posToVal = (p: number) => REV_MIN * Math.pow(REV_MAX / REV_MIN, p / REV_STEPS)
const valToPos = (v: number) => Math.round(REV_STEPS * Math.log(Math.max(v, REV_MIN) / REV_MIN) / Math.log(REV_MAX / REV_MIN))
const clampNum = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
const roundSig = (v: number) => { if (v <= 0) return 0; const m = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / m) * m }

const SUBS_BANDS: [string, (n: number) => boolean][] = [
  ["200+", n => n >= 200], ["51–200", n => n >= 51 && n < 200], ["11–50", n => n >= 11 && n < 51], ["1–10", n => n >= 1 && n < 11], ["None", n => n === 0],
]
const subsBand = (n: number) => SUBS_BANDS.find(([, fn]) => fn(n))?.[0] ?? "None"

const emptySetMap = (): SetMap => Object.fromEntries(FACETS.map(k => [k, new Set<string>()])) as SetMap
const emptyFilters = (): Filters => {
  const inc = emptySetMap()
  // Default search scope: North + South America headquarters.
  inc.region = new Set(["Americas"])
  return { inc, exc: emptySetMap(), revMin: REV_MIN, revMax: REV_MAX, hasRnd: false, hasPatents: false, hasIntl: false }
}
const emptyQuery = (): Query => ({ q: "", scheme: "sic", classQ: "", classCodes: [], filters: emptyFilters() })

function classFields(r: IndexRow, scheme: Scheme): { code: string | null; label: string | null } {
  if (scheme === "naics") return { code: r.naics, label: r.naics }
  if (scheme === "nace") return { code: r.nace, label: r.nace }
  return { code: r.sic, label: r.sic_description }
}
function matchesClass(r: IndexRow, scheme: Scheme, codes: string[], typed: string) {
  const needles = codes.length ? codes : typed.trim() ? [typed.trim()] : []
  if (!needles.length) return true
  const { code, label } = classFields(r, scheme)
  const c = (code ?? "").toLowerCase(), l = (label ?? "").toLowerCase()
  return needles.some(n => { const t = n.toLowerCase(); return c.startsWith(t) || l.includes(t) })
}

// The value(s) of a row for a given facet — single-valued facets return a 1-item array.
function facetVals(r: IndexRow, key: FacetKey): string[] {
  switch (key) {
    case "sector": return r.sector ? [r.sector] : []
    case "hq": return r.hq_country ? [r.hq_country] : []
    case "op": return r.op_countries
    case "subs": return [subsBand(r.n_subsidiaries)]
    case "region": return r.hq_region ? [r.hq_region] : []
    case "exchange": return r.exchange ? [r.exchange] : []
    case "std": return r.accounting_standard ? [r.accounting_standard] : []
    case "tags": return r.activity_tags
    case "conf": return r.confidence ? [r.confidence] : []
  }
}

function activeCount(q: Query): number {
  let n = q.classCodes.length + (q.filters.hasRnd ? 1 : 0) + (q.filters.hasPatents ? 1 : 0) + (q.filters.hasIntl ? 1 : 0)
  if (q.filters.revMin > REV_MIN || q.filters.revMax < REV_MAX) n += 1
  for (const k of FACETS) n += q.filters.inc[k].size + q.filters.exc[k].size
  return n
}
const isActive = (q: Query) => q.q.trim() !== "" || q.classQ.trim() !== "" || activeCount(q) > 0

// ---- saved searches (persisted filter sets) ----
type StoredQuery = { id: string; name: string; q: string; scheme: Scheme; classCodes: string[]; inc: Record<string, string[]>; exc: Record<string, string[]>; revMin?: number; revMax?: number; hasRnd: boolean; hasPatents: boolean; hasIntl: boolean }
const SAVED_KEY = "veritax.savedSearches"
function fingerprint(q: Query): string {
  return JSON.stringify([q.q.trim(), q.scheme, [...q.classCodes].sort(), FACETS.map(k => [...q.filters.inc[k]].sort()), FACETS.map(k => [...q.filters.exc[k]].sort()), q.filters.revMin, q.filters.revMax, q.filters.hasRnd, q.filters.hasPatents, q.filters.hasIntl])
}
function serializeQuery(q: Query, name: string): StoredQuery {
  const inc: Record<string, string[]> = {}, exc: Record<string, string[]> = {}
  for (const k of FACETS) { inc[k] = [...q.filters.inc[k]]; exc[k] = [...q.filters.exc[k]] }
  return { id: fingerprint(q), name, q: q.q.trim(), scheme: q.scheme, classCodes: [...q.classCodes], inc, exc, revMin: q.filters.revMin, revMax: q.filters.revMax, hasRnd: q.filters.hasRnd, hasPatents: q.filters.hasPatents, hasIntl: q.filters.hasIntl }
}
function deserializeQuery(s: StoredQuery): Query {
  const inc = emptySetMap(), exc = emptySetMap()
  for (const k of FACETS) { inc[k] = new Set(s.inc?.[k] || []); exc[k] = new Set(s.exc?.[k] || []) }
  const scheme: Scheme = s.scheme === "naics" || s.scheme === "nace" ? s.scheme : "sic"
  return { q: s.q || "", scheme, classQ: "", classCodes: Array.isArray(s.classCodes) ? s.classCodes : [], filters: { inc, exc, revMin: typeof s.revMin === "number" ? s.revMin : REV_MIN, revMax: typeof s.revMax === "number" ? s.revMax : REV_MAX, hasRnd: !!s.hasRnd, hasPatents: !!s.hasPatents, hasIntl: !!s.hasIntl } }
}
function labelOf(q: Query): string {
  const bits: string[] = []
  if (q.q.trim()) bits.push(`"${q.q.trim()}"`)
  if (q.classCodes.length) bits.push(`${q.scheme.toUpperCase()} ${q.classCodes.join(", ")}`)
  if (q.filters.revMin > REV_MIN || q.filters.revMax < REV_MAX) {
    const lo = q.filters.revMin > REV_MIN ? money(q.filters.revMin, "USD") : null
    const hi = q.filters.revMax < REV_MAX ? money(q.filters.revMax, "USD") : null
    bits.push(lo && hi ? `${lo}–${hi}` : lo ? `≥${lo}` : `≤${hi}`)
  }
  for (const k of FACETS) { for (const v of q.filters.inc[k]) bits.push(v); for (const v of q.filters.exc[k]) bits.push(`−${v}`) }
  if (q.filters.hasRnd) bits.push("R&D")
  if (q.filters.hasPatents) bits.push("Patents")
  if (q.filters.hasIntl) bits.push("International")
  if (!bits.length) return "All companies"
  return bits.length > 3 ? `${bits.slice(0, 3).join(" · ")} …` : bits.join(" · ")
}

export default function SearchPage({ onOpen }: { onOpen: (slug: string) => void }) {
  const [rows, setRows] = useState<IndexRow[] | null>(null)
  const [err, setErr] = useState(false)
  const [query, setQuery] = useState<Query>(emptyQuery)
  const [classOpen, setClassOpen] = useState(false)
  const [classIdx, setClassIdx] = useState(0)
  const [sort, setSort] = useState("revenue")
  const [activeIdx, setActiveIdx] = useState(0)
  const [searches, setSearches] = useState<StoredQuery[]>([])
  const [saved, toggleSave] = useSavedCompanies()
  const inputRef = useRef<HTMLInputElement>(null)
  const classRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLTableSectionElement>(null)

  useEffect(() => { loadIndex().then(setRows).catch(() => setErr(true)) }, [])
  useEffect(() => { try { const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]"); if (Array.isArray(raw)) setSearches(raw) } catch { /* ignore */ } }, [])
  useEffect(() => {
    const close = (e: MouseEvent) => { if (classRef.current && !classRef.current.contains(e.target as Node)) setClassOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag) && !(e.target as HTMLElement).isContentEditable) {
        e.preventDefault(); inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const catalog = useMemo(() => {
    if (!rows) return []
    const map = new Map<string, string>()
    for (const r of rows) {
      const { code, label } = classFields(r, query.scheme)
      if (!code) continue
      if (!map.has(code)) map.set(code, label && label !== code ? label : "")
    }
    return [...map.entries()].map(([code, label]) => ({ code, label })).sort((a, b) => a.code.localeCompare(b.code))
  }, [rows, query.scheme])

  const classHits = useMemo(() => {
    const n = query.classQ.trim().toLowerCase()
    const selected = new Set(query.classCodes)
    const list = catalog.filter(c => !n || c.code.toLowerCase().startsWith(n) || c.label.toLowerCase().includes(n))
    return [...list.filter(c => selected.has(c.code)), ...list.filter(c => !selected.has(c.code))].slice(0, 8)
  }, [catalog, query.classQ, query.classCodes])

  const active = isActive(query)

  const results = useMemo(() => {
    if (!rows || !active) return []
    const needle = query.q.trim().toLowerCase()
    const f = query.filters
    const out = rows.filter(r => {
      if (needle && ![r.name, r.ticker, r.sic, r.sic_description, r.naics, r.nace, r.sector, r.keywords, r.activity_tags.join(" ")].join(" ").toLowerCase().includes(needle)) return false
      if (!matchesClass(r, query.scheme, query.classCodes, query.classQ)) return false
      for (const k of FACETS) {
        const vals = facetVals(r, k)
        if (f.inc[k].size && !vals.some(v => f.inc[k].has(v))) return false
        if (f.exc[k].size && vals.some(v => f.exc[k].has(v))) return false
      }
      if (f.revMin > REV_MIN && (r.revenue_latest == null || r.revenue_latest < f.revMin)) return false
      if (f.revMax < REV_MAX && (r.revenue_latest == null || r.revenue_latest > f.revMax)) return false
      if (f.hasRnd && !r.has_rnd) return false
      if (f.hasPatents && !r.has_patents) return false
      if (f.hasIntl && !r.has_international) return false
      return true
    })
    out.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name)
      if (sort === "ticker") return (a.ticker || "").localeCompare(b.ticker || "")
      if (sort === "class") return (classFields(a, query.scheme).code || "").localeCompare(classFields(b, query.scheme).code || "")
      if (sort === "hq") return (a.hq_country || "").localeCompare(b.hq_country || "")
      if (sort === "sector") return (a.sector || "").localeCompare(b.sector || "")
      return Number(b.revenue_latest || 0) - Number(a.revenue_latest || 0)
    })
    return out
  }, [rows, active, query, sort])

  useEffect(() => { setActiveIdx(0) }, [query, sort])
  useEffect(() => { setClassIdx(0) }, [query.classQ, query.scheme])
  useEffect(() => { listRef.current?.querySelector("[data-active='true']")?.scrollIntoView({ block: "nearest" }) }, [activeIdx])

  function counts(valueOf: (r: IndexRow) => string[] | string | null, alpha = false): [string, number][] {
    if (!rows) return []
    const map = new Map<string, number>()
    for (const r of rows) {
      const v = valueOf(r)
      const vals = Array.isArray(v) ? v : v != null ? [v] : []
      for (const x of vals) map.set(x, (map.get(x) || 0) + 1)
    }
    return [...map.entries()].sort((a, b) => alpha ? a[0].localeCompare(b[0]) : b[1] - a[1])
  }

  function toggleClass(code: string) {
    setQuery(s => ({ ...s, classQ: "", classCodes: s.classCodes.includes(code) ? s.classCodes.filter(x => x !== code) : [...s.classCodes, code] }))
  }
  function toggleFacet(key: FacetKey, mode: Mode, v: string) {
    setQuery(s => {
      const inc = new Set(s.filters.inc[key]), exc = new Set(s.filters.exc[key])
      if (mode === "inc") { if (inc.has(v)) inc.delete(v); else { inc.add(v); exc.delete(v) } }
      else { if (exc.has(v)) exc.delete(v); else { exc.add(v); inc.delete(v) } }
      return { ...s, filters: { ...s.filters, inc: { ...s.filters.inc, [key]: inc }, exc: { ...s.filters.exc, [key]: exc } } }
    })
  }
  const toggleFlag = (k: "hasRnd" | "hasPatents" | "hasIntl") => setQuery(s => ({ ...s, filters: { ...s.filters, [k]: !s.filters[k] } }))
  const setRev = (min: number, max: number) => setQuery(s => ({ ...s, filters: { ...s.filters, revMin: min, revMax: max } }))

  function persistSearches(next: StoredQuery[]) { setSearches(next); try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)) } catch { /* ignore */ } }
  function saveCurrent() { if (!isActive(query)) return; const s = serializeQuery(query, labelOf(query)); persistSearches([s, ...searches.filter(x => x.id !== s.id)].slice(0, 20)) }
  function removeSaved(id: string) { persistSearches(searches.filter(x => x.id !== id)) }

  function onMainKey(e: ReactKey<HTMLInputElement>) {
    if (e.key === "Escape") { if (classOpen) setClassOpen(false); return }
    if (!active) return
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, Math.max(results.length - 1, 0))) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === "Enter" && results[activeIdx]) { e.preventDefault(); onOpen(results[activeIdx].slug) }
  }
  function onClassKey(e: ReactKey<HTMLInputElement>) {
    if (e.key === "Escape") { e.preventDefault(); setClassOpen(false); return }
    if (e.key === "Backspace" && !query.classQ && query.classCodes.length) { e.preventDefault(); toggleClass(query.classCodes[query.classCodes.length - 1]); return }
    if (classOpen && classHits.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setClassIdx(i => Math.min(i + 1, classHits.length - 1)); return }
      if (e.key === "ArrowUp") { e.preventDefault(); setClassIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === "Enter" && classHits[classIdx]) { e.preventDefault(); toggleClass(classHits[classIdx].code); return }
    }
    onMainKey(e)
  }

  if (err) {
    return (
      <div className="vt-search">
        <div className="vt-search-status" role="alert">
          <p style={{ margin: 0, color: "var(--color-text)" }}>The company index did not load.</p>
          <Button size="sm" variant="outline" onClick={() => { setErr(false); setRows(null); loadIndex().then(setRows).catch(() => setErr(true)) }}>Retry load</Button>
        </div>
      </div>
    )
  }
  if (!rows) {
    return <div className="vt-search"><div className="vt-search-status" aria-busy="true"><div className="vt-search-skel vt-skeleton" /></div></div>
  }

  const schemePlaceholder = query.scheme === "sic" ? "Code or industry" : query.scheme === "naics" ? "NAICS code" : "NACE code"
  const classCol = query.scheme.toUpperCase()
  const nActive = activeCount(query)

  function th(key: string, label: string, right = false) {
    return <th className={sort === key ? "is-on" : undefined} style={right ? { textAlign: "right" } : undefined} aria-sort={sort === key ? "descending" : "none"} onClick={() => setSort(key)}>{label}</th>
  }

  return (
    <div className="vt-search vt-search--split">
      {/* permanent filter panel — live: results update as you change filters */}
      <aside className="vt-search-panel" aria-label="Filters">
        <div className="vt-search-panel-head">
          <span>Filters{nActive ? ` · ${nActive}` : ""}</span>
          {nActive ? <button type="button" className="vt-search-panel-clear" onClick={() => setQuery(emptyQuery())}>Clear</button> : null}
        </div>
        <div className="vt-search-panel-body">
          {searches.length > 0 && (
            <Collapsible label="Saved searches" count={searches.length} defaultOpen>
              <div className="vt-search-saved">
                {searches.map(s => {
                  const label = labelOf(deserializeQuery(s))
                  return (
                    <div key={s.id} className="vt-search-saved-row" onMouseEnter={marqueeOn} onMouseLeave={marqueeOff}>
                      <button type="button" className="vt-search-hint" title={label} onClick={() => setQuery(deserializeQuery(s))}>
                        <span className="vt-search-hint-body"><span className="vt-search-name">{label}</span></span>
                      </button>
                      <button type="button" className="vt-search-saved-del" aria-label={`Delete saved search ${label}`} onClick={() => removeSaved(s.id)}>
                        <X size={13} strokeWidth={1.5} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </Collapsible>
          )}
          <Collapsible label="Classification" count={query.classCodes.length} defaultOpen>
            <div className="vt-search-class-row" ref={classRef}>
              <div className="vt-search-class-scheme">
                <span className="vt-sr-only">Classification system</span>
                <SelectControl size="md" variant="outline" block className="vt-search-scheme-trigger" value={query.scheme}
                  onValueChange={v => { setQuery(s => ({ ...s, scheme: v as Scheme, classQ: "", classCodes: [] })); setClassOpen(false) }}>
                  <SelectControl.Item value="sic">SIC</SelectControl.Item>
                  <SelectControl.Item value="naics">NAICS</SelectControl.Item>
                  <SelectControl.Item value="nace">NACE</SelectControl.Item>
                </SelectControl>
              </div>
              <div className="vt-search-class-field">
                {query.classCodes.map(code => (
                  <button key={code} type="button" className="vt-search-class-chip" aria-label={`Remove ${code}`} onClick={() => toggleClass(code)}>{code}<X size={10} strokeWidth={2} /></button>
                ))}
                <label htmlFor="vt-search-class" className="vt-sr-only">Search {query.scheme.toUpperCase()} codes</label>
                <input id="vt-search-class" className="vt-search-class-type" value={query.classQ} placeholder={query.classCodes.length ? "Add code" : schemePlaceholder} autoComplete="off"
                  onChange={e => { setQuery(s => ({ ...s, classQ: e.target.value })); setClassOpen(true) }} onFocus={() => setClassOpen(true)} onKeyDown={onClassKey} />
                {classOpen && classHits.length > 0 && (
                  <ul className="vt-search-class-menu" role="listbox" aria-multiselectable="true" aria-label={`${query.scheme.toUpperCase()} codes`}>
                    {classHits.map((c, i) => {
                      const on = query.classCodes.includes(c.code)
                      return (
                        <li key={c.code} role="presentation">
                          <button type="button" className={i === classIdx || on ? "vt-search-class-opt is-active" : "vt-search-class-opt"} aria-selected={on} onClick={() => toggleClass(c.code)} onMouseEnter={() => setClassIdx(i)}>
                            <span><span className="vt-search-class-code">{c.code}</span>{c.label ? <span className="vt-search-class-label">{c.label}</span> : null}</span>
                            {on ? <Check size={12} strokeWidth={2.5} aria-hidden /> : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          </Collapsible>
          <FilterSelect label="Industry" opts={counts(r => r.sector)} inc={query.filters.inc.sector} exc={query.filters.exc.sector} onToggle={(m, v) => toggleFacet("sector", m, v)} searchable />
          <FilterSelect label="Headquarters" opts={counts(r => r.hq_country, true)} inc={query.filters.inc.hq} exc={query.filters.exc.hq} onToggle={(m, v) => toggleFacet("hq", m, v)} searchable />
          <Collapsible label="Revenue" count={query.filters.revMin > REV_MIN || query.filters.revMax < REV_MAX ? 1 : 0}>
            <RevenueRange min={query.filters.revMin} max={query.filters.revMax} onChange={setRev} />
          </Collapsible>
          <FilterSelect label="Operates in" opts={counts(r => r.op_countries, true)} inc={query.filters.inc.op} exc={query.filters.exc.op} onToggle={(m, v) => toggleFacet("op", m, v)} searchable />
          <FilterSelect label="Region" opts={counts(r => r.hq_region)} inc={query.filters.inc.region} exc={query.filters.exc.region} onToggle={(m, v) => toggleFacet("region", m, v)} />
          <FilterSelect label="Exchange" opts={counts(r => r.exchange)} inc={query.filters.inc.exchange} exc={query.filters.exc.exchange} onToggle={(m, v) => toggleFacet("exchange", m, v)} />
          <FilterSelect label="Accounting" opts={counts(r => r.accounting_standard)} inc={query.filters.inc.std} exc={query.filters.exc.std} onToggle={(m, v) => toggleFacet("std", m, v)} />
          <FilterSelect label="Activity" opts={counts(r => r.activity_tags)} inc={query.filters.inc.tags} exc={query.filters.exc.tags} onToggle={(m, v) => toggleFacet("tags", m, v)} searchable />
          <Collapsible label="Characteristics" count={(query.filters.hasRnd ? 1 : 0) + (query.filters.hasPatents ? 1 : 0) + (query.filters.hasIntl ? 1 : 0)}>
            <div className="vt-search-filter-opts">
              <button type="button" className={query.filters.hasRnd ? "vt-search-chip is-on" : "vt-search-chip"} onClick={() => toggleFlag("hasRnd")}>R&D</button>
              <button type="button" className={query.filters.hasPatents ? "vt-search-chip is-on" : "vt-search-chip"} onClick={() => toggleFlag("hasPatents")}>Patents</button>
              <button type="button" className={query.filters.hasIntl ? "vt-search-chip is-on" : "vt-search-chip"} onClick={() => toggleFlag("hasIntl")}>International</button>
            </div>
          </Collapsible>
        </div>
        <div className="vt-search-panel-foot">
          <Button type="button" variant="outline" size="sm" block disabled={!active} onClick={saveCurrent}>Save search</Button>
        </div>
      </aside>

      {/* search bar + live results */}
      <div className="vt-search-main">
        <form className="vt-search-bar" onSubmit={(e: FormEvent) => e.preventDefault()}>
          <div className="vt-search-instrument">
            <button type="submit" className="vt-search-submit" aria-label="Search"><Search size={20} strokeWidth={1.5} /></button>
            <label htmlFor="vt-search-q" className="vt-sr-only">Search companies</label>
            <input id="vt-search-q" ref={inputRef} className="vt-search-input" value={query.q} onChange={e => setQuery(s => ({ ...s, q: e.target.value }))} onKeyDown={onMainKey} placeholder="Search companies" autoComplete="off" autoCorrect="off" spellCheck={false} />
            {query.q && (
              <div className="vt-search-actions">
                <Button type="button" variant="ghost" size="xs" aria-label="Clear search" onClick={() => setQuery(s => ({ ...s, q: "" }))}><X size={16} strokeWidth={1.5} /></Button>
              </div>
            )}
          </div>
        </form>

        <div className="vt-search-main-body">
          {active ? (
            <div className="vt-search-body">
              <div className="vt-search-table-meta">{results.length.toLocaleString()} {results.length === 1 ? "company" : "companies"}</div>
              {results.length === 0 ? (
                <p className="vt-search-empty">No companies match. Adjust a filter.</p>
              ) : (
                <div className="vt-search-table-wrap">
                  <table className="vt-search-table">
                    <thead>
                      <tr>
                        {th("name", "Company")}
                        {th("ticker", "Ticker")}
                        {th("class", classCol)}
                        {th("sector", "Industry")}
                        {th("hq", "HQ")}
                        {th("revenue", "Revenue", true)}
                        <th aria-label="Save" />
                      </tr>
                    </thead>
                    <tbody ref={listRef}>
                      {results.map((r, i) => {
                        const isSaved = saved.has(r.slug)
                        const cls = classFields(r, query.scheme)
                        return (
                          <tr key={r.slug} data-active={i === activeIdx || undefined} className={i === activeIdx ? "is-active" : undefined} onClick={() => onOpen(r.slug)} onMouseEnter={() => setActiveIdx(i)}>
                            <td><span className="vt-search-name">{r.name}</span></td>
                            <td className="is-muted">{r.ticker ?? ""}</td>
                            <td className="is-muted">{[cls.code, cls.label && cls.label !== cls.code ? cls.label : null].filter(Boolean).join(" · ")}</td>
                            <td className="is-muted">{r.sector ?? ""}</td>
                            <td className="is-muted">{r.hq_country ?? ""}</td>
                            <td className="is-num">{money(r.revenue_latest, r.currency)}</td>
                            <td>
                              <button type="button" className={isSaved ? "vt-search-star is-on" : "vt-search-star"} title={isSaved ? "Remove from saved" : "Save company"} aria-label={isSaved ? "Remove from saved" : "Save company"} onClick={e => { e.stopPropagation(); toggleSave(r.slug) }}>
                                <Star size={15} strokeWidth={1.5} fill={isSaved ? "currentColor" : "none"} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="vt-search-intro">
              <p className="vt-search-hint-empty">Pick a filter on the left or type a company name — results update as you go.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Collapsible({ label, count, defaultOpen = false, children }: { label: string; count?: number; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="vt-search-cat">
      <button type="button" className="vt-search-cat-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="vt-search-cat-name">{label}{count ? <span className="vt-search-cat-count">{count}</span> : null}</span>
        <ChevronDown size={15} strokeWidth={1.5} className="vt-search-cat-chev" style={{ transform: open ? "rotate(180deg)" : "none" }} aria-hidden />
      </button>
      {open && <div className="vt-search-cat-body">{children}</div>}
    </div>
  )
}

// Collapsible filter category with an Include/Exclude toggle + searchable dropdown (chips for each).
function FilterSelect({ label, opts, inc, exc, onToggle, searchable = false }: { label: string; opts: [string, number][]; inc: Set<string>; exc: Set<string>; onToggle: (mode: Mode, v: string) => void; searchable?: boolean }) {
  const [mode, setMode] = useState<Mode>("inc")
  const [q, setQ] = useState("")
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menu])
  if (opts.length === 0) return null
  const cur = mode === "inc" ? inc : exc
  const shown = q ? opts.filter(([v]) => v.toLowerCase().includes(q.toLowerCase())) : opts
  return (
    <Collapsible label={label} count={inc.size + exc.size}>
      <div className="vt-search-mode" role="group" aria-label={`${label} include or exclude`}>
        <button type="button" className={mode === "inc" ? "is-on" : undefined} aria-pressed={mode === "inc"} onClick={() => setMode("inc")}>Include</button>
        <button type="button" className={mode === "exc" ? "is-on is-exclude" : undefined} aria-pressed={mode === "exc"} onClick={() => setMode("exc")}>Exclude</button>
      </div>
      <div className="vt-search-class-field" ref={ref} onClick={() => setMenu(true)}>
        {[...inc].map(v => (
          <button key={"i" + v} type="button" className="vt-search-class-chip" aria-label={`Remove include ${v}`} onClick={e => { e.stopPropagation(); onToggle("inc", v) }}>{v}<X size={10} strokeWidth={2} /></button>
        ))}
        {[...exc].map(v => (
          <button key={"e" + v} type="button" className="vt-search-class-chip is-exclude" aria-label={`Remove exclude ${v}`} onClick={e => { e.stopPropagation(); onToggle("exc", v) }}>−{v}<X size={10} strokeWidth={2} /></button>
        ))}
        <input className="vt-search-class-type" value={q} placeholder={mode === "inc" ? "Include" : "Exclude"} autoComplete="off" readOnly={!searchable} onChange={e => setQ(e.target.value)} onFocus={() => setMenu(true)} />
        {menu && (
          <ul className="vt-search-class-menu" role="listbox" aria-multiselectable="true" aria-label={label}>
            {shown.slice(0, 60).map(([v, n]) => {
              const on = cur.has(v)
              return (
                <li key={v} role="presentation">
                  <button type="button" className={on ? "vt-search-class-opt is-active" : "vt-search-class-opt"} aria-selected={on} onClick={() => onToggle(mode, v)}>
                    <span><span className="vt-search-class-code">{v}</span><span className="vt-search-class-label">{n}</span></span>
                    {on ? <Check size={12} strokeWidth={2.5} aria-hidden /> : null}
                  </button>
                </li>
              )
            })}
            {shown.length === 0 && <li role="presentation"><span className="vt-search-class-opt" style={{ color: "var(--color-text-tertiary)" }}>No matches</span></li>}
          </ul>
        )}
      </div>
    </Collapsible>
  )
}

// Revenue range: a log-scale dual slider (so M and B are both reachable) with an M/B unit dropdown per side.
function RevenueRange({ min, max, onChange }: { min: number; max: number; onChange: (min: number, max: number) => void }) {
  const [minUnit, setMinUnit] = useState<"M" | "B">(min >= 1e9 ? "B" : "M")
  const [maxUnit, setMaxUnit] = useState<"M" | "B">(max >= 1e9 ? "B" : "M")
  const minPos = valToPos(min), maxPos = valToPos(max)
  const GAP = 4
  const mult = (u: "M" | "B") => (u === "B" ? 1e9 : 1e6)
  const fmtNum = (v: number, u: "M" | "B") => String(Math.round((v / mult(u)) * 100) / 100)
  const onMinSlide = (p: number) => onChange(clampNum(roundSig(posToVal(Math.min(p, maxPos - GAP))), REV_MIN, max), max)
  const onMaxSlide = (p: number) => onChange(min, clampNum(roundSig(posToVal(Math.max(p, minPos + GAP))), min, REV_MAX))
  const onMinNum = (str: string) => onChange(clampNum((parseFloat(str) || 0) * mult(minUnit), REV_MIN, max), max)
  const onMaxNum = (str: string) => onChange(min, clampNum((parseFloat(str) || 0) * mult(maxUnit), min, REV_MAX))
  return (
    <div className="vt-rev">
      <div className="vt-range">
        <div className="vt-range-track"><div className="vt-range-fill" style={{ left: `${(minPos / REV_STEPS) * 100}%`, right: `${100 - (maxPos / REV_STEPS) * 100}%` }} /></div>
        <input type="range" className="vt-range-input" min={0} max={REV_STEPS} value={minPos} aria-label="Minimum revenue" onChange={e => onMinSlide(Number(e.target.value))} />
        <input type="range" className="vt-range-input" min={0} max={REV_STEPS} value={maxPos} aria-label="Maximum revenue" onChange={e => onMaxSlide(Number(e.target.value))} />
      </div>
      <div className="vt-rev-ends">
        <div className="vt-rev-end">
          <span className="vt-rev-cur">$</span>
          <Input controlSize="sm" className="vt-rev-num" inputMode="decimal" value={fmtNum(min, minUnit)} onChange={e => onMinNum(e.target.value)} aria-label="Minimum revenue value" />
          <SelectControl size="sm" variant="outline" value={minUnit} onValueChange={v => setMinUnit(v as "M" | "B")}>
            <SelectControl.Item value="M">M</SelectControl.Item>
            <SelectControl.Item value="B">B</SelectControl.Item>
          </SelectControl>
        </div>
        <span className="vt-rev-dash">–</span>
        <div className="vt-rev-end">
          <span className="vt-rev-cur">$</span>
          <Input controlSize="sm" className="vt-rev-num" inputMode="decimal" value={fmtNum(max, maxUnit)} onChange={e => onMaxNum(e.target.value)} aria-label="Maximum revenue value" />
          <SelectControl size="sm" variant="outline" value={maxUnit} onValueChange={v => setMaxUnit(v as "M" | "B")}>
            <SelectControl.Item value="M">M</SelectControl.Item>
            <SelectControl.Item value="B">B</SelectControl.Item>
          </SelectControl>
        </div>
      </div>
    </div>
  )
}

// On hover, if the label overflows its row, scroll it left to reveal the rest (distance measured live).
function marqueeOn(e: ReactMouse<HTMLDivElement>) {
  const el = e.currentTarget.querySelector<HTMLElement>(".vt-search-name")
  if (!el) return
  const dx = el.scrollWidth - el.clientWidth
  if (dx > 4) { el.style.setProperty("--vt-dx", `${dx}px`); el.classList.add("is-scrolling") }
}
function marqueeOff(e: ReactMouse<HTMLDivElement>) {
  const el = e.currentTarget.querySelector<HTMLElement>(".vt-search-name")
  if (!el) return
  el.classList.remove("is-scrolling"); el.style.removeProperty("--vt-dx")
}
