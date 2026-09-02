// Universe standardizer. Reads the external company-research runs and writes compact, web-servable artifacts
// under public/companies/<slug>/ plus a global search index. The raw ~9GB stays external (never committed).
//
//   node scripts/build-universe.mjs [sourceRoot] [--limit N] [--only slug1,slug2]
//
// Per company: profile.json (compact, all tabs' non-heavy data), financials.json (concept x year pivot),
// footprint.json (GLEIF entities by country), ip.json (patent list), group.json (subsidiaries).
// Global: public/companies/index.json (one row per company — powers search/filter/table client-side).
//
// Enrichment: SIC + former names from SEC submissions (by CIK, cached); NAICS/NACE/sector via crosswalk.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, "..")
const DEFAULT_SRC = "C:/Users/zwzek/OneDrive/Desktop/CurrentProjects/researchagent/open_deep_research/.company_universe_runs"
const OUT = join(REPO, "public", "companies")
const SEC_CACHE = join(REPO, ".cache", "sec")
const UA = "Veritax research build (contact@techtorch.io)"

const args = process.argv.slice(2)
let SRC = DEFAULT_SRC, LIMIT = Infinity, ONLY = null
for (let k = 0; k < args.length; k++) {
  const a = args[k]
  if (a === "--limit") LIMIT = Number(args[++k])
  else if (a === "--only") ONLY = new Set(args[++k].split(","))
  else if (!a.startsWith("--")) SRC = a
}

// ---------- helpers ----------
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const localName = concept => String(concept || "").split(":").pop() || ""

// ---------- SIC -> NAICS/NACE/sector crosswalk (approximate; SEC SIC is authoritative) ----------
// Division fallback by SIC numeric range, with major-group (2-digit) overrides for common cases.
function classify(sic, sicDescription) {
  const mg = String(sic || "").padStart(4, "0").slice(0, 2)
  const code = parseInt(mg, 10)   // division ranges key off the 2-digit major group, not the full SIC
  const OVER = {
    "20": ["Manufacturing", "311", "Food Manufacturing", "C10", "Food products"],
    "28": ["Manufacturing", "325", "Chemical Manufacturing", "C20", "Chemicals & pharmaceuticals"],
    "29": ["Manufacturing", "324", "Petroleum & Coal Products", "C19", "Coke & refined petroleum"],
    "33": ["Manufacturing", "331", "Primary Metal Manufacturing", "C24", "Basic metals"],
    "35": ["Manufacturing", "333", "Machinery Manufacturing", "C28", "Machinery & equipment"],
    "36": ["Manufacturing", "334", "Computer & Electronic Product Mfg", "C26", "Computer, electronic & optical"],
    "37": ["Manufacturing", "336", "Transportation Equipment Mfg", "C29", "Motor vehicles & transport equip"],
    "38": ["Manufacturing", "334", "Instruments & Medical Devices", "C26", "Instruments & medical devices"],
    "48": ["Communications", "517", "Telecommunications", "J61", "Telecommunications"],
    "49": ["Utilities", "221", "Utilities", "D35", "Electricity, gas & utilities"],
    "60": ["Finance & Insurance", "522", "Credit Intermediation (Banks)", "K64", "Financial services (banks)"],
    "61": ["Finance & Insurance", "522", "Nondepository Credit", "K64", "Financial services (credit)"],
    "62": ["Finance & Insurance", "523", "Securities & Brokerage", "K66", "Auxiliary financial services"],
    "63": ["Finance & Insurance", "524", "Insurance Carriers", "K65", "Insurance & pension funding"],
    "64": ["Finance & Insurance", "524", "Insurance Agents & Brokers", "K65", "Insurance auxiliary"],
    "67": ["Finance & Insurance", "525", "Funds, Trusts & Holdings", "K64", "Holding & investment"],
    "73": ["Services", "541", "Professional & Technical Services", "J62", "Computer programming & IT"],
    "80": ["Health Care", "621", "Health Care Services", "Q86", "Human health activities"],
    "87": ["Services", "541", "Professional, Scientific & Technical", "M71", "Architecture & engineering"],
  }
  if (OVER[mg]) { const [sector, naics, nl, nace, nacel] = OVER[mg]; return { sector, naics, naics_label: nl, nace, nace_label: nacel, approximate: true } }
  let d
  if (code >= 1 && code <= 9) d = ["Agriculture, Forestry & Fishing", "11", "Agriculture", "A", "Agriculture, forestry & fishing"]
  else if (code <= 14) d = ["Mining", "21", "Mining & Extraction", "B", "Mining & quarrying"]
  else if (code <= 17) d = ["Construction", "23", "Construction", "F", "Construction"]
  else if (code <= 39) d = ["Manufacturing", "31-33", "Manufacturing", "C", "Manufacturing"]
  else if (code <= 49) d = ["Transportation & Utilities", "48-49", "Transportation & Warehousing", "H", "Transportation & storage"]
  else if (code <= 51) d = ["Wholesale Trade", "42", "Wholesale Trade", "G", "Wholesale trade"]
  else if (code <= 59) d = ["Retail Trade", "44-45", "Retail Trade", "G", "Retail trade"]
  else if (code <= 67) d = ["Finance & Insurance", "52", "Finance & Insurance", "K", "Financial & insurance"]
  else if (code <= 89) d = ["Services", "54", "Professional & Business Services", "M", "Professional services"]
  else d = ["Public Administration", "92", "Public Administration", "O", "Public administration"]
  const [sector, naics, nl, nace, nacel] = d
  return { sector, naics, naics_label: nl, nace, nace_label: nacel, approximate: true }
}

