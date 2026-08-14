// In-memory backend for the public /demo route. The real app (app/page.tsx) and every step component
// run UNCHANGED against the `api` singleton in lib/api.ts; on /demo that singleton routes here instead of
// the network (see the Proxy at the bottom of lib/api.ts). Same behavior, nothing actually executes.
//
// The dataset is one group entity (Veritax Outsourcing & Services) documented for three jurisdictions.
// Each jurisdiction uses its REAL Local File element list from backend/app/data/jurisdiction_requirements.json
// (UAE = FTA Ministerial Decision 97/2023, 7 elements; Singapore = IRAS 6th Ed, 8 elements; South Africa =
// SARS Public Notice 1334, 8 elements) as both its requirements and its draft template. Loading states are
// staged so each step shows its real progress (indexing -> assessing -> drafting -> analysing) briefly.

import type {
  Connector,
  CoverageResponse,
  CoverageRow,
  DocChart,
  DocTable,
  DocumentFactsResponse,
  DocumentRead,
  DocumentTextRead,
  DraftResponse,
  DraftSection,
  Engagement,
  EngagementSummary,
  HealthResponse,
  PipelineRecoveryResponse,
  RiskFinding,
  RiskResponse,
} from "./api"

// Active only on the public demo route. Keying off the URL auto-scopes it: the real app (other routes,
// authenticated) keeps using the network even in the same browser session.
export const inDemo = () =>
  typeof window !== "undefined" && window.location.pathname.startsWith("/demo")

export const DEMO_ENGAGEMENT_ID = "demo-vos-fy2024"
const JURISDICTIONS_COVERED = ["United Arab Emirates", "Singapore", "South Africa"]

// ── Staged loading ──────────────────────────────────────────────────────────
// Components poll get* on their own timers. We count polls per key and flip from "in progress" to "done"
// after a couple of cycles so the real loading UI (assessing / drafting / analysing) shows briefly.
const polls = new Map<string, number>()
const tick = (key: string): number => { const n = (polls.get(key) ?? 0) + 1; polls.set(key, n); return n }
const resetPoll = (key: string) => { polls.delete(key) }

const REVEAL_PER_POLL = 3   // requirement rows revealed per assessment poll
const RISK_POLLS = 1        // "analysing" polls before findings land
const DRAFT_MS = 550        // brief "generating" beat before the draft lands — short so the tour never stalls
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// Document indexing runs off wall-clock from first fetch, so Planning shows chips settle and Requirements
// shows "Preparing documents — X of Y indexed" if the visitor gets there quickly.
const INDEX_MS = 5000
let indexStart = 0
const indexElapsed = (): number => {
  if (indexStart === 0) indexStart = Date.now()
  return Date.now() - indexStart
}

// ── Jurisdiction profiles ─────────────────────────────────────────────────────
interface Profile {
  jurisdiction: string
  place: string
  currency: string
  form: string
  address: string
  authority: string
  taxLaw: string
  methodRef: string
  competitors: string
  extraRisk: RiskFinding
}

function mkExtraRisk(id: string, title: string, description: string, exposure_label: string, reference: string, quote: string, recs: string[]): RiskFinding {
  return {
    id, kind: "exposure", severity: "medium", title, description,
    exposure_label, exposure_estimated: true, exposure_amount: null, exposure_currency: null, confidence: "medium",
    evidence: [{ kind: "section", reference, detail: quote, source_label: "Local File draft", verified: true, document_id: null }],
    recommendations: recs,
  }
}

