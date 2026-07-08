"use client";

import { useMemo, useState } from "react";
import { Check, GitBranch, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SettingsTab =
  | "Standing Instructions"
  | "Materiality & thresholds"
  | "Templates & Brand"
  | "My connections"
  | "Delegation"
  | "Notifications";

type InstructionTier = "style" | "run" | "methodology";
type InstructionStatus = "approved" | "pending";
type Cadence = "realtime" | "daily" | "weekly";

interface StandingInstructionRecord {
  id: string;
  text: string;
  tier: InstructionTier;
  jurisdiction: string;
  documentType: string;
  section: string;
  status: InstructionStatus;
  proposedBy: string;
}

interface MaterialityPolicy {
  currency: "USD" | "EUR" | "GBP" | "SGD";
  flowThreshold: string;
  findingEscalationThreshold: string;
}

interface TemplateAssets {
  wordMaster: string;
  pptMaster: string;
  letterheadName: string;
}

interface TerminologyEntry {
  term: string;
  preferred: string;
}

interface PersonalConnection {
  id: "calendar" | "mailbox" | "drive";
  label: string;
  consentLabel: string;
  enabled: boolean;
}

interface DelegatePolicy {
  delegateName: string;
  expiresOn: string;
}

interface NotificationCadence {
  id: "findings" | "runs" | "commitments" | "sources" | "obligations";
  label: string;
  cadence: Cadence;
}

const SETTINGS_TABS: SettingsTab[] = [
  "Standing Instructions",
  "Materiality & thresholds",
  "Templates & Brand",
  "My connections",
  "Delegation",
  "Notifications",
];

const INITIAL_INSTRUCTIONS: StandingInstructionRecord[] = [
  {
    id: "si-global-style",
    text: "Use board-ready headings and short evidence notes in executive summaries.",
    tier: "style",
    jurisdiction: "All jurisdictions",
    documentType: "All documents",
    section: "All sections",
    status: "approved",
    proposedBy: "Tax Manager",
  },
  {
    id: "si-apac-methodology",
    text: "Use TNMM for APAC intragroup services unless the record shows a signed policy exception.",
    tier: "methodology",
    jurisdiction: "Singapore",
    documentType: "Local file",
    section: "Benchmark analysis",
    status: "approved",
    proposedBy: "VP Tax",
  },
  {
    id: "si-run",
    text: "Run a source coverage check after any shared connector backfill.",
    tier: "run",
    jurisdiction: "All jurisdictions",
    documentType: "All documents",
    section: "Source coverage",
    status: "approved",
    proposedBy: "Record Ops",
  },
];

const TIER_LABELS: Record<InstructionTier, string> = {
  style: "Style-tier",
  run: "Run-tier",
  methodology: "Methodology-tier",
};

const TIER_BADGES: Record<InstructionTier, "secondary" | "info" | "warning"> = {
  style: "secondary",
  run: "info",
  methodology: "warning",
};

function createInstructionId() {
  return `si-${Date.now().toString(36)}`;
}

function formatAmount(rawValue: string) {
  const numericValue = Number(rawValue.replace(/,/g, ""));
  if (!Number.isFinite(numericValue)) return rawValue;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numericValue);
}

export function SettingsPageContent() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("Standing Instructions");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Workspace controls</p>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Settings</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Manage the instructions, thresholds, assets, connections, delegates, and digest cadence that govern the record.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/35",
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Standing Instructions" ? <StandingInstructionsManager /> : null}
      {activeTab === "Materiality & thresholds" ? <MaterialityThresholdsPanel /> : null}
      {activeTab === "Templates & Brand" ? <TemplatesBrandPanel /> : null}
      {activeTab === "My connections" ? <MyConnectionsPanel /> : null}
      {activeTab === "Delegation" ? <DelegationPanel /> : null}
      {activeTab === "Notifications" ? <NotificationsPanel /> : null}
      {activeTab !== "Standing Instructions" &&
      activeTab !== "Materiality & thresholds" &&
      activeTab !== "Templates & Brand" &&
      activeTab !== "My connections" &&
      activeTab !== "Delegation" &&
      activeTab !== "Notifications" ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-base font-semibold text-foreground">{activeTab}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This tab is part of the Settings workspace and will use the same governed save pattern.
          </p>
        </section>
      ) : null}
    </main>
  );
}