// ---------- activity tags (evidence-backed, from business_description + segment text) ----------
const ACTIVITY_RULES = [
  ["Manufacturing", /manufactur|fabricat|production facilit|\bproduces\b|assembl/i],
  ["R&D", /research and development|research & development|\bR&D\b|develops new/i],
  ["Software", /software|operating system|\bcloud\b|\bplatform\b|application|digital services/i],
  ["Distribution", /distribut|logistics|supply chain|warehous|wholesale/i],
  ["Retail", /\bretail\b|\bstores\b|e-commerce|online store|point of sale/i],
  ["Services", /\bservices\b|consulting|advisory|subscription/i],
  ["Financing / Treasury", /financing|treasury|\blending\b|\bcredit\b|\bbanking\b|asset management/i],
  ["Engineering", /engineering|design and develop|designs and manufactures/i],
  ["Sales & Marketing", /sales and marketing|market and sell|advertis|\bbrands?\b/i],
  ["Pharma / Healthcare", /pharmaceutical|\bdrug|therapeut|medical device|diagnostic|healthcare|biolog/i],
  ["Energy / Resources", /oil and gas|petroleum|\bmining\b|\benergy\b|\brefin|natural gas/i],
]
function activityTags(text) {
  if (!text) return []
  const sentences = text.split(/(?<=[.!?])\s+/)
  const out = []
  for (const [tag, re] of ACTIVITY_RULES) {
    const ev = sentences.find(s => re.test(s))
    if (ev) out.push({ tag, evidence: ev.trim().slice(0, 220) })
  }
  return out
}

// ---------- financial statement grouping ----------
function statementOf(concept) {
  const n = localName(concept)
  if (/Revenue|Sales|GrossProfit|OperatingIncome|CostsAndExpenses|CostOf|ResearchAndDevelopment|OperatingExpenses|NetIncome|EarningsPerShare|IncomeTax|ComprehensiveIncome|InterestExpense|Ebit/i.test(n)) return "income"
  if (/Assets|Liabilities|StockholdersEquity|^Equity|CashAndCash|Inventory|Goodwill|PropertyPlant|Receivable|Payable|LongTermDebt|RetainedEarnings|Intangible/i.test(n)) return "balance"
  if (/NetCashProvided|CashCashEquivalents|PaymentsTo|PaymentsFor|ProceedsFrom|DepreciationDeplet|DividendsPaid/i.test(n)) return "cashflow"
  return "other"
}