const PROFILES: Record<string, Profile> = {
  "United Arab Emirates": {
    jurisdiction: "United Arab Emirates",
    place: "the UAE", currency: "AED", form: "LLC",
    address: "Office 1204, One Central, Dubai, United Arab Emirates",
    authority: "Federal Tax Authority (FTA)",
    taxLaw: "UAE Corporate Tax Law (Federal Decree-Law No. 47 of 2022)",
    methodRef: "Article 34 of the UAE Corporate Tax Law",
    competitors: "Regional manpower and facilities-management providers across the GCC.",
    extraRisk: mkExtraRisk(
      "f-uae", "Interest-free related-party funding under UAE Corporate Tax",
      "The UAE Corporate Tax regime expects related-party financing to carry an arm's-length rate. The interest-free fund transfers may attract an adjustment and require a disclosure-form entry.",
      "Arm's-length interest", "Controlled Transactions",
      "Fund transfers were short-term, interest-free and reciprocal.",
      ["Benchmark an arm's-length interest rate for the related-party balances.", "Complete the UAE Corporate Tax transfer pricing disclosure form."],
    ),
  },
  "Singapore": {
    jurisdiction: "Singapore",
    place: "Singapore", currency: "SGD", form: "Pte. Ltd.",
    address: "8 Marina Boulevard, Marina Bay Financial Centre, Singapore",
    authority: "Inland Revenue Authority of Singapore (IRAS)",
    taxLaw: "the Singapore Income Tax Act (section 34F)",
    methodRef: "the most appropriate OECD method endorsed by the IRAS Transfer Pricing Guidelines",
    competitors: "Other staff-augmentation firms serving the Singapore public and financial sectors.",
    extraRisk: mkExtraRisk(
      "f-sg", "Cost pass-throughs charged without a markup (IRAS)",
      "IRAS expects routine intra-group services to earn an arm's-length markup. Settling supplier payments at cost, with no markup, may be challenged for the Singapore file.",
      "Routine-service markup", "Related Party Transactions",
      "Supplier payments were settlements made on behalf of related parties and later reimbursed.",
      ["Assess whether a routine-service markup applies under the IRAS guidance.", "Confirm the SGD documentation thresholds and retain contemporaneous support."],
    ),
  },
  "South Africa": {
    jurisdiction: "South Africa",
    place: "South Africa", currency: "ZAR", form: "(Pty) Ltd",
    address: "The Zone, Rosebank, Johannesburg, South Africa",
    authority: "South African Revenue Service (SARS)",
    taxLaw: "the South African Income Tax Act (section 31)",
    methodRef: "section 31 of the Income Tax Act",
    competitors: "Domestic staffing and outsourcing providers in the South African market.",
    extraRisk: mkExtraRisk(
      "f-za", "Related-party funding and potential thin-capitalisation (SARS)",
      "SARS scrutinises interest-free related-party funding and thin-capitalisation. The undocumented fund transfers may be adjusted and should be cross-referenced to the group Master File.",
      "Thin-capitalisation / funding", "Intercompany Agreements",
      "The entity has not executed formal intragroup agreements for the controlled transactions.",
      ["Set an arm's-length rate and terms for the related-party funding.", "Cross-reference the position to the group Master File retained for SARS."],
    ),
  },
}
const profileFor = (jur: string): Profile => PROFILES[jur] ?? PROFILES["United Arab Emirates"]

// ── Draft content, mapped by topic onto each jurisdiction's real element list ──
type Topic = "profile" | "strategy" | "transactions" | "far" | "method" | "benchmarking" | "yoy" | "financials" | "agreements"

const ENTITY = "Veritax Outsourcing & Services"

function body(topic: Topic, p: Profile): string {
  switch (topic) {
    case "profile":
      return `${ENTITY} ${p.form} is the ${p.place} entity of the Veritax group and is wholly owned by Veritax Group Holding (VGH). It provides technical manpower and staff augmentation services to government and quasi-government clients in ${p.place}.

The entity runs as a single management line. Karim Haddad, General Manager, is the authorised signatory; Sheikh Nasser Al-Kuwari, Chairman of VGH, is the ultimate beneficial owner. The principal office is at ${p.address}. The entity had 21 employees at 31 December 2024.`
    case "strategy":
      return `The entity competes as a long-term staffing partner to government and quasi-government clients rather than on short-term price. It runs a deliberately asset-light model in which people and administrative capacity, not physical assets, create the value. Core activity is recruitment, staffing and personnel support; the entity performs no research and development and owns no intangibles.

${p.competitors}

No business restructuring or transfer of intangibles took place during FY2024 or the preceding year.`
    case "transactions":
      return `During FY2024 the entity entered into two categories of controlled transaction with related parties above the ${p.currency} 200,000 threshold: fund transfers and supplier payments. Counterparties are Veritax group entities and connected persons, and the balances reconcile to the intercompany ledgers.

Fund transfers were short-term, interest-free and reciprocal, made to cover payroll and urgent operating costs and cleared through reimbursements or netting. Supplier payments were settlements made on behalf of related parties and later reimbursed. Neither is financing, and neither is a value-adding service.`
    case "far":
      return `**Functions.** The entity sources, recruits, contracts and manages manpower while staying compliant with local labour and immigration rules. Staff are seconded to client organisations under commercial contracts.

**Assets.** The model is asset-light: leasehold improvements, computers and office equipment support operations but are not value drivers. The entity owns and develops no intangibles, so no DEMPE functions arise; client relationships are contractual.

**Risks.** Operational risk sits with recruitment and delivery. Credit risk is mainly trade and related-party receivables; an ECL of ${p.currency} 1,875,061 was recognised at 31 December 2024 (2023: ${p.currency} 2,957,253). Related-party balances are interest-free with no fixed repayment terms.`
    case "method":
      return `The Transactional Net Margin Method (TNMM) is the most appropriate method for the tested transactions, applied under ${p.methodRef}. Independent comparables for pass-through cost allocations of this kind are not readily available, so the CUP method does not apply; the entity is not a distributor, so the Resale Price method does not fit.

${ENTITY} is selected as the tested party, being the less complex party, with the net cost-plus operating margin as the profit level indicator.`
    case "benchmarking":
      return `A benchmarking search identified independent companies with a comparable functional profile. After screening and comparability adjustments, the arm's-length range on the net cost-plus indicator runs from a minimum of -0.9% to a maximum of 14.3%, with a lower quartile of -0.5%, a median of 7.3% and an upper quartile of 11.7% (three-year weighted averages).

The entity's tested operating margin of 3.25% falls inside the interquartile range, which supports an arm's-length outcome.`
    case "yoy":
      return `The table below compares the value of each controlled-transaction category for the current and preceding financial years. The movements are consistent with the group's operating needs and do not reflect a change in the transfer pricing policy.`
    case "financials":
      return `The analysis ties to the entity's audited annual financial statements for the year ended 31 December 2024. Segmented profit-and-loss data for the tested activity reconciles to the statutory accounts and the general ledger, so the tested operating margin of 3.25% can be traced from the transfer pricing analysis back to the books of account.`
    case "agreements":
      return `The entity has not executed formal intragroup transfer pricing agreements for the controlled transactions. Where no signed agreement exists, the terms have been deduced from the conduct of the parties and documented accordingly. Copies of any executed agreements, amendments and related contracts are retained with this file.`
  }
}

