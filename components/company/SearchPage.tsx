"use client"

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKey, type ReactNode } from "react"
import { Check, ChevronDown, Search, Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SelectControl } from "@/components/ui/select-control"
import { loadIndex, money, type IndexRow } from "@/lib/companies"
import { useSavedCompanies } from "@/lib/saved-companies"

type Scheme = "sic" | "naics" | "nace"
type StringSet = Set<string>
type Filters = {
  sector: StringSet; hq: StringSet; op: StringSet; rev: StringSet; subs: StringSet
  region: StringSet; exchange: StringSet; std: StringSet; tags: StringSet; conf: StringSet
  hasRnd: boolean; hasPatents: boolean; hasIntl: boolean
}
type Query = { q: string; scheme: Scheme; classQ: string; classCodes: string[]; filters: Filters }
type StoredFilters = {
  sector: string[]; hq: string[]; op: string[]; rev: string[]; subs: string[]
  region: string[]; exchange: string[]; std: string[]; tags: string[]; conf: string[]
  hasRnd: boolean; hasPatents: boolean; hasIntl: boolean
}
type StoredQuery = { q: string; scheme: Scheme; classQ: string; classCodes: string[]; at: number; filters: StoredFilters }

const RECENT_KEY = "veritax.recentSearches"
const RECENT_N = 3

const REV_BANDS: [string, (n: number | null) => boolean][] = [
  [">$100B", n => n != null && n >= 100e9], ["$50–100B", n => n != null && n >= 50e9 && n < 100e9],
  ["$10–50B", n => n != null && n >= 10e9 && n < 50e9], ["$1–10B", n => n != null && n >= 1e9 && n < 10e9],
  ["<$1B", n => n != null && n < 1e9],
]
const revBand = (n: number | null) => REV_BANDS.find(([, fn]) => fn(n))?.[0] ?? "<$1B"
const SUBS_BANDS: [string, (n: number) => boolean][] = [
  ["200+", n => n >= 200], ["51–200", n => n >= 51 && n < 200], ["11–50", n => n >= 11 && n < 51], ["1–10", n => n >= 1 && n < 11], ["None", n => n === 0],
]
const subsBand = (n: number) => SUBS_BANDS.find(([, fn]) => fn(n))?.[0] ?? "None"

const emptyFilters = (): Filters => ({
  sector: new Set(), hq: new Set(), op: new Set(), rev: new Set(), subs: new Set(),
  region: new Set(), exchange: new Set(), std: new Set(), tags: new Set(), conf: new Set(),
  hasRnd: false, hasPatents: false, hasIntl: false,
})
const emptyQuery = (): Query => ({ q: "", scheme: "sic", classQ: "", classCodes: [], filters: emptyFilters() })

function copyFilters(f: Filters): Filters {
  return {
    sector: new Set(f.sector), hq: new Set(f.hq), op: new Set(f.op), rev: new Set(f.rev), subs: new Set(f.subs),
    region: new Set(f.region), exchange: new Set(f.exchange), std: new Set(f.std), tags: new Set(f.tags), conf: new Set(f.conf),
    hasRnd: f.hasRnd, hasPatents: f.hasPatents, hasIntl: f.hasIntl,
  }
}

function classFields(r: IndexRow, scheme: Scheme): { code: string | null; label: string | null } {
  if (scheme === "naics") return { code: r.naics, label: r.naics }
  if (scheme === "nace") return { code: r.nace, label: r.nace }
  return { code: r.sic, label: r.sic_description }
}

function matchesClass(r: IndexRow, scheme: Scheme, codes: string[], typed: string) {
  const needles = codes.length ? codes : typed.trim() ? [typed.trim()] : []
  if (!needles.length) return true
  const { code, label } = classFields(r, scheme)
  const c = (code ?? "").toLowerCase()
  const l = (label ?? "").toLowerCase()
  return needles.some(n => {
    const t = n.toLowerCase()
    return c.startsWith(t) || l.includes(t)
  })
}

function filterCount(f: Filters) {
  const sets = [f.sector, f.hq, f.op, f.rev, f.subs, f.region, f.exchange, f.std, f.tags, f.conf]
  return sets.reduce((s, set) => s + set.size, 0) + (f.hasRnd ? 1 : 0) + (f.hasPatents ? 1 : 0) + (f.hasIntl ? 1 : 0)
}

