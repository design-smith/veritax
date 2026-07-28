export const CASE_STAGES = ["notice", "responding", "awaiting", "resolved"] as const
export type CaseStage = typeof CASE_STAGES[number]

export const QUESTION_STATUSES = ["open", "drafted", "sent"] as const
export type QuestionStatus = typeof QUESTION_STATUSES[number]

export type ConsistencyStatus = "consistent" | "deviations"
export type CaseOutcome = "noChange" | "adjusted" | "settled"

export type Citation = {
  label: string
  source: string
}

export type Exhibit = {
  id: string
  filename: string
  filingDate: string
  hash: string
  source: string
}

export type Deviation = {
  claim: string
  filingSays: string
  source: string
}

export type DefenseItem = {
  id: string
  number: string
  question: string
  noticeRef: string
  status: QuestionStatus
  topics: string[]
  response: string
  citations: Citation[]
  exhibits: Exhibit[]
  consistency: {
    status: ConsistencyStatus
    deviations: Deviation[]
  }
}

export type TimelineEvent = {
  id: string
  date: string
  type: "notice" | "extension" | "response" | "stage" | "deadline" | "manual" | "export"
  note: string
  attachment?: string
}

export type DefenseCase = {
  id: string
  name: string
  authority: string
  entity: string
  jurisdiction: string
  years: string[]
  stage: CaseStage
  nextDeadline: string
  exposure: {
    proposed: number
    position: number
  }
  created: string
  items: DefenseItem[]
  timeline: TimelineEvent[]
  closed?: {
    resolvedDate: string
    outcome: CaseOutcome
    finalAmount: number
  }
}

export const DEMO_TODAY = "2026-07-27"

export const STAGE_LABELS: Record<CaseStage, string> = {
  notice: "Notice received",
  responding: "Responding",
  awaiting: "Awaiting authority",
  resolved: "Resolved",
}

export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  open: "Open",
  drafted: "Drafted",
  sent: "Sent",
}

export const OUTCOME_LABELS: Record<CaseOutcome, string> = {
  noChange: "No change",
  adjusted: "Adjusted",
  settled: "Settled",
}

export const SEALED_EXHIBITS: Exhibit[] = [
  {
    id: "de-local-file-2023",
    filename: "DE Local File FY2023.pdf",
    filingDate: "2025-03-12",
    hash: "a8f4c3d8e0b91861",
    source: "Library sealed filing",
  },
  {
    id: "msa-services-2023",
    filename: "Management Services Agreement.pdf",
    filingDate: "2024-02-02",
    hash: "53bd44a11e7c920f",
    source: "Library sealed agreement",
  },
]

