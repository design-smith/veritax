export type WatchType = "Margin" | "Safe harbour" | "Pillar 2 ETR" | "Threshold"
export type WatchStatus = "breached" | "drifting" | "inRange"
export type BoundaryUnit = "percent" | "currency"

export interface QuarterValue {
  quarter: string
  value: number
}

export type Boundary =
  | { kind: "range"; low: number; high: number; unit: BoundaryUnit }
  | { kind: "limit"; value: number; direction: "min" | "max"; unit: BoundaryUnit }

export interface PositionWatch {
  id: string
  title: string
  entity: string
  jurisdiction: string
  watchType: WatchType
  metric: string
  boundary: Boundary
  history: QuarterValue[]
  boundarySource: string
  fullCitation: string
  fiscalYearEnd: string
  sourceKind: "Derived" | "Manual"
  createdDate: string
  dataSource: string
  staleSource?: boolean
  riskLink?: boolean
  estimatedImpact?: { amount: number; currency: string; label: string } | null
  crossingLabel?: string
}

export const WATCH_TYPES: WatchType[] = ["Margin", "Safe harbour", "Pillar 2 ETR", "Threshold"]

export function isOutsideBoundary(value: number, boundary: Boundary): boolean {
  if (boundary.kind === "range") return value < boundary.low || value > boundary.high
  return boundary.direction === "max" ? value > boundary.value : value < boundary.value
}

export function currentValue(watch: PositionWatch): number {
  return watch.history[watch.history.length - 1]?.value ?? 0
}

export function linearSlope(values: QuarterValue[]): number {
  const trailing = values.slice(-4)
  const n = trailing.length
  if (n < 2) return 0
  const meanX = (n - 1) / 2
  const meanY = trailing.reduce((sum, p) => sum + p.value, 0) / n
  let num = 0
  let den = 0
  trailing.forEach((p, x) => {
    num += (x - meanX) * (p.value - meanY)
    den += (x - meanX) ** 2
  })
  return den === 0 ? 0 : num / den
}

export function projectedCrossing(watch: PositionWatch): { quarters: number; value: number; label: string } | null {
  const current = currentValue(watch)
  if (isOutsideBoundary(current, watch.boundary)) return null
  const slope = linearSlope(watch.history)
  if (slope === 0) return null

  let target: number | null = null
  if (watch.boundary.kind === "range") {
    if (slope < 0) target = watch.boundary.low
    if (slope > 0) target = watch.boundary.high
  } else {
    if (watch.boundary.direction === "max" && slope > 0) target = watch.boundary.value
    if (watch.boundary.direction === "min" && slope < 0) target = watch.boundary.value
  }
  if (target === null) return null

  const quarters = (target - current) / slope
  if (quarters <= 0) return null

  const crossingDate = addMonths(new Date("2026-06-30T00:00:00"), quarters * 3)
  if (crossingDate.getTime() > new Date(watch.fiscalYearEnd + "T23:59:59").getTime()) return null

  return {
    quarters,
    value: target,
    label: watch.crossingLabel ?? crossingDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
  }
}

export function statusOfWatch(watch: PositionWatch): WatchStatus {
  if (isOutsideBoundary(currentValue(watch), watch.boundary)) return "breached"
  return projectedCrossing(watch) ? "drifting" : "inRange"
}

export function formatValue(value: number, unit: BoundaryUnit): string {
  if (unit === "percent") return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`
  return value >= 1_000_000
    ? `\u20ac${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
    : `\u20ac${value.toLocaleString("en-US")}`
}

export function boundaryLabel(boundary: Boundary): string {
  if (boundary.kind === "range") return `Range ${formatValue(boundary.low, boundary.unit)}-${formatValue(boundary.high, boundary.unit)}`
  return `${boundary.direction === "max" ? "Limit" : "Floor"} ${formatValue(boundary.value, boundary.unit)}`
}

export function impactLabel(watch: PositionWatch): string {
  return watch.estimatedImpact
    ? `${formatValue(watch.estimatedImpact.amount, "currency")} ${watch.estimatedImpact.label}`
    : "requires computation"
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date)
  next.setDate(1)
  next.setMonth(next.getMonth() + Math.floor(months))
  const remainderDays = Math.round((months - Math.floor(months)) * 30)
  next.setDate(next.getDate() + remainderDays)
  return next
}

const q = (quarter: string, value: number): QuarterValue => ({ quarter, value })