function tables(topic: Topic, order: number, p: Profile): DocTable[] {
  if (topic === "transactions") {
    return [
      {
        id: `tbl-${order}-1`, title: `Transaction One: Fund Transfers (amounts in ${p.currency})`,
        columns: ["Entity", `Amount in ${p.currency}`],
        rows: [
          ["Veritax Support Services", "152,000"],
          ["Veritax Group Holding", "3,915,537"],
          ["Veritax Integrated Services", "11,770"],
          ["Sheikh Nasser Al-Kuwari", "2,457,204"],
          ["Doha Marine Trading", "(1,385,492)"],
          ["On Point Support Services", "73,000"],
          ["Veritax Hospitality", "11,250"],
          ["TOTAL", "5,235,268.87"],
        ],
      },
      {
        id: `tbl-${order}-2`, title: `Transaction Two: Supplier Payments (amounts in ${p.currency})`,
        columns: ["Entity", `Amount in ${p.currency}`],
        rows: [
          ["Veritax Group Holding", "321,891"],
          ["Veritax Enterprise", "84,967"],
          ["TOTAL", "406,858"],
        ],
      },
    ]
  }
  if (topic === "benchmarking") {
    return [{
      id: `tbl-${order}-1`, title: "Benchmarking: Net Cost-Plus margins",
      columns: ["Net Cost-Plus", "2023", "2022", "2021", "3-year average"],
      rows: [
        ["Maximum", "14.5%", "14.5%", "13.8%", "14.3%"],
        ["3rd quartile", "12.4%", "13.0%", "12.5%", "11.7%"],
        ["Median", "2.7%", "10.7%", "6.9%", "7.3%"],
        ["1st quartile", "-1.8%", "-0.1%", "1.9%", "-0.5%"],
        ["Minimum", "-3.5%", "-0.3%", "0.8%", "-0.9%"],
        ["Number of observations", "5", "5", "4", "5"],
      ],
    }]
  }
  if (topic === "yoy") {
    return [{
      id: `tbl-${order}-1`, title: `Year-on-year transaction values (amounts in ${p.currency})`,
      columns: ["Transaction category", "FY2024", "FY2023", "Change"],
      rows: [
        ["Fund transfers", "5,235,269", "4,980,112", "+5.1%"],
        ["Supplier payments", "406,858", "372,540", "+9.2%"],
      ],
    }]
  }
  return []
}

// ── Real element lists (verbatim names + descriptions from jurisdiction_requirements.json) ──
interface Elem { order: number; name: string; desc: string; topic: Topic; present: string; source: string; locator: string }

