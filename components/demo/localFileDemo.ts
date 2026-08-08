// Prefilled demo content — the Veritax Outsourcing & Services (Qatar) Local File, FY2024.
// Rendered by the public /demo Draft tab (components/demo/DemoDraft.tsx). Static, display-only.

export interface DemoTable {
  title?: string
  columns: string[]
  rows: string[][]
}

export interface DemoSection {
  order: number
  title: string
  body: string // markdown
  tables?: DemoTable[]
}

export const DEMO_COVER = {
  title: "Transfer Pricing Local File",
  entity: "Veritax Outsourcing & Services W.L.L.",
  jurisdiction: "Qatar",
  period: "For the fiscal year ended 31 December 2024",
  prepared: "September 21, 2025",
}

export const DEMO_SECTIONS: DemoSection[] = [
  {
    order: 1,
    title: "Introduction",
    body: `### 1.1 Objectives of the report

This report examines whether the intragroup transactions carried out by Veritax Outsourcing & Services W.L.L. and its related parties during the year ended 31 December 2024 were priced on arm's length terms.

It sets out the Company's activities and how it is organised, then explains the methods used to test the Company's transfer pricing against the arm's length principle. The analysis applies the OECD Transfer Pricing Guidelines and the requirements of the Qatari Tax Regulations.

The document is the Local File for the purposes of the OECD Guidelines and Qatari tax law.

### 1.2 Report Structure

The remainder of the report is organised as follows:

- Section 1: Company Overview
- Section 2: Intragroup transactions`,
  },
  {
    order: 2,
    title: "Company Overview",
    body: `### 2.1 Management structure and organisational chart

Veritax Outsourcing & Services is wholly owned by Veritax Group Holding.

The Company runs as a single management line. Karim Haddad, General Manager of Veritax Outsourcing & Services (VOS), is the authorised signatory with full powers. Sheikh Nasser Al-Kuwari, Chairman of Veritax Group Holding (VGH) and the ultimate beneficial owner, holds the same powers. Mr Haddad reports to the management team of Veritax Group Holding, and the group is managed locally. Both VOS and VGH have their principal office at the 3rd Floor, Al Jazi Tower, Al Sadd Street, Doha, State of Qatar.

VOS had 21 employees as at 31 December 2024.

### 2.2 Company's Activity and Business Strategy

#### Activities

Veritax Outsourcing & Services (VOS) supplies technical manpower and staff augmentation services to government and quasi-government clients in Qatar. Most of its work is with the oil and gas sector, with banking and IT staff placed inside financial institutions, and with general personnel services across government bodies. The Company helps clients plan and fill their workforce needs so they have qualified people in place for day-to-day operations.

#### Strategy

VOS positions itself as a long-term staffing partner to government and quasi-government clients rather than a business chasing short-term gains. It competes on stability, compliance, and lasting client relationships. The business model is deliberately asset-light: people and administrative capacity create the value, not physical assets. The Company keeps clear of unnecessary operational and financial risk and stays with what it knows, which is recruitment, staffing, and personnel support. It does not carry out research and development, build intangible assets, or use complex financing structures.

#### Business reorganisations and intangible asset transfers

VOS was not part of, or affected by, any business restructuring or transfer of intangibles during FY2024 or the preceding year.`,
  },
  {
    order: 3,
    title: "Intragroup Transactions",
    body: `### 3.1 Presentation of intragroup transactions

During the 2024 financial year, the following categories of transaction between Veritax Outsourcing & Services and its related parties exceeded the QAR 200,000 threshold:

- **Transaction One:** Fund Transfers
- **Transaction Two:** Supplier Payments

#### 3.1.1 Transaction One: Fund Transfers

During FY2024, VOS transferred funds to and from related parties to cover short-term cash shortfalls and keep operations running. The transfers met payroll and urgent operating costs of related entities. They carried no interest, ran in both directions, and were meant only to keep the Group's operations steady.

These were not loans and did not behave like financing. No loan agreements were signed, no repayment or maturity dates were set, and no interest or financing margin was charged or accrued. The amounts sat in short-term current account balances in the intercompany ledgers and were cleared regularly through reimbursements or recharges. The purpose was liquidity management, not the extension of intercompany credit.

For transfer pricing purposes, the transfers are tested together with the other intercompany dealings under the Transactional Net Margin Method (TNMM). They are neither financing nor a chargeable service, so no interest or markup was applied.

#### 3.1.2 Transaction Two: Supplier Payments

VOS also settled some supplier invoices on behalf of related parties during FY2024. These payments related to the operating needs of other Group entities and were later reimbursed or netted against intercompany balances. They are not financing, because no lending or credit function was involved, and they are not a service, because VOS added no value that would justify a markup.

For transfer pricing purposes, the payments are assessed under the TNMM alongside the other intercompany dealings. They are straight cost pass-throughs, so no markup or further remuneration was applied.

### 3.2 Intragroup agreements concluded by the company

VOS has not signed any intragroup transfer pricing agreements with its related entities.`,
    tables: [
      {
        title: "Transaction One: Fund Transfers (amounts in QAR)",
        columns: ["Entity", "Amount in QAR"],
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
        title: "Transaction Two: Supplier Payments (amounts in QAR)",
        columns: ["Entity", "Amount in QAR"],
        rows: [
          ["Veritax Group Holding", "321,891"],
          ["Veritax Enterprise", "84,967"],
          ["TOTAL", "406,858"],
        ],
      },
    ],
  },
  {
    order: 4,
    title: "Functions, Assets and Risks (FAR) Analysis",
    body: `This functional analysis sets out the economically significant activities and responsibilities of the parties to the transactions, the assets they use, and the risks they take on. It provides the factual basis for choosing a transfer pricing method that meets the arm's length standard in the OECD Guidelines.

### Functions

VOS mainly provides technical manpower and staff augmentation services. It supplies skilled personnel to major government and quasi-government clients in Qatar, chiefly in oil and gas, banking and IT staff for financial institutions, and general personnel for government bodies. Its role is to support clients' HR and workforce planning.

The Company runs an asset-light model. Its core functions are sourcing, recruiting, contracting, and managing manpower while staying compliant with Qatar's labour and immigration laws. Staff remain sponsored by VOS and are seconded to client organisations under commercial contracts. VOS does not carry out research and development and does not own or exploit intangible assets.

### Risks

- **Market risk:** As at the reporting date, the Company has no significant exposure to interest rate, currency, or other price risk.
- **Operational risk:** Exposure tied to recruitment, workforce management, compliance with Qatar's labour and sponsorship rules, and delivery on client contracts.
- **Credit risk:** Mainly cash and cash equivalents, trade and other receivables, and amounts due from related parties. The Company recognised an ECL on trade receivables of QR 1,875,061 as at 31 December 2024 (2023: QR 2,957,253). Management considers the amounts due from related parties to carry no credit risk.
- **Legal and regulatory risk:** The Company must stay compliant with Qatar's labour laws, immigration rules, and corporate governance obligations.
- **Liquidity risk:** Managed through cash flow planning. Trade payables are usually settled within 30 days. Balances with related parties are interest-free with no fixed repayment terms. Liquidity risk is low.

### Assets Employed

- **Tangible assets:** Limited to leasehold improvements to office premises, computers and software, office equipment, fixtures, and furniture. These support the administrative and operational work but are not value drivers in their own right.
- **Intangible assets:** The Company owns no intangible assets such as intellectual property, trademarks, or proprietary technology. Client relationships are contractual and are not legally owned intangibles.

### Conclusion

VOS is an asset-light manpower outsourcing provider that supplies technical manpower and staff augmentation to Qatar's main industries and government entities. Its value comes from recruiting and managing personnel efficiently while staying fully compliant with local labour rules. It owns no intangible or financial assets.`,
  },
  {
    order: 5,
    title: "Selection of the Transfer Pricing Method",
    body: `### The arm's length principle

The arm's length principle is the international standard that OECD member countries use to set transfer prices for tax purposes. Under it, the terms agreed between two associated enterprises in their commercial or financial dealings should match what independent enterprises would agree for similar transactions in similar circumstances. Where the terms between associated enterprises do not meet this standard, taxable profits may be adjusted.

The principle is applied by comparing the economically relevant features of a controlled transaction with those of transactions between independent parties. That comparison rests on five factors: the characteristics of the property or services transferred; the functions performed by each party, including the assets used and risks assumed; the contractual terms; the economic circumstances; and the business strategies pursued.

### Transfer pricing methods

The OECD Guidelines set out five main transfer pricing methods, split into traditional transaction methods (Comparable Uncontrolled Price, Resale Price, Cost Plus) and transactional profit methods (Profit Split, Transactional Net Margin Method). No single method ranks above the others; the task is to pick the one that fits the case best. For a one-sided method (resale price, cost plus, TNMM), the tested party should be the one the method can be applied to most reliably and for which the best comparables exist. That is usually the party with the least complex functional profile.

### Selection of the method on the tested transactions

In FY2024, VOS entered into a small number of intercompany transactions with related parties, mainly the movement of funds and the settlement of supplier obligations. Both were short-term, operational, interest-free, and reciprocal, and were later cleared through reimbursements or intercompany netting. Neither is intercompany financing, and neither is a value-adding service.

The Transactional Net Margin Method (TNMM) was used to test these transactions together, within the overall results of VOS. TNMM was the most reliable choice, because independent comparables for pass-through cost allocations of this kind are not readily available. The Comparable Uncontrolled Price (CUP) method does not apply, since VOS does not transact with independent third parties. The Resale Minus method does not fit either, since VOS is not a distributor. VOS was selected as the tested party.

Financial data for 2021 to 2023 was reviewed, giving a multi-year view of the results.

From the external comparables, the operating margin runs from a low of -0.9% to a high of 14.3%. The lower quartile is -0.5%, the upper quartile is 11.7%, and the median is 7.3%. VOS reported an operating margin of 3.25% on the tested transactions, which sits inside the interquartile range. The result is therefore consistent with the arm's length principle.`,
    tables: [
      {
        title: "Benchmarking: Net Cost-Plus margins",
        columns: ["Net Cost-Plus", "2023", "2022", "2021", "3-year average"],
        rows: [
          ["Maximum", "14.5%", "14.5%", "13.8%", "14.3%"],
          ["3rd quartile", "12.4%", "13.0%", "12.5%", "11.7%"],
          ["Median", "2.7%", "10.7%", "6.9%", "7.3%"],
          ["1st quartile", "-1.8%", "-0.1%", "1.9%", "-0.5%"],
          ["Minimum", "-3.5%", "-0.3%", "0.8%", "-0.9%"],
          ["Number of observations", "5", "5", "4", "5"],
        ],
      },
    ],
  },
]
