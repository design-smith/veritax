// Company data lives in Supabase (public.companies), served to the UI through FastAPI on Fly.
// Browser reads: static public/companies/* first, then NEXT_PUBLIC_API_BASE_URL. Never paginate
// Supabase from the client — that burns egress and trips the bandwidth cap.
export type IndexRow = {
  slug: string
  name: string
  ticker: string | null
  exchange: string | null
  hq_country: string | null
  hq_region: string | null
  sic: string | null
  sic_description: string | null
  naics: string | null
  nace: string | null
  sector: string | null
  industry: string | null
  activity_tags: string[]
  op_countries: string[]
  keywords: string
  revenue_latest: number | null
  net_income_latest: number | null
  employees: number | null
  n_subsidiaries: number
  n_countries: number
  n_patents: number
  has_rnd: boolean
  has_patents: boolean
  has_international: boolean
  accounting_standard: string
  status: string | null
  confidence: string
  currency: string | null
  searched_at: string
}

type Headquarters = { address_line: string | null; city: string | null; region: string | null; postal_code: string | null; country: string | null }
type Listing = { ticker: string; exchange: string | null; security_type: string | null; is_primary: boolean }
export type ActivityTag = { tag: string; evidence: string }
export type KeyMetric = { label: string; fy: number | null; value: number | null; currency: string | null; unit: string | null; end: string | null }
type Coverage = { area: string; status: string }
type Gap = { field: string; description: string; status: string }

export type CompanyProfile = {
  slug: string
  identity: {
    legal_name: string
    former_names: string[]
    entity_type: string | null
    entity_status: string | null
    jurisdiction: string | null
    headquarters: Headquarters | null
    website: string | null
    logo?: string | null
    founded?: string | null
    cik: string | null
    lei: string | null
    sec_file_number: string | null
    is_subsidiary: boolean
    parent_legal_name: string | null
    listings: Listing[]
  }
  classification: {
    sic: string | null
    sic_description: string | null
    sector?: string
    naics?: string
    naics_label?: string
    nace?: string
    nace_label?: string
    approximate?: boolean
  }
  business: {
    description: string | null
    overview?: string | null
    segments: string[]
    activity_tags: ActivityTag[]
    rnd: { conducts: boolean; description: string | null; spend: number | null }
    employees: number | null
    employees_text: string | null
  }
  key_metrics: KeyMetric[]
  revenue_series: { fy: number; value: number | null }[]
  financials_currency: string | null
  derived: { ebit_margin: number | null; net_cost_plus: number | null; berry: number | null; roa: number | null; rd_to_revenue: number | null }
  footprint_summary: { n_countries: number; n_entities: number; status_counts: Record<string, number>; top_countries: { code: string; name: string; n: number }[] }
  group_summary: { n_subsidiaries: number }
  ip_summary: { count: number; by_jurisdiction: Record<string, number>; by_type: Record<string, number> }
  sources: { families: string[]; coverage: Coverage[]; gaps: Gap[]; completeness: number; confidence: string }
  facts_count: number
  accounting_standard: string
  searched_at: string
}

export type FinancialRow = { concept: string; label: string; statement: string; unit: string | null; currency: string | null; values: Record<string, number | null> }
export type Financials = { standard: string; currency: string | null; rows: FinancialRow[] }

export type CountryEntity = { name: string; lei: string | null; office: string | null; status: string | null; type: string | null }
export type FootprintCountry = { code: string; name: string; status: string; entities: CountryEntity[] }
export type Footprint = { countries: FootprintCountry[]; status_counts: Record<string, number> }

export type PatentItem = {
  type: string
  title?: string | null
  number: string | null
  application?: string | null
  jurisdiction: string | null
  assignee: string | null
  filed?: string | null
  granted?: string | null
  status?: string | null
  uspto: string | null
}
export type IP = {
  count: number
  listed?: number
  by_jurisdiction: Record<string, number>
  by_type: Record<string, number>
  items: PatentItem[]
}

export type Subsidiary = { name: string; jurisdiction: string | null; lei: string | null }
export type Group = { subsidiaries: Subsidiary[] }

// Search index: public/company-index.json (root of public/ — not under /companies/, which the
// app/[[...slug]] catch-all shadows on Vercel). The 50k+ warehouse is queried via FastAPI
// /companies/search. Never paginate Supabase from the browser (egress / bandwidth cap).
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"

export async function loadIndex(): Promise<IndexRow[]> {
  return loadIndexFromPublic()
}