function NotificationsPanel() {
  const [draftCadence, setDraftCadence] = useState<NotificationCadence[]>([
    { id: "findings", label: "Findings", cadence: "realtime" },
    { id: "runs", label: "Runs", cadence: "daily" },
    { id: "commitments", label: "Commitments", cadence: "daily" },
    { id: "sources", label: "Sources", cadence: "weekly" },
    { id: "obligations", label: "Obligations", cadence: "weekly" },
  ]);
  const [savedCadence, setSavedCadence] = useState(draftCadence);

  function updateCadence(id: NotificationCadence["id"], cadence: Cadence) {
    setDraftCadence((current) =>
      current.map((item) => (item.id === id ? { ...item, cadence } : item))
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose digest cadence by category. Gate requests are always realtime.
        </p>

        <div className="mt-5 grid gap-3">
          {draftCadence.map((item) => (
            <label
              key={item.id}
              className="grid gap-1.5 rounded-lg border border-border bg-card p-3 text-sm font-medium text-foreground sm:grid-cols-[1fr_180px] sm:items-center"
            >
              <span>{item.label} cadence</span>
              <select
                aria-label={`${item.label} cadence`}
                value={item.cadence}
                onChange={(event) => updateCadence(item.id, event.target.value as Cadence)}
                className="h-8 rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                <option value="realtime">realtime</option>
                <option value="daily">daily</option>
                <option value="weekly">weekly</option>
              </select>
            </label>
          ))}
        </div>

        <Button className="mt-4" onClick={() => setSavedCadence(draftCadence)}>
          Save notification cadence
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Digest routing</h3>
        <ul className="mt-3 grid gap-2">
          {savedCadence.map((item) => (
            <li key={item.id} className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground">
              {item.label} digest: {item.cadence}
            </li>
          ))}
          <li className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground">
            Gate requests stay realtime
          </li>
        </ul>
      </div>
    </section>
  );
}

function DelegationPanel() {
  const [draft, setDraft] = useState<DelegatePolicy>({
    delegateName: "Priya Iyer",
    expiresOn: "2026-06-30",
  });
  const [saved, setSaved] = useState<DelegatePolicy>(draft);

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">Delegation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Time-box gate approval routing when you are away from active review.
        </p>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Gate delegate
            <select
              aria-label="Gate delegate"
              value={draft.delegateName}
              onChange={(event) => setDraft((current) => ({ ...current, delegateName: event.target.value }))}
              className="h-8 rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
            >
              <option>Priya Iyer</option>
              <option>Marcus Webb</option>
              <option>Iris Choi</option>
              <option>Daniel Hart</option>
            </select>
          </label>

          <div className="grid gap-1.5">
            <Label htmlFor="delegation-expires">Delegation expires on</Label>
            <Input
              id="delegation-expires"
              aria-label="Delegation expires on"
              type="date"
              value={draft.expiresOn}
              onChange={(event) => setDraft((current) => ({ ...current, expiresOn: event.target.value }))}
            />
          </div>

          <Button onClick={() => setSaved(draft)}>Save delegation</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <Badge variant="info">Gate delegate</Badge>
        <div className="mt-4 rounded-md border border-border bg-surface px-3 py-2">
          <p className="text-sm font-semibold text-foreground">Active delegate: {saved.delegateName}</p>
          <p className="mt-1 text-sm text-muted-foreground">Ends {saved.expiresOn}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Gate requests route to this delegate until the time box ends.
          </p>
        </div>
      </div>
    </section>
  );
}

