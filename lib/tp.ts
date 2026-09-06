// Transfer-pricing calc layer over a company's financials pivot. Pure functions — no React, no I/O.
// A "series" is year -> value. PLIs are pooled weighted averages over a selected period: Σnumerator / Σdenominator.
import type { Financials } from "@/lib/companies"

export type Series = Record<number, number>
export type Lines = Record<string, Series>

// Concept fallbacks per canonical line item (US-GAAP first, then IFRS).
const CONCEPTS: Record<string, string[]> = {
  revenue: ["us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax", "us-gaap:Revenues", "us-gaap:SalesRevenueNet", "ifrs-full:Revenue"],
  grossProfit: ["us-gaap:GrossProfit", "ifrs-full:GrossProfit"],
  ebit: ["us-gaap:OperatingIncomeLoss", "ifrs-full:ProfitLossFromOperatingActivities"],
  ebt: ["us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", "us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments", "ifrs-full:ProfitLossBeforeTax"],
  netIncome: ["us-gaap:NetIncomeLoss", "ifrs-full:ProfitLoss"],
  assets: ["us-gaap:Assets", "ifrs-full:Assets"],
  equity: ["us-gaap:StockholdersEquity", "ifrs-full:Equity"],
  rnd: ["us-gaap:ResearchAndDevelopmentExpense", "ifrs-full:ResearchAndDevelopmentExpense"],
  da: ["us-gaap:DepreciationDepletionAndAmortization", "us-gaap:DepreciationAmortizationAndAccretionNet", "ifrs-full:DepreciationAndAmortisationExpense"],
  opCashFlow: ["us-gaap:NetCashProvidedByUsedInOperatingActivities", "ifrs-full:CashFlowsFromUsedInOperatingActivities"],
}

function combine(a: Series, b: Series, f: (x: number, y: number) => number): Series {
  const o: Series = {}
  for (const y of Object.keys(a)) { const yy = Number(y); if (b[yy] != null) o[yy] = f(a[yy], b[yy]) }
  return o
}

// Build all canonical + derived per-year series from the pivot (one pass over rows).
export function lines(fin: Financials): Lines {
  const byConcept = new Map(fin.rows.map(r => [r.concept, r.values]))
  const pick = (concepts: string[]): Series => {
    for (const c of concepts) {
      const v = byConcept.get(c)
      if (v) { const o: Series = {}; for (const [y, val] of Object.entries(v)) if (val != null) o[Number(y)] = val as number; return o }
    }
    return {}
  }
  const L: Lines = {}
  for (const k of Object.keys(CONCEPTS)) L[k] = pick(CONCEPTS[k])
  L.cogs = combine(L.revenue, L.grossProfit, (r, g) => r - g)          // cost of goods sold
  L.opex = combine(L.grossProfit, L.ebit, (g, e) => g - e)             // operating expenses below gross
  L.totalCost = combine(L.revenue, L.ebit, (r, e) => r - e)            // total operating cost
  L.ebitda = combine(L.ebit, L.da, (e, d) => e + d)
  return L
}

export function yearsAvailable(fin: Financials): number[] {
  const L = lines(fin)
  const set = new Set<number>()
  for (const k of ["revenue", "ebit", "netIncome", "grossProfit", "assets"]) for (const y of Object.keys(L[k])) set.add(Number(y))
  return [...set].sort((a, b) => a - b)
}

export function sumOver(s: Series, years: number[]): number | null {
  let sum = 0, any = false
  for (const y of years) if (s[y] != null) { sum += s[y]; any = true }
  return any ? sum : null
}

export type PLIDef = { key: string; label: string; short: string; num: string; den: string; kind: "pct" | "ratio" }
export const PLIS: PLIDef[] = [
  { key: "op_margin", label: "Operating margin", short: "EBIT / Revenue", num: "ebit", den: "revenue", kind: "pct" },
  { key: "net_margin", label: "Net margin", short: "Net income / Revenue", num: "netIncome", den: "revenue", kind: "pct" },
  { key: "gross_margin", label: "Gross margin", short: "Gross profit / Revenue", num: "grossProfit", den: "revenue", kind: "pct" },
  { key: "pretax_margin", label: "Pre-tax margin", short: "EBT / Revenue", num: "ebt", den: "revenue", kind: "pct" },
  { key: "ncp", label: "Net cost plus (MOTC)", short: "EBIT / Total cost", num: "ebit", den: "totalCost", kind: "pct" },
  { key: "berry", label: "Berry ratio", short: "Gross profit / Opex", num: "grossProfit", den: "opex", kind: "ratio" },
  { key: "roa", label: "Return on assets", short: "Net income / Assets", num: "netIncome", den: "assets", kind: "pct" },
  { key: "rd_intensity", label: "R&D intensity", short: "R&D / Revenue", num: "rnd", den: "revenue", kind: "pct" },
]

export type PLIResult = {
  key: string; label: string; short: string; kind: "pct" | "ratio"
  value: number | null; sumNum: number | null; sumDen: number | null
  perYear: { year: number; num: number | null; den: number | null; ratio: number | null }[]
}

export function computePLI(L: Lines, def: PLIDef, years: number[]): PLIResult {
  const num = L[def.num] || {}, den = L[def.den] || {}
  const sumNum = sumOver(num, years), sumDen = sumOver(den, years)
  const value = sumNum != null && sumDen != null && sumDen !== 0 ? sumNum / sumDen : null
  const perYear = years.map(y => {
    const n = num[y] ?? null, d = den[y] ?? null
    return { year: y, num: n, den: d, ratio: n != null && d != null && d !== 0 ? n / d : null }
  })
  return { key: def.key, label: def.label, short: def.short, kind: def.kind, value, sumNum, sumDen, perYear }
}
export const computePLIs = (L: Lines, years: number[]): PLIResult[] => PLIS.map(d => computePLI(L, d, years))

export type PeriodTotals = { years: number; revenue: number | null; ebit: number | null; netIncome: number | null; opMargin: number | null; netMargin: number | null }
export function periodTotals(L: Lines, years: number[]): PeriodTotals {
  const revenue = sumOver(L.revenue, years), ebit = sumOver(L.ebit, years), netIncome = sumOver(L.netIncome, years)
  return {
    years: years.length, revenue, ebit, netIncome,
    opMargin: revenue && ebit != null ? ebit / revenue : null,
    netMargin: revenue && netIncome != null ? netIncome / revenue : null,
  }
}