function sorted(xs: Iterable<string>) { return [...xs].sort() }

function serializeFilters(f: Filters): StoredFilters {
  return {
    sector: sorted(f.sector), hq: sorted(f.hq), op: sorted(f.op), rev: sorted(f.rev), subs: sorted(f.subs),
    region: sorted(f.region), exchange: sorted(f.exchange), std: sorted(f.std), tags: sorted(f.tags), conf: sorted(f.conf),
    hasRnd: f.hasRnd, hasPatents: f.hasPatents, hasIntl: f.hasIntl,
  }
}

function serializeQuery(q: Query): StoredQuery {
  const typed = q.classQ.trim()
  const classCodes = sorted(typed && !q.classCodes.includes(typed) ? [...q.classCodes, typed] : q.classCodes)
  return { q: "", scheme: q.scheme, classQ: "", classCodes, at: Date.now(), filters: serializeFilters(q.filters) }
}

function strings(v: unknown) {
  return Array.isArray(v) ? v.filter(x => typeof x === "string") : []
}

function storedCodes(s: StoredQuery) {
  const codes = strings(s.classCodes)
  const legacy = (s.classQ ?? "").trim()
  return sorted(codes.length ? codes : legacy ? [legacy] : [])
}

function storedFilterCount(f?: StoredFilters) {
  if (!f) return 0
  const sets = [f.sector, f.hq, f.op, f.rev, f.subs, f.region, f.exchange, f.std, f.tags, f.conf]
  return sets.reduce((n, a) => n + strings(a).length, 0) + (f.hasRnd ? 1 : 0) + (f.hasPatents ? 1 : 0) + (f.hasIntl ? 1 : 0)
}

function hasFilterCombo(q: Query) {
  return q.classCodes.length > 0 || !!q.classQ.trim() || filterCount(q.filters) > 0
}

function hasStoredCombo(s: StoredQuery) {
  return storedCodes(s).length > 0 || storedFilterCount(s.filters) > 0
}

function fingerprint(s: StoredQuery) {
  const f = s.filters ?? ({} as StoredFilters)
  return JSON.stringify({
    scheme: s.scheme === "naics" || s.scheme === "nace" ? s.scheme : "sic",
    classCodes: storedCodes(s),
    filters: {
      sector: sorted(strings(f.sector)), hq: sorted(strings(f.hq)), op: sorted(strings(f.op)),
      rev: sorted(strings(f.rev)), subs: sorted(strings(f.subs)), region: sorted(strings(f.region)),
      exchange: sorted(strings(f.exchange)), std: sorted(strings(f.std)), tags: sorted(strings(f.tags)),
      conf: sorted(strings(f.conf)), hasRnd: !!f.hasRnd, hasPatents: !!f.hasPatents, hasIntl: !!f.hasIntl,
    },
  })
}

function deserializeQuery(s: StoredQuery): Query {
  const f = s.filters ?? ({} as StoredFilters)
  const scheme: Scheme = s.scheme === "naics" || s.scheme === "nace" ? s.scheme : "sic"
  return {
    q: "", scheme, classQ: "",
    classCodes: storedCodes(s),
    filters: {
      sector: new Set(strings(f.sector)), hq: new Set(strings(f.hq)), op: new Set(strings(f.op)),
      rev: new Set(strings(f.rev)), subs: new Set(strings(f.subs)), region: new Set(strings(f.region)),
      exchange: new Set(strings(f.exchange)), std: new Set(strings(f.std)), tags: new Set(strings(f.tags)),
      conf: new Set(strings(f.conf)),
      hasRnd: !!f.hasRnd, hasPatents: !!f.hasPatents, hasIntl: !!f.hasIntl,
    },
  }
}

function whenLabel(at?: number) {
  if (!at) return "Today"
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((day(new Date()) - day(new Date(at))) / 86400000)
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days <= 7) return "Last week"
  if (days <= 31) return "Last month"
  return "Last year"
}