const ELEMENTS: Record<string, Elem[]> = {
  "United Arab Emirates": [
    { order: 1, name: "Local Entity Profile and Operational Structure", desc: "Overview of the local entity's corporate structure, management organization, and operational business units.", topic: "profile", present: "The organisation chart, management reporting lines and business operations are set out in the entity profile.", source: "Management interview - Karim Haddad.vtt", locator: "The entity runs as a single management line…" },
    { order: 2, name: "Business Strategy and Historical Restructurings", desc: "Detailed explanation of business strategies, competitive market positioning, and recent corporate restructurings.", topic: "strategy", present: "Strategy, competitors and the absence of restructurings are described.", source: "Local File draft", locator: "The entity competes as a long-term staffing partner…" },
    { order: 3, name: "Controlled Transactions Inventory and Delineation", desc: "Comprehensive identification and characterization of all intercompany transactions entered into with related parties and connected persons.", topic: "transactions", present: "Both transaction categories are inventoried with counterparties and values reconciled to the ledgers.", source: "VOS Trial Balance FY2024.xlsx", locator: "TOTAL 5,235,268.87 / 406,858" },
    { order: 4, name: "Functional, Asset, and Risk (FAR) Analysis", desc: "Delineation of functions performed, tangible and intangible assets employed, and operational/financial risks assumed by the local entity and related counterparties.", topic: "far", present: "Functions, assets, risks and DEMPE are analysed for the local entity.", source: "Local File draft", locator: "The entity sources, recruits, contracts and manages manpower…" },
    { order: 5, name: "Selection and Justification of Transfer Pricing Methodology", desc: "Detailed selection analysis identifying the most appropriate transfer pricing method mandated by Article 34 of the Corporate Tax Law.", topic: "method", present: "TNMM is selected under Article 34, with reasons for rejecting CUP and Resale Price.", source: "Local File draft", locator: "The Transactional Net Margin Method (TNMM) is the most appropriate method…" },
    { order: 6, name: "Comparability Analysis and Economic Benchmarking", desc: "Detailed benchmarking study evaluating uncontrolled comparable transactions or independent companies.", topic: "benchmarking", present: "The benchmarking study sets out the search, adjustments and interquartile range.", source: "Local File draft", locator: "lower quartile of -0.5%, a median of 7.3% and an upper quartile of 11.7%" },
    { order: 7, name: "Financial Statements and Segmented Data Reconciliation", desc: "Complete financial context linking transfer pricing analysis directly to books of account.", topic: "financials", present: "Audited statements and segmented data reconcile the tested margin to the ledger.", source: "VOS Audited Financial Statements FY2024.pdf", locator: "the tested operating margin of 3.25% can be traced…" },
  ],
  "Singapore": [
    { order: 1, name: "Identity and Local Entity Overview", desc: "Profile of the Singapore legal entity and management structure.", topic: "profile", present: "Corporate details, the organisation chart, business activities and competitors are set out.", source: "Management interview - Karim Haddad.vtt", locator: "The entity runs as a single management line…" },
    { order: 2, name: "Details of Material Related Party Transactions", desc: "Breakdown of intercompany dealings.", topic: "transactions", present: "Related-party dealings are broken down by category with aggregate flows.", source: "VOS Trial Balance FY2024.xlsx", locator: "TOTAL 5,235,268.87 / 406,858" },
    { order: 3, name: "Functional, Asset, and Risk (FAR) Delineation", desc: "Detailed analysis of economic contributions by the Singapore taxpayer relative to related counterparties.", topic: "far", present: "Functions, assets and risks are delineated for the local taxpayer.", source: "Local File draft", locator: "The entity sources, recruits, contracts and manages manpower…" },
    { order: 4, name: "Transfer Pricing Method Selection and Rationale", desc: "Method selection analysis.", topic: "method", present: "TNMM is selected with reasons for rejecting the alternative methods and a tested party.", source: "Local File draft", locator: "The Transactional Net Margin Method (TNMM) is the most appropriate method…" },
    { order: 5, name: "Comparability Analysis and Economic Benchmarking", desc: "Benchmark evaluation confirming arm's length outcomes.", topic: "benchmarking", present: "The benchmarking study confirms the tested margin sits within the arm's-length range.", source: "Local File draft", locator: "the tested operating margin of 3.25% falls inside the interquartile range" },
    { order: 6, name: "Year-on-Year Transaction Value Comparison", desc: "Historical comparative analysis tracking transaction stability.", topic: "yoy", present: "A multi-year table compares current and prior-year transaction values with explanation.", source: "VOS Trial Balance FY2024.xlsx", locator: "Fund transfers 5,235,269 vs 4,980,112" },
    { order: 7, name: "Financial Data and Segmented Statements", desc: "Financial context supporting transfer pricing analysis calculations.", topic: "financials", present: "Annual statements and segmented data reconcile to the transfer pricing figures.", source: "VOS Audited Financial Statements FY2024.pdf", locator: "the tested operating margin of 3.25% can be traced…" },
    { order: 8, name: "Intercompany Legal Agreements", desc: "Copies of executed contracts governing related party arrangements.", topic: "agreements", present: "The file documents that no agreements are signed and deduces the terms from conduct.", source: "Local File draft", locator: "the terms have been deduced from the conduct of the parties" },
  ],
  "South Africa": [
    { order: 1, name: "Corporate Structure and Local Entity Profile", desc: "Ownership details, operational organization, and corporate governance of the South African entity.", topic: "profile", present: "Shareholding, ultimate beneficial ownership and the organisation chart are set out.", source: "Management interview - Karim Haddad.vtt", locator: "wholly owned by Veritax Group Holding (VGH)" },
    { order: 2, name: "Business Strategy and Economic Context", desc: "Narrative describing the local market environment, core operations, and strategic focus.", topic: "strategy", present: "Strategy, economic context and key competitors are described.", source: "Local File draft", locator: "The entity competes as a long-term staffing partner…" },
    { order: 3, name: "Potentially Affected Transactions Schedule", desc: "Itemized schedule of cross-border transactions executed with foreign connected persons.", topic: "transactions", present: "The affected-transactions schedule itemises counterparties and annual values.", source: "VOS Trial Balance FY2024.xlsx", locator: "TOTAL 5,235,268.87 / 406,858" },
    { order: 4, name: "Functional, Asset, and Risk (FAR) Analysis", desc: "Delineation of functions performed, assets utilized, and economic risks borne by the South African entity relative to foreign counterparties.", topic: "far", present: "Functions, assets and risk-bearing capacity are analysed for the local entity.", source: "Local File draft", locator: "The entity sources, recruits, contracts and manages manpower…" },
    { order: 5, name: "Selection and Application of Transfer Pricing Method", desc: "Justification of the arm's length transfer pricing methodology selected under Section 31.", topic: "method", present: "TNMM is selected under section 31, with reasons for rejecting other OECD methods.", source: "Local File draft", locator: "The Transactional Net Margin Method (TNMM) is the most appropriate method…" },
    { order: 6, name: "Economic Analysis and Benchmarking Documentation", desc: "Economic benchmarking study establishing the arm's length range.", topic: "benchmarking", present: "The benchmarking study establishes the arm's-length range and adjustments.", source: "Local File draft", locator: "lower quartile of -0.5%, a median of 7.3% and an upper quartile of 11.7%" },
    { order: 7, name: "Financial Data and Segmented Reconciliation", desc: "Tie-in of transfer pricing economic analyses to official financial accounting records.", topic: "financials", present: "Audited statements and segmented data tie the analysis to the accounting records.", source: "VOS Audited Financial Statements FY2024.pdf", locator: "the tested operating margin of 3.25% can be traced…" },
    { order: 8, name: "Intercompany Agreements and Legal Contracts", desc: "Copies of all executed legal contracts governing potentially affected transactions.", topic: "agreements", present: "The file documents that no agreements are signed and deduces the terms from conduct.", source: "Local File draft", locator: "the terms have been deduced from the conduct of the parties" },
  ],
}
const elementsFor = (jur: string): Elem[] => ELEMENTS[jur] ?? ELEMENTS["United Arab Emirates"]