// ---------- key metrics + revenue series + derived ratios ----------
const REVENUE = ["us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax", "us-gaap:Revenues", "us-gaap:SalesRevenueNet", "ifrs-full:Revenue"]
const METRICS = [
  ["Revenue", REVENUE],
  ["Gross profit", ["us-gaap:GrossProfit", "ifrs-full:GrossProfit"]],
  ["Operating income", ["us-gaap:OperatingIncomeLoss", "ifrs-full:ProfitLossFromOperatingActivities"]],
  ["Net income", ["us-gaap:NetIncomeLoss", "ifrs-full:ProfitLoss"]],
  ["Total assets", ["us-gaap:Assets", "ifrs-full:Assets"]],
  ["Total liabilities", ["us-gaap:Liabilities", "ifrs-full:Liabilities"]],
  ["Equity", ["us-gaap:StockholdersEquity", "ifrs-full:Equity"]],
  ["R&D expense", ["us-gaap:ResearchAndDevelopmentExpense", "ifrs-full:ResearchAndDevelopmentExpense"]],
]

function annualByYear(facts, concepts) {
  const byYear = new Map()
  const set = new Set(concepts)
  for (const f of facts) {
    if (!set.has(f.concept)) continue
    const p = f.period || {}
    if (p.fiscal_period !== "FY" && p.period_type !== "annual") continue
    const y = p.fiscal_year; if (!y) continue
    const prev = byYear.get(y)
    if (!prev || String(p.end_date || "") > String(prev.end || ""))
      byYear.set(y, { fy: y, value: num(f.reported_value), currency: f.currency, unit: f.unit, end: p.end_date || null })
  }
  return byYear
}
function latest(byYear) {
  const ys = [...byYear.keys()].sort((a, b) => b - a)
  return ys.length ? byYear.get(ys[0]) : null
}

// ---------- SEC enrichment (cached) ----------
async function secInfo(cik) {
  if (!cik) return null
  const id = String(cik).replace(/\D/g, "").padStart(10, "0")
  mkdirSync(SEC_CACHE, { recursive: true })
  const cache = join(SEC_CACHE, `${id}.json`)
  if (existsSync(cache)) { try { return JSON.parse(readFileSync(cache, "utf8")) } catch {} }
  try {
    const r = await fetch(`https://data.sec.gov/submissions/CIK${id}.json`, { headers: { "User-Agent": UA } })
    if (!r.ok) return null
    const d = await r.json()
    const out = {
      sic: d.sic || null, sicDescription: d.sicDescription || null,
      formerNames: (d.formerNames || []).map(f => f.name).filter(Boolean),
      website: d.website || null, fileNumber: (d.filings?.recent?.fileNumber || [])[0] || null,
      tickers: d.tickers || [], exchanges: d.exchanges || [],
    }
    writeFileSync(cache, JSON.stringify(out))
    await sleep(130)   // ponytail: sequential + 130ms keeps us under SEC's 10 req/s
    return out
  } catch { return null }
}