function asIndexRow(raw: unknown): IndexRow | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Partial<IndexRow>
  if (!r.slug) return null
  return {
    slug: r.slug,
    name: r.name || r.slug,
    ticker: r.ticker ?? null,
    exchange: r.exchange ?? null,
    hq_country: r.hq_country ?? null,
    hq_region: r.hq_region ?? null,
    sic: r.sic ?? null,
    sic_description: r.sic_description ?? null,
    naics: r.naics ?? null,
    nace: r.nace ?? null,
    sector: r.sector ?? null,
    industry: r.industry ?? null,
    activity_tags: Array.isArray(r.activity_tags) ? r.activity_tags : [],
    op_countries: Array.isArray(r.op_countries) ? r.op_countries : [],
    keywords: r.keywords ?? "",
    revenue_latest: r.revenue_latest ?? null,
    net_income_latest: r.net_income_latest ?? null,
    employees: r.employees ?? null,
    n_subsidiaries: r.n_subsidiaries ?? 0,
    n_countries: r.n_countries ?? 0,
    n_patents: r.n_patents ?? 0,
    has_rnd: !!r.has_rnd,
    has_patents: !!r.has_patents,
    has_international: !!r.has_international,
    accounting_standard: r.accounting_standard ?? "",
    status: r.status ?? null,
    confidence: r.confidence ?? "",
    currency: r.currency ?? null,
    searched_at: r.searched_at ?? "",
  }
}

export async function countUniverse(): Promise<number | null> {
  try {
    const res = await fetch(`${API}/companies/count`, { cache: "no-store" })
    if (!res.ok) return null
    const body = await res.json() as { count?: number }
    return typeof body.count === "number" ? body.count : null
  } catch {
    return null
  }
}

export async function searchUniverse(q: string, limit = 250): Promise<{ total: number; rows: IndexRow[] }> {
  const needle = q.trim()
  if (!needle) return { total: 0, rows: [] }
  try {
    const res = await fetch(`${API}/companies/search?q=${encodeURIComponent(needle)}&limit=${limit}`, { cache: "no-store" })
    if (!res.ok) return { total: 0, rows: [] }
    const body = await res.json() as { total?: number; rows?: unknown[] }
    const rows = (body.rows ?? []).map(asIndexRow).filter((r): r is IndexRow => r != null)
    return { total: typeof body.total === "number" ? body.total : rows.length, rows }
  } catch {
    return { total: 0, rows: [] }
  }
}

async function loadIndexFromPublic(): Promise<IndexRow[]> {
  try {
    // Keep this path at the public/ root. `/companies/*` is claimed by [[...slug]] and returns HTML.
    const res = await fetch("/company-index.json")
    if (!res.ok) return []
    const type = res.headers.get("content-type") || ""
    if (!type.includes("json")) return []
    const raw: unknown = await res.json()
    return Array.isArray(raw) ? (raw as IndexRow[]).filter(r => r && r.slug) : []
  } catch {
    return []
  }
}

async function readJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null
  const type = res.headers.get("content-type") || ""
  if (type.includes("html")) return null
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function detail<T>(slug: string, column: string): Promise<T> {
  const file = column === "group_data" ? "group.json" : `${column}.json`
  try {
    const local = await readJson<T>(await fetch(`/companies/${encodeURIComponent(slug)}/${file}`))
    if (local) return local
  } catch {
    /* static file missing — use the warehouse API */
  }
  const res = await fetch(`${API}/companies/${encodeURIComponent(slug)}/${column}`, { cache: "no-store" })
  if (!res.ok) throw new Error("Company record was not found.")
  return (await res.json()) as T
}
export const getProfile = (slug: string) => detail<CompanyProfile>(slug, "profile")
export const getFinancials = (slug: string) => detail<Financials>(slug, "financials")
export const getFootprint = (slug: string) => detail<Footprint>(slug, "footprint")
export const getIP = (slug: string) => detail<IP>(slug, "ip")
export const getGroup = (slug: string) => detail<Group>(slug, "group_data")

// ---- formatting helpers shared across the UI ----
export function compact(value: number | string | null): string {
  const n = typeof value === "number" ? value : Number(value)
  if (value == null || !Number.isFinite(n)) return "—"
  const a = Math.abs(n)
  if (a >= 1e12) return (n / 1e12).toFixed(2) + "T"
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B"
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M"
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K"
  return n.toLocaleString()
}
export function money(value: number | string | null, currency: string | null, unit?: string | null): string {
  if (value == null || value === "") return "—"
  const c = compact(value)
  if (c === "—") return "—"
  if (currency === "USD") return "$" + c
  if (currency) return `${currency} ${c}`
  return unit && unit !== "USD" ? `${c} ${unit}` : c
}