function queryLabel(s: StoredQuery): { title: string; meta: string } {
  const f = s.filters ?? ({} as StoredFilters)
  const bits: string[] = []
  const codes = storedCodes(s)
  if (codes.length) bits.push(`${(s.scheme ?? "sic").toUpperCase()} ${codes.join(", ")}`)
  bits.push(...strings(f.hq), ...strings(f.sector), ...strings(f.rev), ...strings(f.region), ...strings(f.exchange), ...strings(f.op).slice(0, 2), ...strings(f.std))
  if (f.hasRnd) bits.push("R&D")
  if (f.hasPatents) bits.push("Patents")
  if (f.hasIntl) bits.push("International")
  const extra = strings(f.op).length > 2 ? [...bits, `+${strings(f.op).length - 2}`] : bits
  return { title: whenLabel(s.at), meta: extra.join(" · ") }
}

function loadRecent(): StoredQuery[] {
  if (typeof window === "undefined") return []
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")
    if (!Array.isArray(raw)) return []
    const seen = new Set<string>()
    const out: StoredQuery[] = []
    for (const x of raw as StoredQuery[]) {
      if (!x || !x.filters) continue
      const item: StoredQuery = {
        q: "", scheme: x.scheme === "naics" || x.scheme === "nace" ? x.scheme : "sic",
        classQ: "", classCodes: storedCodes(x), at: x.at || Date.now(), filters: x.filters,
      }
      if (!hasStoredCombo(item)) continue
      const id = fingerprint(item)
      if (seen.has(id)) continue
      seen.add(id)
      out.push(item)
      if (out.length >= RECENT_N) break
    }
    return out
  } catch { return [] }
}

function pushRecent(q: Query): StoredQuery[] {
  if (!hasFilterCombo(q)) return loadRecent()
  const stored = serializeQuery(q)
  const id = fingerprint(stored)
  const next = [stored, ...loadRecent().filter(x => fingerprint(x) !== id)].slice(0, RECENT_N)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  return next
}