// ---------- per-company ----------
async function build(slug) {
  const base = join(SRC, slug, "universe")
  const payloadPath = join(base, "output_payload.json")
  if (!existsSync(payloadPath)) return null
  const d = JSON.parse(readFileSync(payloadPath, "utf8"))
  const id = d.identity || {}
  const facts = d.financial_facts || []
  const nf = d.nonfinancial_facts || []
  const standard = facts.some(f => String(f.concept).startsWith("ifrs")) &&
    !facts.some(f => String(f.concept).startsWith("us-gaap")) ? "IFRS" : "US-GAAP"

  const sec = await secInfo(id.cik)
  const sic = sec?.sic || null
  const sicDescription = sec?.sicDescription || null
  const cls = sic ? classify(sic, sicDescription) : null

  // business
  const businessDescription = nf.find(n => n.category === "business_description")?.source_native_text || null
  const segments = nf.filter(n => n.category === "segment").map(n => n.source_native_text).filter(Boolean)
  const rndFact = nf.find(n => n.category === "r_and_d")
  const tags = activityTags([businessDescription, ...segments, sicDescription].filter(Boolean).join(" "))
  // Fallback so thin-text companies (e.g. banks) still get evidence-backed tags from their SIC classification.
  if (cls) {
    const add = (tag, ev) => { if (!tags.some(t => t.tag === tag)) tags.push({ tag, evidence: ev }) }
    const sd = (sicDescription || "").toLowerCase(), ev = `SIC ${sic}: ${sicDescription}`
    if (cls.sector === "Finance & Insurance") add("Financing / Treasury", ev)
    if (cls.sector === "Manufacturing") add("Manufacturing", ev)
    if (/pharma|biolog|medic|drug|therap/.test(sd)) add("Pharma / Healthcare", ev)
    if (/retail|store/.test(sd)) add("Retail", ev)
    if (/petroleum|\boil\b|\bgas\b|mining|energy/.test(sd)) add("Energy / Resources", ev)
    if (tags.length === 0) add(cls.sector, `Sector: ${cls.sector}`)
  }
  const empHit = nf.find(n => n.category === "employee")
  const employees = empHit ? (empHit.source_native_text.replace(/,/g, "").match(/([\d]{2,})\s+(?:full[- ]time|employees|persons|people)/i) || empHit.source_native_text.replace(/,/g, "").match(/approximately\s+([\d]{2,})/i)) : null

  // financials: metrics + revenue series + pivot + derived
  const metricByYear = {}
  const key_metrics = []
  for (const [label, concepts] of METRICS) {
    const l = latest(annualByYear(facts, concepts))
    if (l) { key_metrics.push({ label, ...l }); metricByYear[label] = l }
  }
  const revByYear = annualByYear(facts, REVENUE)
  const revenue_series = [...revByYear.values()].sort((a, b) => b.fy - a.fy).map(r => ({ fy: r.fy, value: r.value }))
  const currency = key_metrics[0]?.currency || revenue_series[0] && revByYear.get(revenue_series[0].fy)?.currency || null

  const rev = metricByYear["Revenue"]?.value, oi = metricByYear["Operating income"]?.value
  const ni = metricByYear["Net income"]?.value, assets = metricByYear["Total assets"]?.value
  const gp = metricByYear["Gross profit"]?.value, rd = metricByYear["R&D expense"]?.value
  const opCosts = rev != null && oi != null ? rev - oi : null
  const derived = {
    ebit_margin: rev && oi != null ? oi / rev : null,
    net_cost_plus: opCosts ? oi / opCosts : null,
    berry: opCosts && gp != null ? gp / (rev - gp) : null,     // gross profit / operating expenses (rev-gp ~ opex proxy)
    roa: assets && ni != null ? ni / assets : null,
    rd_to_revenue: rev && rd != null ? rd / rev : null,
  }

  // pivot (annual)
  const pivot = new Map()
  for (const f of facts) {
    const p = f.period || {}
    if (p.fiscal_period !== "FY" && p.period_type !== "annual") continue
    const y = p.fiscal_year; if (!y) continue
    let row = pivot.get(f.concept)
    if (!row) { row = { concept: f.concept, label: f.source_native_label, statement: statementOf(f.concept), unit: f.unit, currency: f.currency, values: {} }; pivot.set(f.concept, row) }
    const cur = row.values[y]
    if (cur == null || String(p.end_date || "") >= String(cur.end || "")) row.values[y] = { v: num(f.reported_value), end: p.end_date || null }
  }
  const financials = {
    standard, currency,
    rows: [...pivot.values()].map(r => ({ concept: r.concept, label: r.label, statement: r.statement, unit: r.unit, currency: r.currency,
      values: Object.fromEntries(Object.entries(r.values).map(([y, o]) => [y, o.v])) })),
  }

  // footprint
  const footprint = { countries: [], status_counts: {} }
  const ciPath = join(base, "country_index.json")
  if (existsSync(ciPath)) {
    const ci = JSON.parse(readFileSync(ciPath, "utf8"))
    footprint.status_counts = ci.status_counts || {}
    for (const c of (ci.countries || [])) {
      const entry = { code: c.country_code, name: c.country_name, status: c.status, entities: [] }
      const cf = join(base, c.artifact_path || `countries/${c.country_code}.json`)
      if (existsSync(cf)) {
        try {
          const cd = JSON.parse(readFileSync(cf, "utf8"))
          entry.entities = (cd.legal_entities || []).map(e => ({ name: e.legal_name, lei: e.registration_number, office: e.registered_office, status: e.registration_status, type: e.entity_type }))
        } catch {}
      }
      footprint.countries.push(entry)
    }
  }
  const countriesWithEntities = footprint.countries.filter(c => c.entities.length > 0)
  const n_countries = countriesWithEntities.length
  const footprint_entities = footprint.countries.reduce((s, c) => s + c.entities.length, 0)

  // group (subsidiaries from Exhibit 21), junk-filtered, LEI-matched to footprint
  const leiByName = new Map()
  for (const c of footprint.countries) for (const e of c.entities) if (e.name) leiByName.set(e.name.toUpperCase(), { lei: e.lei, country: c.code })
  const JUNK = /^(domestic|foreign|international|other|subsidiaries|significant subsidiaries|and other|various)\b/i
  const rels = (d.relationships || []).filter(r => r.related_entity_name && !JUNK.test(r.related_entity_name) && r.related_entity_name.length > 2)
  const group = {
    subsidiaries: rels.map(r => {
      const ctx = r.provenance?.primary_source_ref?.context || ""
      const jm = ctx.match(/jurisdiction=([A-Z]{2})/) || (r.related_entity_name.match(/,\s*([A-Z][a-z]+)$/))
      const match = leiByName.get(r.related_entity_name.toUpperCase())
      return { name: r.related_entity_name, jurisdiction: match?.country || (jm ? jm[1] : null), lei: match?.lei || null }
    }),
  }

  // ip (patents)
  const ipAll = d.intellectual_property || []
  const by_jurisdiction = {}
  for (const x of ipAll) by_jurisdiction[x.jurisdiction || "?"] = (by_jurisdiction[x.jurisdiction || "?"] || 0) + 1
  const ip = {
    count: ipAll.length, by_jurisdiction, by_type: ipAll.reduce((m, x) => (m[x.ip_type] = (m[x.ip_type] || 0) + 1, m), {}),
    items: ipAll.slice(0, 3000).map(x => ({
      type: x.ip_type, number: x.application_number || x.registration_number || x.title_or_mark,
      jurisdiction: x.jurisdiction, assignee: x.owning_entity_name,
      uspto: x.application_number ? `https://patentcenter.uspto.gov/applications/${x.application_number}` : null,
    })),
  }

  // sources / coverage / confidence
  const coverage = (d.coverage || []).map(c => ({ area: c.coverage_area, status: c.status }))
  const complete = coverage.filter(c => c.status === "complete").length
  const completeness = coverage.length ? complete / coverage.length : 0
  const gaps = (d.gaps || []).map(g => ({ field: g.field_path, description: g.description, status: g.status }))
  const families = [...new Set([...(d.source_documents || []).map(s => s.source_id), ...(d.research_attempts || []).map(a => a.source_family)])].filter(Boolean)
  const confidence = completeness >= 0.7 && gaps.length <= 3 ? "high" : completeness >= 0.4 ? "medium" : "low"

  const profile = {
    slug, schema: "universe-profile/v1",
    identity: {
      legal_name: id.legal_name, former_names: sec?.formerNames || [], entity_type: id.entity_type, entity_status: id.entity_status,
      jurisdiction: id.jurisdiction, headquarters: id.headquarters || null, website: sec?.website || null,
      cik: id.cik, lei: id.lei, sec_file_number: sec?.fileNumber || null, is_subsidiary: id.is_subsidiary, parent_legal_name: id.parent_legal_name,
      listings: id.listings || [],
    },
    classification: cls ? { sic, sic_description: sicDescription, ...cls } : { sic: null, sic_description: null },
    business: { description: businessDescription, segments, activity_tags: tags,
      rnd: { conducts: !!rndFact || rd != null, description: rndFact?.source_native_text || null, spend: rd },
      employees: employees ? Number(employees[1]) : null, employees_text: empHit?.source_native_text || null },
    key_metrics, revenue_series, financials_currency: currency, derived,
    footprint_summary: { n_countries, n_entities: footprint_entities, status_counts: footprint.status_counts, top_countries: countriesWithEntities.slice(0, 6).map(c => ({ code: c.code, name: c.name, n: c.entities.length })) },
    group_summary: { n_subsidiaries: group.subsidiaries.length },
    ip_summary: { count: ip.count, by_jurisdiction: ip.by_jurisdiction, by_type: ip.by_type },
    sources: { families, coverage, gaps, completeness, confidence },
    facts_count: facts.length, accounting_standard: standard, searched_at: statSync(payloadPath).mtime.toISOString(),
  }

  const dir = join(OUT, slug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "profile.json"), JSON.stringify(profile))
  writeFileSync(join(dir, "financials.json"), JSON.stringify(financials))
  writeFileSync(join(dir, "footprint.json"), JSON.stringify(footprint))
  writeFileSync(join(dir, "ip.json"), JSON.stringify(ip))
  writeFileSync(join(dir, "group.json"), JSON.stringify(group))

  // index row
  return {
    slug, name: id.legal_name || slug, ticker: id.listings?.[0]?.ticker || null, exchange: id.listings?.[0]?.exchange || null,
    hq_country: id.headquarters?.country || null, hq_region: macroRegion(id.headquarters?.country),
    sic, sic_description: sicDescription, naics: cls?.naics || null, nace: cls?.nace || null, sector: cls?.sector || null, industry: sicDescription || null,
    activity_tags: tags.map(t => t.tag),
    op_countries: countriesWithEntities.map(c => c.code),
    keywords: [businessDescription, ...segments].filter(Boolean).join(" ").slice(0, 400),
    revenue_latest: metricByYear["Revenue"]?.value ?? null, net_income_latest: metricByYear["Net income"]?.value ?? null,
    employees: profile.business.employees, n_subsidiaries: group.subsidiaries.length, n_countries, n_patents: ip.count,
    has_rnd: profile.business.rnd.conducts, has_patents: ip.count > 0, has_international: n_countries > 0,
    accounting_standard: standard, status: id.entity_status || null, confidence, currency, searched_at: profile.searched_at,
  }
}

