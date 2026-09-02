// Company data lives in Supabase (public.companies), built locally by scripts/build-universe.mjs and pushed
// with scripts/push_to_supabase.py. The search index is every row's `index` jsonb; each tab's detail is a
// jsonb column loaded lazily by slug. Reads use the browser client + the public-read RLS policy.
import { createClient } from "@/lib/supabase/client"

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

export type PatentItem = { type: string; number: string | null; jurisdiction: string | null; assignee: string | null; uspto: string | null }
export type IP = { count: number; by_jurisdiction: Record<string, number>; by_type: Record<string, number>; items: PatentItem[] }

export type Subsidiary = { name: string; jurisdiction: string | null; lei: string | null }
export type Group = { subsidiaries: Subsidiary[] }

// Company data lives in Supabase (public.companies, public-read RLS). The search index is the `index` jsonb of
// every row; each tab's detail is a jsonb column loaded lazily by slug. The map geometry stays a static asset.
let _sb: ReturnType<typeof createClient> | null = null
const sb = () => (_sb ??= createClient())

export async function loadIndex(): Promise<IndexRow[]> {
  const { data, error } = await sb().from("companies").select("index")
  if (error) throw error
  return (data ?? []).map(r => (r as { index: IndexRow }).index)
}

async function detail<T>(slug: string, column: string): Promise<T> {
  const { data, error } = await sb().from("companies").select(column).eq("slug", slug).single()
  if (error) throw error
  return (data as unknown as Record<string, T>)[column]
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