export default function SearchPage({ onOpen }: { onOpen: (slug: string) => void }) {
  const [rows, setRows] = useState<IndexRow[] | null>(null)
  const [err, setErr] = useState(false)
  const [draft, setDraft] = useState<Query>(emptyQuery)
  const [applied, setApplied] = useState<Query>(emptyQuery)
  const [ran, setRan] = useState(false)
  const [recent, setRecent] = useState<StoredQuery[]>([])
  const [drawer, setDrawer] = useState(false)
  const [classOpen, setClassOpen] = useState(false)
  const [classIdx, setClassIdx] = useState(0)
  const [sort, setSort] = useState("revenue")
  const [activeIdx, setActiveIdx] = useState(0)
  const [saved, toggleSave] = useSavedCompanies()
  const inputRef = useRef<HTMLInputElement>(null)
  const classRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLTableSectionElement>(null)

  useEffect(() => { loadIndex().then(setRows).catch(() => setErr(true)) }, [])
  useEffect(() => {
    const items = loadRecent()
    setRecent(items)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(items)) } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (classRef.current && !classRef.current.contains(e.target as Node)) setClassOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === "Escape" && drawer) {
        e.preventDefault()
        setDrawer(false)
        return
      }
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(tag) && !(e.target as HTMLElement).isContentEditable) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [drawer])

  const catalog = useMemo(() => {
    if (!rows) return []
    const map = new Map<string, string>()
    for (const r of rows) {
      const { code, label } = classFields(r, draft.scheme)
      if (!code) continue
      if (!map.has(code)) map.set(code, label && label !== code ? label : "")
    }
    return [...map.entries()].map(([code, label]) => ({ code, label })).sort((a, b) => a.code.localeCompare(b.code))
  }, [rows, draft.scheme])

  const classHits = useMemo(() => {
    const n = draft.classQ.trim().toLowerCase()
    const selected = new Set(draft.classCodes)
    const list = catalog.filter(c => !n || c.code.toLowerCase().startsWith(n) || c.label.toLowerCase().includes(n))
    return [...list.filter(c => selected.has(c.code)), ...list.filter(c => !selected.has(c.code))].slice(0, 8)
  }, [catalog, draft.classQ, draft.classCodes])

  const results = useMemo(() => {
    if (!rows || !ran) return []
    const needle = applied.q.trim().toLowerCase()
    const out = rows.filter(r => {
      if (needle && ![r.name, r.ticker, r.sic, r.sic_description, r.naics, r.nace, r.sector, r.keywords, r.activity_tags.join(" ")].join(" ").toLowerCase().includes(needle)) return false
      if (!matchesClass(r, applied.scheme, applied.classCodes, applied.classQ)) return false
      const f = applied.filters
      if (f.sector.size && !(r.sector && f.sector.has(r.sector))) return false
      if (f.hq.size && !(r.hq_country && f.hq.has(r.hq_country))) return false
      if (f.op.size && !r.op_countries.some(c => f.op.has(c))) return false
      if (f.rev.size && !(r.revenue_latest != null && f.rev.has(revBand(r.revenue_latest)))) return false
      if (f.subs.size && !f.subs.has(subsBand(r.n_subsidiaries))) return false
      if (f.region.size && !(r.hq_region && f.region.has(r.hq_region))) return false
      if (f.exchange.size && !(r.exchange && f.exchange.has(r.exchange))) return false
      if (f.std.size && !f.std.has(r.accounting_standard)) return false
      if (f.tags.size && !r.activity_tags.some(t => f.tags.has(t))) return false
      if (f.conf.size && !f.conf.has(r.confidence)) return false
      if (f.hasRnd && !r.has_rnd) return false
      if (f.hasPatents && !r.has_patents) return false
      if (f.hasIntl && !r.has_international) return false
      return true
    })
    out.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name)
      if (sort === "ticker") return (a.ticker || "").localeCompare(b.ticker || "")
      if (sort === "class") {
        return (classFields(a, applied.scheme).code || "").localeCompare(classFields(b, applied.scheme).code || "")
      }
      if (sort === "hq") return (a.hq_country || "").localeCompare(b.hq_country || "")
      if (sort === "sector") return (a.sector || "").localeCompare(b.sector || "")
      return Number(b.revenue_latest || 0) - Number(a.revenue_latest || 0)
    })
    return out
  }, [rows, ran, applied, sort])

  useEffect(() => { setActiveIdx(0) }, [applied, sort])
  useEffect(() => { setClassIdx(0) }, [draft.classQ, draft.scheme])
  useEffect(() => {
    listRef.current?.querySelector("[data-active='true']")?.scrollIntoView({ block: "nearest" })
  }, [activeIdx])

  const moreN = filterCount(draft.filters) + draft.classCodes.length

  function resetHome() {
    setDraft(emptyQuery())
    setApplied(emptyQuery())
    setRan(false)
    setDrawer(false)
    setClassOpen(false)
    inputRef.current?.focus()
  }

  function applyQuery(q: Query) {
    const typed = q.classQ.trim()
    const classCodes = typed && !q.classCodes.includes(typed) ? [...q.classCodes, typed] : [...q.classCodes]
    const next = { q: q.q, scheme: q.scheme, classQ: "", classCodes, filters: copyFilters(q.filters) }
    setDraft(next)
    setApplied({ q: next.q, scheme: next.scheme, classQ: "", classCodes: [...classCodes], filters: copyFilters(next.filters) })
    setRan(true)
    setDrawer(false)
    setClassOpen(false)
    if (hasFilterCombo(next)) setRecent(pushRecent(next))
  }

  function runSearch() {
    applyQuery(draft)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    runSearch()
  }

  function toggleClass(code: string) {
    setDraft(s => {
      const has = s.classCodes.includes(code)
      return { ...s, classCodes: has ? s.classCodes.filter(x => x !== code) : [...s.classCodes, code], classQ: "" }
    })
  }

  function onMainKey(e: ReactKey<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (drawer) setDrawer(false)
      else if (classOpen) setClassOpen(false)
      return
    }
    if (!ran) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, Math.max(results.length - 1, 0)))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && results[activeIdx] && draft.q === applied.q && draft.scheme === applied.scheme) {
      e.preventDefault()
      onOpen(results[activeIdx].slug)
    }
  }

  function onClassKey(e: ReactKey<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault()
      setClassOpen(false)
      return
    }
    if (e.key === "Backspace" && !draft.classQ && draft.classCodes.length) {
      e.preventDefault()
      toggleClass(draft.classCodes[draft.classCodes.length - 1])
      return
    }
    if (classOpen && classHits.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setClassIdx(i => Math.min(i + 1, classHits.length - 1))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setClassIdx(i => Math.max(i - 1, 0))
        return
      }
      if (e.key === "Enter" && classHits[classIdx]) {
        e.preventDefault()
        toggleClass(classHits[classIdx].code)
        return
      }
    }
    onMainKey(e)
  }

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

  function toggle(k: keyof Filters, v: string) {
    setDraft(s => {
      const current = s.filters[k]
      if (!(current instanceof Set)) return s
      const next = new Set(current)
      next.has(v) ? next.delete(v) : next.add(v)
      return { ...s, filters: { ...s.filters, [k]: next } }
    })
  }

  if (err) {
    return (
      <div className="vt-search">
        <div className="vt-search-status" role="alert">
          <p style={{ margin: 0, color: "var(--color-text)" }}>The company index did not load.</p>
          <Button size="sm" variant="outline" onClick={() => { setErr(false); setRows(null); loadIndex().then(setRows).catch(() => setErr(true)) }}>
            Retry load
          </Button>
        </div>
      </div>
    )
  }
  if (!rows) {
    return (
      <div className="vt-search">
        <div className="vt-search-status" aria-busy="true">
          <div className="vt-search-skel vt-skeleton" />
        </div>
      </div>
    )
  }

  const schemePlaceholder = draft.scheme === "sic" ? "Code or industry" : draft.scheme === "naics" ? "NAICS code" : "NACE code"
  const classCol = applied.scheme.toUpperCase()

  function th(key: string, label: string, right = false) {
    return (
      <th
        className={sort === key ? "is-on" : undefined}
        style={right ? { textAlign: "right" } : undefined}
        aria-sort={sort === key ? "descending" : "none"}
        onClick={() => setSort(key)}
      >
        {label}
      </th>
    )
  }

  return (
    <div className="vt-search vt-search--split">
      {/* permanent filter panel */}
      <aside className="vt-search-panel" aria-label="Filters">
        <div className="vt-search-panel-head">
          <span>Filters{moreN ? ` · ${moreN}` : ""}</span>
          {moreN ? (
            <button type="button" className="vt-search-panel-clear" onClick={() => setDraft(s => ({ ...s, classQ: "", classCodes: [], filters: emptyFilters() }))}>Clear</button>
          ) : null}
        </div>
        <div className="vt-search-panel-body">
          <Collapsible label="Classification" count={draft.classCodes.length} defaultOpen>
            <div className="vt-search-class-row" ref={classRef}>
              <div className="vt-search-class-scheme">
                <span className="vt-sr-only">Classification system</span>
                <SelectControl
                  size="md"
                  variant="outline"
                  block
                  className="vt-search-scheme-trigger"
                  value={draft.scheme}
                  onValueChange={v => { setDraft(s => ({ ...s, scheme: v as Scheme, classQ: "", classCodes: [] })); setClassOpen(false) }}
                >
                  <SelectControl.Item value="sic">SIC</SelectControl.Item>
                  <SelectControl.Item value="naics">NAICS</SelectControl.Item>
                  <SelectControl.Item value="nace">NACE</SelectControl.Item>
                </SelectControl>
              </div>
              <div className="vt-search-class-field">
                {draft.classCodes.map(code => (
                  <button key={code} type="button" className="vt-search-class-chip" aria-label={`Remove ${code}`} onClick={() => toggleClass(code)}>
                    {code}
                    <X size={10} strokeWidth={2} />
                  </button>
                ))}
                <label htmlFor="vt-search-class" className="vt-sr-only">Search {draft.scheme.toUpperCase()} codes</label>
                <input
                  id="vt-search-class"
                  className="vt-search-class-type"
                  value={draft.classQ}
                  placeholder={draft.classCodes.length ? "Add code" : schemePlaceholder}
                  autoComplete="off"
                  onChange={e => { setDraft(s => ({ ...s, classQ: e.target.value })); setClassOpen(true) }}
                  onFocus={() => setClassOpen(true)}
                  onKeyDown={onClassKey}
                />
                {classOpen && classHits.length > 0 && (
                  <ul className="vt-search-class-menu" role="listbox" aria-multiselectable="true" aria-label={`${draft.scheme.toUpperCase()} codes`}>
                    {classHits.map((c, i) => {
                      const on = draft.classCodes.includes(c.code)
                      return (
                        <li key={c.code} role="presentation">
                          <button type="button" className={i === classIdx || on ? "vt-search-class-opt is-active" : "vt-search-class-opt"} aria-selected={on} onClick={() => toggleClass(c.code)} onMouseEnter={() => setClassIdx(i)}>
                            <span>
                              <span className="vt-search-class-code">{c.code}</span>
                              {c.label ? <span className="vt-search-class-label">{c.label}</span> : null}
                            </span>
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
          <FilterSelect label="Industry" sel={draft.filters.sector} opts={counts(r => r.sector)} onToggle={v => toggle("sector", v)} searchable />
          <FilterSelect label="Headquarters" sel={draft.filters.hq} opts={counts(r => r.hq_country, true)} onToggle={v => toggle("hq", v)} searchable />
          <FilterSelect label="Revenue" sel={draft.filters.rev} opts={orderBands(REV_BANDS.map(b => b[0]), counts(r => r.revenue_latest != null ? revBand(r.revenue_latest) : null))} onToggle={v => toggle("rev", v)} />
          <FilterSelect label="Operates in" sel={draft.filters.op} opts={counts(r => r.op_countries, true)} onToggle={v => toggle("op", v)} searchable />
          <FilterSelect label="Region" sel={draft.filters.region} opts={counts(r => r.hq_region)} onToggle={v => toggle("region", v)} />
          <FilterSelect label="Exchange" sel={draft.filters.exchange} opts={counts(r => r.exchange)} onToggle={v => toggle("exchange", v)} />
          <FilterSelect label="Accounting" sel={draft.filters.std} opts={counts(r => r.accounting_standard)} onToggle={v => toggle("std", v)} />
          <Collapsible label="Characteristics" count={(draft.filters.hasRnd ? 1 : 0) + (draft.filters.hasPatents ? 1 : 0) + (draft.filters.hasIntl ? 1 : 0)}>
            <div className="vt-search-filter-opts">
              <button type="button" className={draft.filters.hasRnd ? "vt-search-chip is-on" : "vt-search-chip"} onClick={() => setDraft(s => ({ ...s, filters: { ...s.filters, hasRnd: !s.filters.hasRnd } }))}>R&D</button>
              <button type="button" className={draft.filters.hasPatents ? "vt-search-chip is-on" : "vt-search-chip"} onClick={() => setDraft(s => ({ ...s, filters: { ...s.filters, hasPatents: !s.filters.hasPatents } }))}>Patents</button>
              <button type="button" className={draft.filters.hasIntl ? "vt-search-chip is-on" : "vt-search-chip"} onClick={() => setDraft(s => ({ ...s, filters: { ...s.filters, hasIntl: !s.filters.hasIntl } }))}>International</button>
            </div>
          </Collapsible>
        </div>
        <div className="vt-search-panel-foot">
          <Button type="button" variant="solid" size="sm" block onClick={runSearch}>Search</Button>
        </div>
      </aside>

      {/* search bar + results */}
      <div className="vt-search-main">
        <form className="vt-search-bar" onSubmit={onSubmit}>
          <div className="vt-search-instrument">
            <button type="submit" className="vt-search-submit" aria-label="Search">
              <Search size={20} strokeWidth={1.5} />
            </button>
            <label htmlFor="vt-search-q" className="vt-sr-only">Search companies</label>
            <input
              id="vt-search-q"
              ref={inputRef}
              className="vt-search-input"
              value={draft.q}
              onChange={e => setDraft(s => ({ ...s, q: e.target.value }))}
              onKeyDown={onMainKey}
              placeholder="Search companies"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {(draft.q || ran) && (
              <div className="vt-search-actions">
                <Button type="button" variant="ghost" size="xs" aria-label="Clear search" onClick={resetHome}>
                  <X size={16} strokeWidth={1.5} />
                </Button>
              </div>
            )}
          </div>
        </form>

        <div className="vt-search-main-body">
          {ran ? (
            <div className="vt-search-body">
              <div className="vt-search-table-meta">
                {results.length.toLocaleString()} {results.length === 1 ? "company" : "companies"}
              </div>
              {results.length === 0 ? (
                <p className="vt-search-empty">No companies match. Change a filter and search again.</p>
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
                        const cls = classFields(r, applied.scheme)
                        return (
                          <tr
                            key={r.slug}
                            data-active={i === activeIdx || undefined}
                            className={i === activeIdx ? "is-active" : undefined}
                            onClick={() => onOpen(r.slug)}
                            onMouseEnter={() => setActiveIdx(i)}
                          >
                            <td><span className="vt-search-name">{r.name}</span></td>
                            <td className="is-muted">{r.ticker ?? ""}</td>
                            <td className="is-muted">{[cls.code, cls.label && cls.label !== cls.code ? cls.label : null].filter(Boolean).join(" · ")}</td>
                            <td className="is-muted">{r.sector ?? ""}</td>
                            <td className="is-muted">{r.hq_country ?? ""}</td>
                            <td className="is-num">{money(r.revenue_latest, r.currency)}</td>
                            <td>
                              <button
                                type="button"
                                className={isSaved ? "vt-search-star is-on" : "vt-search-star"}
                                title={isSaved ? "Remove from saved" : "Save company"}
                                aria-label={isSaved ? "Remove from saved" : "Save company"}
                                onClick={e => { e.stopPropagation(); toggleSave(r.slug) }}
                              >
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
              {recent.length > 0 ? (
                <>
                  <p className="vt-search-count">Recent searches</p>
                  {recent.map(item => {
                    const { title, meta } = queryLabel(item)
                    return (
                      <button key={JSON.stringify(item)} type="button" className="vt-search-hint" onClick={() => applyQuery(deserializeQuery(item))}>
                        <span className="vt-search-hint-body">
                          <span className="vt-search-name">{title}</span>
                          {meta ? <span className="vt-search-meta">{meta}</span> : null}
                        </span>
                      </button>
                    )
                  })}
                </>
              ) : (
                <p className="vt-search-hint-empty">Pick filters on the left or type a company name, then hit Search.</p>
              )}
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

// A collapsible filter category whose values are picked from a searchable dropdown (chips for selected).
function FilterSelect({ label, sel, opts, onToggle, searchable = false }: { label: string; sel: StringSet; opts: [string, number][]; onToggle: (v: string) => void; searchable?: boolean }) {
  const [menu, setMenu] = useState(false)
  const [q, setQ] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menu])
  if (opts.length === 0) return null
  const shown = q ? opts.filter(([v]) => v.toLowerCase().includes(q.toLowerCase())) : opts
  return (
    <Collapsible label={label} count={sel.size}>
      <div className="vt-search-class-field" ref={ref} onClick={() => setMenu(true)}>
        {[...sel].map(v => (
          <button key={v} type="button" className="vt-search-class-chip" aria-label={`Remove ${v}`} onClick={e => { e.stopPropagation(); onToggle(v) }}>
            {v}
            <X size={10} strokeWidth={2} />
          </button>
        ))}
        <input
          className="vt-search-class-type"
          value={q}
          placeholder={sel.size ? "Add" : `Select ${label.toLowerCase()}`}
          autoComplete="off"
          readOnly={!searchable}
          onChange={e => setQ(e.target.value)}
          onFocus={() => setMenu(true)}
        />
        {menu && (
          <ul className="vt-search-class-menu" role="listbox" aria-multiselectable="true" aria-label={label}>
            {shown.slice(0, 60).map(([v, n]) => {
              const on = sel.has(v)
              return (
                <li key={v} role="presentation">
                  <button type="button" className={on ? "vt-search-class-opt is-active" : "vt-search-class-opt"} aria-selected={on} onClick={() => onToggle(v)}>
                    <span>
                      <span className="vt-search-class-code">{v}</span>
                      <span className="vt-search-class-label">{n}</span>
                    </span>
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

function orderBands(order: string[], o: [string, number][]): [string, number][] {
  const m = new Map(o)
  return order.filter(x => m.has(x)).map(x => [x, m.get(x)!] as [string, number])
}