function macroRegion(country) {
  if (!country) return null
  const c = country.toLowerCase()
  if (/united states|canada|mexico|brazil|america|chile|argentina|colombia|peru/.test(c)) return "Americas"
  if (/united kingdom|germany|france|ireland|netherlands|switzerland|spain|italy|denmark|sweden|norway|finland|belgium|europe|luxembourg|austria/.test(c)) return "EMEA"
  if (/china|japan|korea|india|singapore|hong kong|taiwan|australia|asia|thailand|viet|malaysia|indonesia|philippines/.test(c)) return "APAC"
  return "Other"
}

// ---------- main ----------
const slugs = readdirSync(SRC, { withFileTypes: true })
  .filter(e => e.isDirectory() && existsSync(join(SRC, e.name, "universe", "output_payload.json")))
  .map(e => e.name)
  .filter(s => !ONLY || ONLY.has(s))
  .slice(0, LIMIT)

console.log(`building ${slugs.length} companies from ${SRC}`)
mkdirSync(OUT, { recursive: true })
const index = []
let i = 0
for (const slug of slugs) {
  i++
  try {
    const row = await build(slug)
    if (row) { index.push(row); if (i % 25 === 0 || i === slugs.length) console.log(`  [${i}/${slugs.length}] ${slug}  (sic=${row.sic || "-"}, countries=${row.n_countries}, patents=${row.n_patents})`) }
  } catch (e) { console.log(`  ! ${slug}: ${e.message}`) }
}
index.sort((a, b) => (b.revenue_latest || 0) - (a.revenue_latest || 0))
writeFileSync(join(OUT, "index.json"), JSON.stringify(index))
console.log(`index.json: ${index.length} companies`)