export const SEEDED_WATCHES: PositionWatch[] = [
  {
    id: "mgmt-us-jp-markup",
    title: "Management services US -> JP - markup",
    entity: "Unilever United States Inc.",
    jurisdiction: "United States",
    watchType: "Margin",
    metric: "Cost-plus markup",
    boundary: { kind: "range", low: 5, high: 10, unit: "percent" },
    history: [q("Q3 2024", 6.8), q("Q4 2024", 6.4), q("Q1 2025", 6.1), q("Q2 2025", 5.8), q("Q3 2025", 5.7), q("Q4 2025", 5.3), q("Q1 2026", 5.1), q("Q2 2026", 0)],
    boundarySource: "Benchmark study 2025 - cost-plus services range",
    fullCitation: "Benchmark study 2025, management services interquartile range, tested-party markup.",
    fiscalYearEnd: "2026-12-31",
    sourceKind: "Derived",
    createdDate: "2026-01-18",
    dataSource: "Intercompany services ledger",
    staleSource: true,
    riskLink: true,
    estimatedImpact: { amount: 2_400_000, currency: "EUR", label: "true-up" },
  },
  {
    id: "gmbh-operating-margin",
    title: "Veritax GmbH - Operating margin",
    entity: "Veritax GmbH",
    jurisdiction: "Germany",
    watchType: "Margin",
    metric: "Operating margin",
    boundary: { kind: "range", low: 2.1, high: 4.8, unit: "percent" },
    history: [q("Q3 2024", 3.3), q("Q4 2024", 3.1), q("Q1 2025", 2.9), q("Q2 2025", 2.7), q("Q3 2025", 2.66), q("Q4 2025", 2.54), q("Q1 2026", 2.42), q("Q2 2026", 2.3)],
    boundarySource: "Benchmark study 2025 - interquartile range",
    fullCitation: "Benchmark study 2025, German limited-risk distributor operating-margin range.",
    fiscalYearEnd: "2026-12-31",
    sourceKind: "Derived",
    createdDate: "2026-02-02",
    dataSource: "Germany management accounts",
    estimatedImpact: { amount: 1_200_000, currency: "EUR", label: "true-up" },
  },
  {
    id: "bv-revenue-threshold",
    title: "Veritax B.V. - revenue vs documentation threshold",
    entity: "Veritax B.V.",
    jurisdiction: "Netherlands",
    watchType: "Threshold",
    metric: "Revenue threshold",
    boundary: { kind: "limit", value: 50_000_000, direction: "max", unit: "currency" },
    history: [q("Q3 2024", 43_900_000), q("Q4 2024", 44_800_000), q("Q1 2025", 45_900_000), q("Q2 2025", 46_500_000), q("Q3 2025", 46_700_000), q("Q4 2025", 47_300_000), q("Q1 2026", 47_900_000), q("Q2 2026", 48_500_000)],
    boundarySource: "CIT Act art. 29b-29h threshold",
    fullCitation: "Netherlands Corporate Income Tax Act articles 29b-29h documentation threshold.",
    fiscalYearEnd: "2027-06-30",
    sourceKind: "Derived",
    createdDate: "2026-03-11",
    dataSource: "Netherlands ERP revenue feed",
    staleSource: true,
    estimatedImpact: null,
    crossingLabel: "Q1 2027",
  },
  {
    id: "manual-royalty-cap",
    title: "Unilever Nederland B.V. - royalty cap",
    entity: "Unilever Nederland B.V.",
    jurisdiction: "Netherlands",
    watchType: "Safe harbour",
    metric: "Royalty rate",
    boundary: { kind: "limit", value: 6, direction: "max", unit: "percent" },
    history: [q("Q3 2024", 4.9), q("Q4 2024", 5), q("Q1 2025", 5.1), q("Q2 2025", 5.1), q("Q3 2025", 5), q("Q4 2025", 5.2), q("Q1 2026", 5.1), q("Q2 2026", 5.2)],
    boundarySource: "Manual",
    fullCitation: "Manual watch entered by the tax team.",
    fiscalYearEnd: "2026-12-31",
    sourceKind: "Manual",
    createdDate: "2026-05-02",
    dataSource: "Manual entry",
    estimatedImpact: null,
  },
  ...[
    ["ireland-etr", "Unilever Ireland Ltd", "Ireland", "Pillar 2 ETR", "ETR", { kind: "limit", value: 15, direction: "min", unit: "percent" } as Boundary, [18.5, 18.4, 18.6, 18.3, 18.2, 18.1, 18.2, 18.1], "Pillar 2 model - 15% minimum ETR"],
    ["uk-margin", "Unilever U.K. Ltd", "United Kingdom", "Margin", "Distribution margin", { kind: "range", low: 2.5, high: 5.5, unit: "percent" } as Boundary, [3.8, 3.9, 3.7, 3.8, 3.9, 4.0, 3.9, 3.8], "Benchmark study 2025 - UK distributor range"],
    ["aus-cbc", "Unilever Australia Ltd", "Australia", "Threshold", "CbC revenue threshold", { kind: "limit", value: 1_000_000_000, direction: "max", unit: "currency" } as Boundary, [710_000_000, 728_000_000, 742_000_000, 756_000_000, 768_000_000, 779_000_000, 790_000_000, 802_000_000], "ITAA 1997 Subdiv 815-E"],
    ["can-doc", "Unilever Canada Inc.", "Canada", "Threshold", "Contemporaneous documentation", { kind: "limit", value: 10_000_000, direction: "max", unit: "currency" } as Boundary, [5_900_000, 6_100_000, 6_300_000, 6_500_000, 6_700_000, 6_900_000, 7_100_000, 7_300_000], "Income Tax Act s.247(4)"],
    ["fr-margin", "Unilever France SAS", "France", "Margin", "Manufacturing margin", { kind: "range", low: 4, high: 8, unit: "percent" } as Boundary, [5.4, 5.5, 5.7, 5.6, 5.8, 5.7, 5.9, 5.8], "Benchmark study 2025 - France manufacturing range"],
    ["de-threshold", "Unilever Deutschland GmbH", "Germany", "Threshold", "GAufzV documentation threshold", { kind: "limit", value: 6_000_000, direction: "max", unit: "currency" } as Boundary, [3_900_000, 4_000_000, 4_100_000, 4_150_000, 4_250_000, 4_300_000, 4_380_000, 4_450_000], "GAufzV \u00a76 threshold"],
    ["us-6662", "Unilever United States Inc.", "United States", "Threshold", "Section 6662(e) exposure", { kind: "limit", value: 20_000_000, direction: "max", unit: "currency" } as Boundary, [10_000_000, 10_500_000, 11_000_000, 11_300_000, 11_600_000, 11_900_000, 12_200_000, 12_500_000], "Treas. Reg. 1.6662-6"],
    ["nl-margin", "Unilever Nederland B.V.", "Netherlands", "Margin", "Procurement margin", { kind: "range", low: 1.5, high: 3.8, unit: "percent" } as Boundary, [2.5, 2.4, 2.4, 2.5, 2.6, 2.5, 2.5, 2.4], "Benchmark study 2025 - procurement range"],
    ["uk-etr", "Unilever U.K. Ltd", "United Kingdom", "Pillar 2 ETR", "ETR", { kind: "limit", value: 15, direction: "min", unit: "percent" } as Boundary, [19.2, 19.1, 19, 18.9, 18.8, 18.7, 18.8, 18.9], "Pillar 2 model - 15% minimum ETR"],
    ["fr-threshold", "Unilever France SAS", "France", "Threshold", "2257-SD filing threshold", { kind: "limit", value: 400_000_000, direction: "max", unit: "currency" } as Boundary, [210_000_000, 216_000_000, 220_000_000, 226_000_000, 231_000_000, 236_000_000, 240_000_000, 245_000_000], "CGI art. 223 quinquies B"],
    ["ie-margin", "Unilever Ireland Ltd", "Ireland", "Safe harbour", "Low-risk services markup", { kind: "range", low: 3, high: 7, unit: "percent" } as Boundary, [5.6, 5.4, 5.5, 5.6, 5.7, 5.6, 5.5, 5.6], "TCA 1997 s.835D support-services policy"],
    ["aus-margin", "Unilever Australia Ltd", "Australia", "Margin", "Distribution margin", { kind: "range", low: 2, high: 6, unit: "percent" } as Boundary, [4.1, 4.2, 4.2, 4.3, 4.2, 4.1, 4.2, 4.1], "Benchmark study 2025 - Australia distributor range"],
    ["can-etr", "Unilever Canada Inc.", "Canada", "Pillar 2 ETR", "ETR", { kind: "limit", value: 15, direction: "min", unit: "percent" } as Boundary, [17.6, 17.5, 17.7, 17.6, 17.8, 17.7, 17.6, 17.7], "Pillar 2 model - 15% minimum ETR"],
  ].map(([id, entity, jurisdiction, watchType, metric, boundary, values, source], idx) => ({
    id: id as string,
    title: `${entity} - ${metric}`,
    entity: entity as string,
    jurisdiction: jurisdiction as string,
    watchType: watchType as WatchType,
    metric: metric as string,
    boundary: boundary as Boundary,
    history: (values as number[]).map((value, i) => q(["Q3 2024", "Q4 2024", "Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"][i], value)),
    boundarySource: source as string,
    fullCitation: source as string,
    fiscalYearEnd: "2026-12-31",
    sourceKind: "Derived" as const,
    createdDate: `2026-0${(idx % 5) + 1}-15`,
    dataSource: idx % 2 === 0 ? "ERP quarterly close feed" : "Tax provision model",
    estimatedImpact: null,
  })),
]

export const ALL_WATCH_ENTITIES = [...new Set(SEEDED_WATCHES.map(w => w.entity))]
export const ALL_WATCH_JURISDICTIONS = [...new Set(SEEDED_WATCHES.map(w => w.jurisdiction))]