function MyConnectionsPanel() {
  const [draftConnections, setDraftConnections] = useState<PersonalConnection[]>([
    {
      id: "calendar",
      label: "Calendar meeting intake",
      consentLabel: "Calendar meeting intake consent",
      enabled: false,
    },
    {
      id: "mailbox",
      label: "Mailbox OAuth",
      consentLabel: "Mailbox OAuth consent",
      enabled: false,
    },
    {
      id: "drive",
      label: "Personal Drive evidence",
      consentLabel: "Personal Drive evidence consent",
      enabled: true,
    },
  ]);
  const [savedConnections, setSavedConnections] = useState(draftConnections);

  function toggleConnection(id: PersonalConnection["id"]) {
    setDraftConnections((current) =>
      current.map((connection) =>
        connection.id === id ? { ...connection, enabled: !connection.enabled } : connection
      )
    );
  }

  function saveConsent() {
    setSavedConnections(draftConnections);
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">My connections</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review personal sources and decide which consent states should feed the record.
        </p>
        <p className="mt-4 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
          IT permits label-scoped read-only intake
        </p>

        <div className="mt-5 grid gap-3">
          {draftConnections.map((connection) => (
            <label
              key={connection.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm"
            >
              <input
                type="checkbox"
                aria-label={connection.consentLabel}
                checked={connection.enabled}
                onChange={() => toggleConnection(connection.id)}
                className="mt-1 size-4 rounded border-input accent-primary"
              />
              <span>
                <span className="block font-medium text-foreground">{connection.label}</span>
                <span className="text-muted-foreground">
                  {connection.enabled ? "Consent will remain enabled" : "Consent is paused for this source"}
                </span>
              </span>
            </label>
          ))}
        </div>

        <Button className="mt-4" onClick={saveConsent}>
          Save connection consent
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Consent states</h3>
        <ul className="mt-3 grid gap-2">
          {savedConnections.map((connection) => (
            <li key={connection.id} className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground">
              {connection.label}: consent {connection.enabled ? "enabled" : "paused"}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TemplatesBrandPanel() {
  const [assets, setAssets] = useState<TemplateAssets>({
    wordMaster: "No Word master attached",
    pptMaster: "No PPT master attached",
    letterheadName: "",
  });
  const [term, setTerm] = useState("");
  const [preferred, setPreferred] = useState("");
  const [terminology, setTerminology] = useState<TerminologyEntry[]>([
    { term: "transfer pricing report", preferred: "TP report" },
  ]);
  const [previewRendered, setPreviewRendered] = useState(false);

  function updateAssetFromFile(field: keyof Pick<TemplateAssets, "wordMaster" | "pptMaster">, files: FileList | null) {
    const selectedFile = files?.item(0);
    if (!selectedFile) return;
    setAssets((current) => ({ ...current, [field]: selectedFile.name }));
    setPreviewRendered(false);
  }

  function addTerminology() {
    const cleanTerm = term.trim();
    const cleanPreferred = preferred.trim();
    if (!cleanTerm || !cleanPreferred) return;
    setTerminology((current) => [...current, { term: cleanTerm, preferred: cleanPreferred }]);
    setTerm("");
    setPreferred("");
    setPreviewRendered(false);
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">Templates & Brand</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Maintain masters, letterhead, and approved terminology before documents render from the record.
        </p>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="word-master">Word master</Label>
            <Input
              id="word-master"
              aria-label="Word master"
              type="file"
              accept=".doc,.docx"
              onChange={(event) => updateAssetFromFile("wordMaster", event.target.files)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ppt-master">PPT master</Label>
            <Input
              id="ppt-master"
              aria-label="PPT master"
              type="file"
              accept=".ppt,.pptx"
              onChange={(event) => updateAssetFromFile("pptMaster", event.target.files)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="letterhead-name">Letterhead name</Label>
            <Input
              id="letterhead-name"
              aria-label="Letterhead name"
              value={assets.letterheadName}
              onChange={(event) => {
                setAssets((current) => ({ ...current, letterheadName: event.target.value }));
                setPreviewRendered(false);
              }}
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <h3 className="text-sm font-semibold text-foreground">Terminology table</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <div className="grid gap-1.5">
                <Label htmlFor="approved-term">Approved term</Label>
                <Input
                  id="approved-term"
                  aria-label="Approved term"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="preferred-wording">Preferred wording</Label>
                <Input
                  id="preferred-wording"
                  aria-label="Preferred wording"
                  value={preferred}
                  onChange={(event) => setPreferred(event.target.value)}
                />
              </div>
              <Button type="button" className="self-end" variant="outline" onClick={addTerminology}>
                Add terminology
              </Button>
            </div>
          </div>

          <Button onClick={() => setPreviewRendered(true)}>Render preview</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Badge variant={previewRendered ? "success" : "secondary"}>
            {previewRendered ? "Preview render ready" : "Preview not rendered"}
          </Badge>
        </div>
        <dl className="mt-4 grid gap-3">
          <AssetSummary label="Word master" value={assets.wordMaster} />
          <AssetSummary label="PPT master" value={assets.pptMaster} />
          <AssetSummary
            label="Letterhead"
            value={assets.letterheadName || "No letterhead selected"}
          />
        </dl>
        <div className="mt-4 rounded-md border border-border bg-surface p-3">
          <h3 className="text-sm font-semibold text-foreground">Approved terminology</h3>
          <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
            {terminology.map((entry) => (
              <li key={`${entry.term}-${entry.preferred}`}>{entry.term} -&gt; {entry.preferred}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function AssetSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function MaterialityThresholdsPanel() {
  const [draft, setDraft] = useState<MaterialityPolicy>({
    currency: "EUR",
    flowThreshold: "250000",
    findingEscalationThreshold: "50000",
  });
  const [saved, setSaved] = useState<MaterialityPolicy>(draft);

  function saveThresholds() {
    setSaved(draft);
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-foreground">Materiality & thresholds</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set the workspace thresholds that drive graph filtering, finding escalation, and review focus.
        </p>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Default currency
            <select
              aria-label="Default currency"
              value={draft.currency}
              onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value as MaterialityPolicy["currency"] }))}
              className="h-8 rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
            >
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="SGD">SGD</option>
              <option value="USD">USD</option>
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="flow-threshold">Flow materiality threshold</Label>
              <Input
                id="flow-threshold"
                aria-label="Flow materiality threshold"
                inputMode="numeric"
                value={draft.flowThreshold}
                onChange={(event) => setDraft((current) => ({ ...current, flowThreshold: event.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="finding-threshold">Finding escalation threshold</Label>
              <Input
                id="finding-threshold"
                aria-label="Finding escalation threshold"
                inputMode="numeric"
                value={draft.findingEscalationThreshold}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, findingEscalationThreshold: event.target.value }))
                }
              />
            </div>
          </div>

          <Button onClick={saveThresholds}>Save thresholds</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Badge variant="success">Saved materiality policy</Badge>
        </div>
        <dl className="mt-4 grid gap-3">
          <div className="rounded-md border border-border bg-surface px-3 py-2">
            <dt className="text-xs font-medium text-muted-foreground">Graph and flow review</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {saved.currency} {formatAmount(saved.flowThreshold)} flow threshold
            </dd>
          </div>
          <div className="rounded-md border border-border bg-surface px-3 py-2">
            <dt className="text-xs font-medium text-muted-foreground">Finding escalation</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">
              {saved.currency} {formatAmount(saved.findingEscalationThreshold)} finding escalation
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function StandingInstructionsManager() {
  const [instructions, setInstructions] = useState(INITIAL_INSTRUCTIONS);
  const [tier, setTier] = useState<InstructionTier>("style");
  const [jurisdiction, setJurisdiction] = useState("All jurisdictions");
  const [documentType, setDocumentType] = useState("All documents");
  const [section, setSection] = useState("All sections");
  const [text, setText] = useState("");

  const scopedConflict = useMemo(
    () =>
      instructions.find(
        (instruction) =>
          instruction.status === "approved" &&
          instruction.jurisdiction === jurisdiction &&
          instruction.documentType === documentType &&
          instruction.section === section
      ),
    [documentType, instructions, jurisdiction, section]
  );

  function proposeInstruction() {
    const normalizedText = text.trim();
    if (!normalizedText) return;

    setInstructions((current) => [
      {
        id: createInstructionId(),
        text: normalizedText,
        tier,
        jurisdiction,
        documentType,
        section,
        status: tier === "methodology" ? "pending" : "approved",
        proposedBy: "You",
      },
      ...current,
    ]);
    setText("");
  }

  function approveInstruction(id: string) {
    setInstructions((current) =>
      current.map((instruction) =>
        instruction.id === id ? { ...instruction, status: "approved" } : instruction
      )
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)]">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Standing Instructions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add scoped instructions with live tier classification and manager approval where methodology changes the record.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Instruction tier
              <select
                aria-label="Instruction tier"
                value={tier}
                onChange={(event) => setTier(event.target.value as InstructionTier)}
                className="h-8 rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                <option value="style">Style</option>
                <option value="run">Run</option>
                <option value="methodology">Methodology</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Jurisdiction
              <select
                aria-label="Jurisdiction"
                value={jurisdiction}
                onChange={(event) => setJurisdiction(event.target.value)}
                className="h-8 rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                <option>All jurisdictions</option>
                <option>Singapore</option>
                <option>United Kingdom</option>
                <option>United States</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Document type
              <select
                aria-label="Document type"
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                className="h-8 rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                <option>All documents</option>
                <option>Local file</option>
                <option>Master file</option>
                <option>Board pack</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              Section
              <select
                aria-label="Section"
                value={section}
                onChange={(event) => setSection(event.target.value)}
                className="h-8 rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
              >
                <option>All sections</option>
                <option>Benchmark analysis</option>
                <option>Source coverage</option>
                <option>Executive summary</option>
              </select>
            </label>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="instruction-text">Instruction text</Label>
            <Textarea
              id="instruction-text"
              aria-label="Instruction text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write the instruction exactly as reviewers should apply it."
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">Conflict inspector</h3>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {scopedConflict
                ? "More specific methodology instruction takes precedence over broader standing instructions for this scope."
                : "No same-scope instruction is active. Broader instructions still apply when this scope is silent."}
            </p>
            {scopedConflict ? (
              <p className="mt-2 rounded-md bg-secondary px-3 py-2 text-xs text-secondary-foreground">
                Current approved instruction: {scopedConflict.text}
              </p>
            ) : null}
          </div>

          <Button onClick={proposeInstruction}>Propose instruction</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Scoped instruction list</h3>
          <p className="text-xs text-muted-foreground">Precedence runs from most specific scope to workspace default.</p>
        </div>
        <div className="divide-y divide-border">
          {instructions.map((instruction) => (
            <article
              key={instruction.id}
              aria-label={instruction.text}
              className="grid gap-3 bg-card px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium text-foreground">{instruction.text}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={TIER_BADGES[instruction.tier]}>{TIER_LABELS[instruction.tier]}</Badge>
                    <Badge variant={instruction.status === "approved" ? "success" : "warning"}>
                      {instruction.status === "approved" ? "Approved" : "Pending manager approval"}
                    </Badge>
                  </div>
                </div>
                {instruction.status === "pending" ? (
                  <Button size="sm" variant="outline" onClick={() => approveInstruction(instruction.id)}>
                    <Check className="size-3.5" aria-hidden="true" />
                    Approve instruction
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Applies to {instruction.jurisdiction} / {instruction.documentType} / {instruction.section}
              </p>
              <p className="text-xs text-muted-foreground">Proposed by {instruction.proposedBy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
