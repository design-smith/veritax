export const demoRecord = {
  name: "HelioDyne Group Intercompany Record",
  fiscalYears: ["FY2026", "FY2025", "FY2024"],
  roles: ["VP Tax", "Tax Manager", "Analyst"],
  navigation: [
    { label: "Briefing", href: "/briefing", badge: "4" },
    { label: "Graph", href: "/graph", badge: null },
    { label: "Findings", href: "/findings", badge: "7" },
    { label: "Library", href: "/library", badge: null },
    { label: "Factory", href: "/factory", badge: null },
    { label: "Runs", href: "/runs", badge: null },
    { label: "Monitor", href: "/monitor", badge: null },
  ],
} as const;

export const demoBriefing = {
  generatedAt: "Tuesday, 8:12 AM",
  materialChanges: "3 material changes",
  digest: [
    {
      id: "digest-germany-margin",
      title: "Germany services margin fell below policy range",
      summary: "Current month actuals put GmbH services at 2.1%, below the 3.0-5.5% range.",
      source: "ERP close package, May ledger",
    },
    {
      id: "digest-apa-range",
      title: "APA range acceptance is ready for sign-off",
      summary: "Benchmarks, reviewer notes, and counterparty acknowledgement are aligned.",
      source: "APA workpaper v4",
    },
    {
      id: "digest-local-file",
      title: "US local file obligation moved to final review",
      summary: "All required evidence is attached except the services appendix refresh.",
      source: "Obligation tracker",
    },
  ],
  decisions: [
    {
      id: "gate-apa-range",
      title: "APA range acceptance",
      description: "Approve the accepted range so Factory can update the services appendix.",
      requestedBy: "Maya Chen",
      due: "Today",
      citationLabel: "APA workpaper v4",
      citationDetail: "Comparable set refreshed on June 30 with reviewer note TP-118.",
    },
    {
      id: "gate-services-appendix",
      title: "Services appendix redline",
      description: "Hold until Germany margin remediation is reflected in the clause language.",
      requestedBy: "Ilya Novak",
      due: "Tomorrow",
      citationLabel: "Draft appendix A",
      citationDetail: "Redline produced from run run-services-042.",
    },
  ],
  obligations: [
    {
      id: "obl-us-local-file",
      name: "US local file",
      owner: "Tax Manager",
      due: "Jul 15",
      status: "Final review",
    },
    {
      id: "obl-de-masterfile",
      name: "Germany master file",
      owner: "Analyst",
      due: "Jul 22",
      status: "Evidence gap",
    },
    {
      id: "obl-uk-cbc",
      name: "UK CbCR notification",
      owner: "VP Tax",
      due: "Aug 02",
      status: "Ready",
    },
  ],
  commitments: [
    {
      id: "commit-services-appendix",
      title: "Update services appendix",
      owner: "Analyst",
      due: "Today",
      source: "Planning meeting",
    },
    {
      id: "commit-board-summary",
      title: "Send board summary draft",
      owner: "VP Tax",
      due: "Friday",
      source: "Saved question",
    },
  ],
  watchItems: [
    {
      id: "watch-germany-margin",
      title: "Germany margin drift",
      detail: "Two consecutive months outside policy range.",
    },
    {
      id: "watch-pillar2",
      title: "Pillar 2 top-up sensitivity",
      detail: "ETR estimate moved from 15.4% to 14.9%.",
    },
  ],
} as const;

export const demoEntities = [
  {
    id: "entity-us-parent",
    name: "HelioDyne US Inc.",
    jurisdiction: "United States",
    jurisdictionCode: "US",
    segment: "Principal",
    risk: "Medium",
    kpi: "Policy margin 4.8%",
  },
  {
    id: "entity-de-gmbh",
    name: "HelioDyne GmbH",
    jurisdiction: "Germany",
    jurisdictionCode: "DE",
    segment: "Distributor",
    risk: "High",
    kpi: "Services margin 2.1%",
  },
  {
    id: "entity-uk-services",
    name: "HelioDyne UK Services Ltd.",
    jurisdiction: "United Kingdom",
    jurisdictionCode: "GB",
    segment: "Service provider",
    risk: "Low",
    kpi: "Markup 5.2%",
  },
] as const;

export const demoFlows = [
  {
    id: "flow-management-services",
    name: "Management services flow",
    fromEntityId: "entity-uk-services",
    toEntityId: "entity-de-gmbh",
    jurisdiction: "Germany",
    segment: "Services",
    risk: "High",
    status: "Open risk",
    amount: "$18.4M",
    kpi: "2.1% actual margin vs 3.0-5.5% policy",
  },
  {
    id: "flow-license-royalty",
    name: "IP license royalty",
    fromEntityId: "entity-us-parent",
    toEntityId: "entity-uk-services",
    jurisdiction: "United Kingdom",
    segment: "License",
    risk: "Medium",
    status: "Ready",
    amount: "$9.8M",
    kpi: "Royalty within accepted APA range",
  },
] as const;