// ── Documents ─────────────────────────────────────────────────────────────────
const DOC_FIN = "demo-doc-financials"
const DOC_TB = "demo-doc-trialbalance"
const DOC_AGR1 = "demo-doc-priorfile"
const DOC_AGR2 = "demo-doc-questionnaire"
const DOC_INT = "demo-doc-interview"
const DOC_ORDER = [DOC_FIN, DOC_TB, DOC_AGR1, DOC_AGR2, DOC_INT]
const DOC_META: Record<string, { name: string; type: string }> = {
  [DOC_FIN]: { name: "VOS Audited Financial Statements FY2024.pdf", type: "application/pdf" },
  [DOC_TB]: { name: "VOS Trial Balance FY2024.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  [DOC_AGR1]: { name: "Prior Local File FY2023.pdf", type: "application/pdf" },
  [DOC_AGR2]: { name: "TP Questionnaire - VOS.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  [DOC_INT]: { name: "Management interview - Karim Haddad.vtt", type: "text/vtt" },
}

// A document is "indexed" once its staggered slice of the indexing window has elapsed.
function docRead(id: string): DocumentRead {
  const idx = DOC_ORDER.indexOf(id)
  const total = DOC_ORDER.length
  const done = indexElapsed() >= ((idx + 1) / total) * INDEX_MS
  const m = DOC_META[id] ?? { name: "Document", type: "application/octet-stream" }
  return {
    id,
    original_filename: m.name,
    content_type: m.type,
    size_bytes: 842_000,
    content_hash: id,
    status: done ? "embedded" : "embedding",
    extraction_status: done ? "extracted" : "extracting",
    error: null,
    created_at: "2025-09-21T09:00:00Z",
  }
}

function engagement(): Engagement {
  return {
    id: DEMO_ENGAGEMENT_ID,
    entity_name: ENTITY,
    jurisdictions: JURISDICTIONS_COVERED,
    fiscal_year: "FY2024",
    website_url: "https://veritax-outsourcing.com",
    selected_source_kinds: ["financials", "agreements", "public", "interview"],
    sources: [
      { id: "src-fin-up", kind: "financials", origin: "reference", connector_provider: null, url: null, documents: [docRead(DOC_FIN), docRead(DOC_TB)] },
      { id: "src-fin-erp", kind: "financials", origin: "connected", connector_provider: "sap", url: null, documents: [] },
      { id: "src-agr", kind: "agreements", origin: "reference", connector_provider: null, url: null, documents: [docRead(DOC_AGR1), docRead(DOC_AGR2)] },
      { id: "src-web", kind: "public", origin: "reference", connector_provider: null, url: "https://veritax-outsourcing.com", documents: [] },
      { id: "src-int-up", kind: "interview", origin: "reference", connector_provider: null, url: null, documents: [docRead(DOC_INT)] },
      { id: "src-int-nt", kind: "interview", origin: "connected", connector_provider: "fireflies", url: null, documents: [] },
    ],
  }
}

const SUMMARY: EngagementSummary = {
  id: DEMO_ENGAGEMENT_ID,
  entity_name: ENTITY,
  jurisdictions: JURISDICTIONS_COVERED,
  fiscal_year: "FY2024",
  updated_at: "2025-09-21T09:00:00Z",
}

// ── Requirements coverage ─────────────────────────────────────────────────────
// presentCount rows resolve to "present" (in element order); the rest stay "pending" so the assessment
// reveals row-by-row. When all are present the summary is draft-ready.
function coverage(jur: string, presentCount: number): CoverageResponse {
  const elems = elementsFor(jur)
  const total = elems.length
  const requirements: CoverageRow[] = elems.map((e, i) => {
    const present = i < presentCount
    return {
      id: `cov-${jur}-${e.order}`,
      requirement_key: `req-${e.order}`,
      element_order: e.order,
      element_name: e.name,
      element_description: e.desc,
      is_conditional: false,
      verified: true,
      status: present ? "present" : "pending",
      whats_present: present ? e.present : null,
      whats_missing: null,
      confidence: present ? "high" : null,
      error: null,
      sources_used: present ? [e.source] : [],
      evidence: present ? [{ document_id: null, source_label: e.source, locator: e.locator }] : [],
      draft_section_id: `sec-${e.order}`,
    }
  })
  const pending = total - presentCount
  return {
    jurisdiction: jur,
    summary: {
      total, required_total: total,
      present: presentCount, partial: 0, missing: 0, conditional: 0,
      pending, failed: 0,
      need_attention: 0,
      draft_ready: pending === 0,
      draft_blocker: pending === 0 ? null : "assessment in progress",
      present_ratio: presentCount / total,
      draft_min_present_ratio: 0.8,
    },
    requirements,
    skipped_documents: [],
  }
}

// ── Draft ─────────────────────────────────────────────────────────────────────
function sections(jur: string, done: boolean): DraftSection[] {
  const p = profileFor(jur)
  return elementsFor(jur).map(e => ({
    id: `sec-${e.order}`,
    requirement_key: `req-${e.order}`,
    element_order: e.order,
    element_name: e.name,
    status: done ? "drafted" : "pending",
    // Prefix the element heading so DraftDocument's leading-heading strip leaves the body intact.
    content: done ? `## ${e.order}. ${e.name}\n\n${body(e.topic, p)}` : null,
    tables: done ? tables(e.topic, e.order, p) : [],
    charts: [] as DocChart[],
    error: null,
    citations: [],
  }))
}

function draftFor(jur: string, done: boolean): DraftResponse {
  const secs = sections(jur, done)
  return {
    jurisdiction: jur,
    draft_mode: "real",
    summary: { total: secs.length, drafted: done ? secs.length : 0, pending: done ? 0 : secs.length, failed: 0 },
    sections: secs,
  }
}

// ── Risks ─────────────────────────────────────────────────────────────────────
function baseFindings(p: Profile): RiskFinding[] {
  return [
    {
      id: "f1", kind: "exposure", severity: "high",
      title: "Intercompany fund transfers lack loan documentation",
      description: `${p.currency} 5.2m of related-party fund transfers were made interest-free with no loan agreements, repayment schedules, or terms. A tax authority may recharacterise these as financing and impute interest.`,
      exposure_label: "Imputed-interest / recharacterisation", exposure_estimated: true, exposure_amount: null, exposure_currency: null, confidence: "medium",
      evidence: [
        { kind: "section", reference: "Controlled Transactions", detail: "Fund transfers were short-term, interest-free and reciprocal, with no loan agreements or maturity dates.", source_label: "Local File draft", verified: true, document_id: null },
        { kind: "figure", reference: "Transaction One total", detail: "TOTAL 5,235,268.87", source_label: "VOS Trial Balance FY2024.xlsx", verified: true, document_id: DOC_TB },
      ],
      recommendations: ["Execute intercompany loan or cash-pooling agreements with defined terms.", "Document the liquidity-management rationale and reciprocal nature contemporaneously."],
    },
    {
      id: "f2", kind: "discrepancy", severity: "high",
      title: "No signed intercompany agreements on file",
      description: "The file states there are no signed transfer pricing agreements for the controlled transactions, yet material dealings occurred. This is a documentation gap the arm's-length analysis relies on.",
      exposure_label: "Documentation gap", exposure_estimated: true, exposure_amount: null, exposure_currency: null, confidence: "high",
      evidence: [
        { kind: "section", reference: "Intercompany Agreements", detail: "The entity has not executed formal intragroup agreements for the controlled transactions.", source_label: "Local File draft", verified: true, document_id: null },
      ],
      recommendations: ["Put executed agreements in place for the recurring controlled transactions.", "Where none exist, deduce and document the terms from the parties' conduct."],
    },
    {
      id: "f3", kind: "exposure", severity: "medium",
      title: "Thin benchmarking set with negative-margin comparables",
      description: "The comparable set has only 4-5 observations and includes negative operating margins (1st quartile -0.5%, minimum -0.9%). A small, loss-making set weakens the reliability of the arm's-length range.",
      exposure_label: "Benchmark reliability", exposure_estimated: true, exposure_amount: null, exposure_currency: null, confidence: "medium",
      evidence: [
        { kind: "figure", reference: "Benchmarking", detail: "Number of observations: 5, 5, 4, 5; minimum 3-year average -0.9%.", source_label: "Benchmarking appendix", verified: true, document_id: null },
      ],
      recommendations: ["Broaden the search strategy and refresh the comparable set.", "Document rejection criteria and consider excluding persistent loss-makers."],
    },
    {
      id: "f4", kind: "exposure", severity: "low",
      title: "Tested margin sits below the benchmark median",
      description: "The tested operating margin of 3.25% is within the interquartile range (-0.5% to 11.7%) but well below the 7.3% median, leaving limited headroom on any downward adjustment.",
      exposure_label: "3.25% vs 7.3% median", exposure_estimated: true, exposure_amount: null, exposure_currency: null, confidence: "low",
      evidence: [
        { kind: "section", reference: "Benchmarking", detail: "The tested operating margin of 3.25% falls inside the interquartile range.", source_label: "Local File draft", verified: true, document_id: null },
      ],
      recommendations: ["Monitor the margin against the range annually.", "Retain the year-on-year comparison to explain any drift."],
    },
  ]
}

function risksFor(jur: string, done: boolean): RiskResponse {
  const p = profileFor(jur)
  if (!done) {
    return { jurisdiction: jur, status: "analyzing", error: null, analysis_mode: "real", stale: false, summary: { total: 0, by_severity: {}, by_kind: {} }, findings: [] }
  }
  const findings = [...baseFindings(p), p.extraRisk]
  const by_severity: Record<string, number> = {}
  const by_kind: Record<string, number> = {}
  for (const f of findings) {
    by_severity[f.severity] = (by_severity[f.severity] ?? 0) + 1
    by_kind[f.kind] = (by_kind[f.kind] ?? 0) + 1
  }
  return { jurisdiction: jur, status: "done", error: null, analysis_mode: "real", stale: false, summary: { total: findings.length, by_severity, by_kind }, findings }
}

// Canned source text so the Risks "Open" source preview resolves a snippet.
const TRIAL_BALANCE_TEXT = `Veritax Outsourcing & Services — Trial Balance FY2024 (extract)

Transaction One — Fund Transfers
Veritax Support Services        152,000
Veritax Group Holding         3,915,537
Veritax Integrated Services      11,770
Sheikh Nasser Al-Kuwari       2,457,204
Doha Marine Trading          (1,385,492)
On Point Support Services        73,000
Veritax Hospitality              11,250
TOTAL 5,235,268.87

These balances were interest-free and cleared through reimbursements and intercompany netting during the year.`

const RECOVERY: PipelineRecoveryResponse = {
  retried_failed: false, documents_restarted: 0,
  coverage_jurisdictions_restarted: [], draft_jurisdictions_restarted: [], risk_jurisdictions_restarted: [],
}

const JURISDICTIONS = [
  "Australia", "Canada", "France", "Germany", "India", "Ireland", "Italy", "Japan",
  "Netherlands", "Qatar", "Singapore", "South Africa", "Spain", "Switzerland",
  "United Arab Emirates", "United Kingdom", "United States",
]

const rid = () => `demo-${Math.random().toString(36).slice(2, 10)}`

// Methods mirror lib/api.ts. Only the ones the app actually calls need to exist; anything missing
// falls through to the real (network) implementation via the Proxy.
export const demoApi = {
  health: async (): Promise<HealthResponse> => ({ ok: true, db: true, source: "ready" }),

  listEngagements: async (): Promise<EngagementSummary[]> => [SUMMARY],
  getEngagement: async (): Promise<Engagement> => engagement(),
  createEngagement: async (): Promise<{ id: string }> => ({ id: rid() }),
  patchEngagement: async (): Promise<unknown> => ({}),
  recoverPipeline: async (): Promise<PipelineRecoveryResponse> => RECOVERY,

  getConnectors: async (): Promise<Connector[]> => [],
  getJurisdictions: async (): Promise<string[]> => JURISDICTIONS,

  uploadDocuments: async (_id: string, _kind: string, files: File[]): Promise<DocumentRead[]> =>
    files.map((f, i) => ({
      id: `${rid()}-${i}`, original_filename: f.name, content_type: f.type || "application/octet-stream",
      size_bytes: 842_000, content_hash: rid(), status: "embedded", extraction_status: "extracted", error: null,
      created_at: new Date().toISOString(),
    })),
  getDocument: async (documentId: string): Promise<DocumentRead> => docRead(documentId),
  deleteDocument: async (): Promise<void> => {},
  createSource: async (): Promise<{ id: string }> => ({ id: rid() }),

  startCoverage: async (_id: string, jurisdiction: string): Promise<CoverageResponse> => {
    resetPoll(`cov:${jurisdiction}`)
    return coverage(jurisdiction, 0)
  },
  getCoverage: async (_id: string, jurisdiction: string): Promise<CoverageResponse> => {
    const n = tick(`cov:${jurisdiction}`)
    const total = elementsFor(jurisdiction).length
    return coverage(jurisdiction, Math.min(total, n * REVEAL_PER_POLL))
  },
  supplementCoverage: async (coverageId: string, _body: unknown): Promise<CoverageRow> =>
    coverage(JURISDICTIONS_COVERED[0], elementsFor(JURISDICTIONS_COVERED[0]).length).requirements.find(r => r.id === coverageId)
      ?? coverage(JURISDICTIONS_COVERED[0], 1).requirements[0],
  markCoverageSatisfied: async (coverageId: string): Promise<CoverageRow> =>
    coverage(JURISDICTIONS_COVERED[0], elementsFor(JURISDICTIONS_COVERED[0]).length).requirements.find(r => r.id === coverageId)
      ?? coverage(JURISDICTIONS_COVERED[0], 1).requirements[0],

  // A short generating beat, then the finished draft — no long type-out, so the walkthrough never waits.
  startDraft: async (_id: string, jurisdiction: string): Promise<DraftResponse> => {
    await sleep(DRAFT_MS)
    return draftFor(jurisdiction, true)
  },
  getDraft: async (_id: string, jurisdiction: string): Promise<DraftResponse> => draftFor(jurisdiction, true),
  regenerateSection: async (sectionId: string): Promise<DraftSection> => {
    for (const jur of JURISDICTIONS_COVERED) {
      const found = sections(jur, true).find(s => s.id === sectionId)
      if (found) return found
    }
    return sections(JURISDICTIONS_COVERED[0], true)[0]
  },
  updateDraftSection: async (sectionId: string, updateBody: { content: string }): Promise<DraftSection> => {
    for (const jur of JURISDICTIONS_COVERED) {
      const found = sections(jur, true).find(s => s.id === sectionId)
      if (found) return { ...found, content: updateBody.content }
    }
    return { ...sections(JURISDICTIONS_COVERED[0], true)[0], content: updateBody.content }
  },
  downloadDraftDocx: async (_id: string, jurisdiction: string): Promise<Blob> => {
    const text = sections(jurisdiction, true).map(s => `${s.element_order}. ${s.element_name}\n\n${s.content}`).join("\n\n")
    return new Blob([text], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
  },

  startRisks: async (_id: string, jurisdiction: string): Promise<RiskResponse> => {
    resetPoll(`risk:${jurisdiction}`)
    return risksFor(jurisdiction, false)
  },
  getRisks: async (_id: string, jurisdiction: string): Promise<RiskResponse> => {
    const n = tick(`risk:${jurisdiction}`)
    return risksFor(jurisdiction, n >= RISK_POLLS)
  },

  getDocumentText: async (documentId: string): Promise<DocumentTextRead> => ({
    id: documentId,
    original_filename: DOC_META[documentId]?.name ?? "Source",
    status: "embedded",
    text: TRIAL_BALANCE_TEXT,
  }),
  getDocumentFacts: async (documentId: string): Promise<DocumentFactsResponse> => ({ document_id: documentId, facts: [] }),
}