export const SEEDED_CASES: DefenseCase[] = [
  {
    id: "de-gmbh-2023-2024",
    name: "Germany \u2014 Veritax GmbH \u2014 FY2023\u20132024",
    authority: "Bundeszentralamt f\u00fcr Steuern",
    entity: "Veritax GmbH",
    jurisdiction: "Germany",
    years: ["FY2023", "FY2024"],
    stage: "responding",
    nextDeadline: "2026-08-07",
    exposure: { proposed: 4_200_000, position: 300_000 },
    created: "2026-06-04",
    items: [
      {
        id: "de-q1",
        number: "1",
        question: "Describe the management services provided by Veritax US to Veritax GmbH during FY2023 and FY2024.",
        noticeRef: "Notice.pdf p.2, item 1",
        status: "drafted",
        topics: ["US\u2192DE services", "Agreement", "FY2023\u20132024"],
        response: "Veritax US provided finance, HR, legal operations, and platform support services to Veritax GmbH during the years under exam. The service categories and recipient scope match the filed local-file description.",
        citations: [
          { label: "Local file 3.1", source: "DE Local File FY2023.pdf p.18" },
          { label: "Agreement 2.2", source: "Management Services Agreement.pdf p.4" },
        ],
        exhibits: SEALED_EXHIBITS,
        consistency: { status: "consistent", deviations: [] },
      },
      {
        id: "de-q2",
        number: "2",
        question: "State the transfer pricing method selected for the management services charge and explain why it was selected.",
        noticeRef: "Notice.pdf p.2, item 2",
        status: "drafted",
        topics: ["Method", "Services", "Local file"],
        response: "The filed position applies a services cost-plus method for routine support services, with method selection based on the limited-risk service provider profile and available service-provider benchmarks.",
        citations: [
          { label: "Method rationale", source: "DE Local File FY2023.pdf p.24" },
          { label: "Functional profile", source: "DE Local File FY2023.pdf p.21" },
        ],
        exhibits: [SEALED_EXHIBITS[0]],
        consistency: { status: "consistent", deviations: [] },
      },
      {
        id: "de-q3",
        number: "3",
        question: "Provide benchmark support for the arm's-length markup range relied on for the services transaction.",
        noticeRef: "Notice.pdf p.3, item 3",
        status: "drafted",
        topics: ["Benchmark", "Markup range", "FY2023"],
        response: "The filed benchmark study supports an interquartile markup range of 5.0% to 10.0% for comparable management services providers.",
        citations: [
          { label: "Benchmark table", source: "Benchmark Study 2025.pdf p.12" },
          { label: "Range conclusion", source: "DE Local File FY2023.pdf p.31" },
        ],
        exhibits: [SEALED_EXHIBITS[0]],
        consistency: { status: "consistent", deviations: [] },
      },
      {
        id: "de-q4",
        number: "4",
        question: "Confirm the markup charged by Veritax US for management services supplied to Veritax GmbH.",
        noticeRef: "Notice.pdf p.3, item 4",
        status: "drafted",
        topics: ["Markup", "US\u2192DE services", "Filed position"],
        response: "The management services charge reflected a 5.0% markup for FY2023 and FY2024, consistent with the benchmarked services range.",
        citations: [
          { label: "Draft claim", source: "Generated response draft" },
          { label: "Filed markup", source: "DE Local File FY2023.pdf p.29" },
        ],
        exhibits: [SEALED_EXHIBITS[0], SEALED_EXHIBITS[1]],
        consistency: {
          status: "deviations",
          deviations: [
            {
              claim: "Draft says the management services charge reflected a 5.0% markup.",
              filingSays: "The sealed FY2023 German local file records a 0.0% markup for the US-to-Germany management services fee.",
              source: "DE Local File FY2023.pdf p.29, table 4.2",
            },
          ],
        },
      },
      {
        id: "de-q5",
        number: "5",
        question: "Reconcile the management fee recorded in the German ledger with the intercompany services agreement.",
        noticeRef: "Notice.pdf p.4, item 5",
        status: "open",
        topics: ["Ledger", "Agreement", "Reconciliation"],
        response: "",
        citations: [],
        exhibits: [],
        consistency: { status: "consistent", deviations: [] },
      },
      {
        id: "de-q6",
        number: "6",
        question: "Provide invoices, workpapers, and supporting schedules for each management services charge booked in FY2023 and FY2024.",
        noticeRef: "Notice.pdf p.4, item 6",
        status: "open",
        topics: ["Invoices", "Workpapers", "Schedules"],
        response: "",
        citations: [],
        exhibits: [],
        consistency: { status: "consistent", deviations: [] },
      },
    ],
    timeline: [
      { id: "de-t3", date: "2026-07-11", type: "response", note: "First response round sent with two sealed exhibits.", attachment: "Response Pack Round 1.pdf" },
      { id: "de-t2", date: "2026-06-21", type: "extension", note: "Extension granted. Response deadline moved to 7 Aug 2026." },
      { id: "de-t1", date: "2026-06-04", type: "notice", note: "Information request received and parsed into six questions.", attachment: "Notice.pdf" },
    ],
  },
  {
    id: "uk-ltd-2022",
    name: "United Kingdom \u2014 Veritax Ltd \u2014 FY2022",
    authority: "HM Revenue & Customs",
    entity: "Veritax Ltd",
    jurisdiction: "United Kingdom",
    years: ["FY2022"],
    stage: "resolved",
    nextDeadline: "2026-04-12",
    exposure: { proposed: 0, position: 0 },
    created: "2025-11-14",
    closed: { resolvedDate: "2026-04-12", outcome: "noChange", finalAmount: 0 },
    items: [],
    timeline: [
      { id: "uk-t1", date: "2026-04-12", type: "stage", note: "Case resolved with no change." },
    ],
  },
]

export function activeCases(cases: DefenseCase[]) {
  return cases.filter(c => !c.closed)
}

export function closedCases(cases: DefenseCase[]) {
  return cases.filter(c => c.closed)
}

export function formatMoney(amount: number) {
  if (amount === 0) return "\u20ac0"
  if (Math.abs(amount) >= 1_000_000) return `\u20ac${(amount / 1_000_000).toFixed(1)}M`
  return `\u20ac${Math.round(amount / 1_000)}k`
}

export function exposureDelta(c: DefenseCase) {
  return Math.max(c.exposure.proposed - c.exposure.position, 0)
}

export function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export function daysUntil(iso: string, today = DEMO_TODAY) {
  const day = 24 * 60 * 60 * 1000
  return Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / day)
}

export function deadlineText(iso: string) {
  const days = daysUntil(iso)
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return "due today"
  return `${days} days remaining`
}