export const demoDocuments = [
  {
    id: "doc-services-agreement",
    title: "Intercompany Services Agreement",
    type: "Agreement",
    custody: "Signed PDF · Legal drive",
    sourceAvailable: true,
    entityIds: ["entity-uk-services", "entity-de-gmbh"],
    flowIds: ["flow-management-services"],
    anchors: [
      {
        id: "clause-7-2",
        label: "Clause 7.2 Services fee",
        page: 12,
        text: "Recipient shall compensate provider at cost plus an arm's-length markup.",
      },
      {
        id: "schedule-b",
        label: "Schedule B service categories",
        page: 18,
        text: "Finance, procurement, and management support services are in scope.",
      },
    ],
  },
  {
    id: "doc-apa-workpaper",
    title: "APA Range Workpaper",
    type: "Workpaper",
    custody: "TP workspace · Version 4",
    sourceAvailable: true,
    entityIds: ["entity-us-parent", "entity-de-gmbh"],
    flowIds: ["flow-management-services", "flow-license-royalty"],
    anchors: [
      {
        id: "range-analysis",
        label: "Accepted range analysis",
        page: 6,
        text: "The refreshed comparable set supports a 3.0-5.5% services return range.",
      },
      {
        id: "review-note-tp-118",
        label: "Reviewer note TP-118",
        page: 9,
        text: "No objection to range acceptance if Germany remediation is reflected.",
      },
    ],
  },
  {
    id: "doc-missing-ledger",
    title: "May ERP Ledger Extract",
    type: "Ledger",
    custody: "ERP connector · Access expired",
    sourceAvailable: false,
    entityIds: ["entity-de-gmbh"],
    flowIds: ["flow-management-services"],
    anchors: [],
  },
] as const;

export const demoFindings = [
  {
    id: "finding-germany-margin",
    title: "Germany margin drift",
    status: "Open",
    severity: "High",
    owner: "Tax Manager",
    entityIds: ["entity-de-gmbh"],
    flowId: "flow-management-services",
    summary: "HelioDyne GmbH services margin fell below the agreed policy range for two months.",
    risk:
      "The current close package suggests routine services are being compensated below the accepted range, which may require a true-up or appendix update.",
    lifecycle: ["Detected", "Evidence linked", "Awaiting triage"],
    remediation: ["Prepare services appendix redline", "Model true-up entry", "Request ERP refresh"],
    assignments: ["Ilya Novak owns remediation", "Maya Chen signs the gate"],
    comments: ["Confirm May ledger once ERP access is restored."],
    evidence: [
      {
        documentId: "doc-services-agreement",
        anchor: "clause-7-2",
        label: "Clause 7.2 requires an arm's-length markup",
      },
      {
        documentId: "doc-apa-workpaper",
        anchor: "range-analysis",
        label: "Accepted services return range",
      },
      {
        documentId: "doc-missing-ledger",
        anchor: "may-margin",
        label: "May actuals source is unavailable",
      },
    ],
  },
  {
    id: "finding-apa-range",
    title: "APA range acceptance",
    status: "Ready",
    severity: "Medium",
    owner: "VP Tax",
    entityIds: ["entity-us-parent", "entity-de-gmbh"],
    flowId: "flow-license-royalty",
    summary: "The refreshed APA range is ready for decision.",
    risk: "Pending acceptance blocks downstream board pack export.",
    lifecycle: ["Benchmarks refreshed", "Reviewer note attached", "Decision requested"],
    remediation: ["Approve gate", "Pin benchmark version"],
    assignments: ["Maya Chen owns sign-off"],
    comments: ["No open reviewer objections."],
    evidence: [
      {
        documentId: "doc-apa-workpaper",
        anchor: "review-note-tp-118",
        label: "Reviewer note clears the range",
      },
    ],
  },
] as const;

export function getDemoFinding(id: string) {
  return demoFindings.find((finding) => finding.id === id);
}

export function getDemoDocument(id: string) {
  return demoDocuments.find((document) => document.id === id);
}

export function getDemoEntity(id: string) {
  return demoEntities.find((entity) => entity.id === id);
}

export function getDemoFlow(id: string) {
  return demoFlows.find((flow) => flow.id === id);
}

export type DemoRole = (typeof demoRecord.roles)[number];
export type DemoFiscalYear = (typeof demoRecord.fiscalYears)[number];
export type DemoFinding = (typeof demoFindings)[number];
export type DemoDocument = (typeof demoDocuments)[number];
export type DemoEntity = (typeof demoEntities)[number];
export type DemoFlow = (typeof demoFlows)[number];
