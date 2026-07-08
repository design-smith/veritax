"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, Download, Play, UserPlus } from "lucide-react";
import { CitationChip } from "@/components/patterns/pat-1-citation-chip";
import { ProvenanceChip } from "@/components/patterns/pat-2-provenance";
import {
  PlanConfirmationModal,
  type PlanSpec,
} from "@/components/patterns/pat-4-plan-confirmation";
import { ExportDialog } from "@/components/patterns/pat-10-export";
import { EmptyState } from "@/components/surface-states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { mockUsers } from "@/lib/mock";
import type { Document, Entity, Finding, Flow, User } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

interface RunReference {
  id: string;
  href: string;
}

interface RunPayload {
  instruction: string;
}

interface ExportPayload {
  format: string;
  destination: string;
}

interface EntityPageContentProps {
  entity: Entity;
  relatedFlows: Flow[];
  relatedFindings: Finding[];
  relatedDocuments: Document[];
  defaultTab?: string;
  assignees?: User[];
  onRunScopedScan?: (entityId: string, payload: RunPayload) => RunReference | void;
  onSaveStandingInstruction?: (entityId: string, instruction: string) => void;
  onAssign?: (entityId: string, assigneeId: string) => void;
  onExportProfile?: (entityId: string, payload: ExportPayload) => void;
}

const STATUS_COLORS: Record<Flow["status"], string> = {
  verified: "bg-success-soft text-success-soft-foreground",
  drift: "bg-warning-soft text-warning-soft-foreground",
  exception: "bg-danger-soft text-danger-soft-foreground",
};

const SEVERITY_COLORS: Record<Finding["severity"], string> = {
  critical: "bg-danger-soft text-danger-soft-foreground",
  high: "bg-warning-soft text-warning-soft-foreground",
  medium: "bg-info-soft text-info-soft-foreground",
  low: "bg-secondary text-secondary-foreground",
};

function formatMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function firstDocument(documents: Document[], type?: Document["type"]) {
  return documents.find((document) => (type ? document.type === type : true)) ?? documents[0];
}

function citationFor(document: Document | undefined, section: string, snippet: string) {
  if (!document) return null;

  return (
    <CitationChip
      docName={document.name}
      section={section}
      confidence={0.91}
      extractorVersion="extractor-2024.11"
      snippet={snippet}
      documentId={document.id}
      spanId={`${document.id}-${section.toLowerCase().replace(/\s+/g, "-")}`}
      returnTo="/graph"
    />
  );
}

function buildScopedScanPlan(entity: Entity, relatedFlows: Flow[]): PlanSpec {
  return {
    intent: `Run a scoped scan for ${entity.name} against the current record.`,
    steps: [
      {
        id: "scope",
        description: "Load entity profile, touching flows, filings, and agreements.",
        scope: entity.name,
      },
      {
        id: "rules",
        description: "Apply intercompany, documentation, Pillar 2, and staleness gates.",
      },
      {
        id: "findings",
        description: "Create findings with citations and a ready for review queue.",
      },
    ],
    produces: [
      `${entity.jurisdictionCode} entity scan run`,
      `${relatedFlows.length} flow checks`,
      "findings ready for review",
    ],
    invalidates: ["stale entity summary cards", "prior unresolved scan digest"],
    estimatedDuration: "30s-2min",
    costClass: "standard",
    instruction: `Run scoped scan for ${entity.name}, FY2024, using the current corpus and rulepack.`,
    permissionCheck: "allowed",
    tier: "run",
  };
}

function OverviewTab({
  entity,
  documents,
}: {
  entity: Entity;
  documents: Document[];
}) {
  const masterFile = firstDocument(documents, "master-file");
  const policyMemo = firstDocument(documents, "memo") ?? masterFile;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Functional Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{entity.functionalProfile}</p>
          <div>
            {citationFor(
              masterFile,
              "Entity profile",
              `${entity.name} is maintained as ${entity.functionalProfile.toLowerCase()}.`,
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">FAR Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Functions, assets, and risks are anchored to the group policy and entity profile. The
            record keeps this summary tied to citations before it can support exports.
          </p>
          <div className="flex flex-wrap gap-2">
            {citationFor(
              policyMemo,
              "FAR",
              "Functions, assets, and risks are mapped to the current group policy.",
            )}
            {citationFor(
              masterFile,
              "Substance",
              "Entity substance is reconciled to payroll, facility, and ledger extracts.",
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FinancialsTab({ entity }: { entity: Entity }) {
  const [gaap, setGaap] = useState<"local" | "ifrs">("local");
  const revenue = entity.role === "principal" ? 128_400_000 : 22_800_000;
  const operatingProfit = entity.role === "principal" ? 31_200_000 : 2_900_000;
  const costBase = entity.role === "principal" ? 72_000_000 : 16_700_000;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={gaap === "local" ? "default" : "outline"}
          onClick={() => setGaap("local")}
          aria-label="Local GAAP"
        >
          Local GAAP
        </Button>
        <Button
          size="sm"
          variant={gaap === "ifrs" ? "default" : "outline"}
          onClick={() => setGaap("ifrs")}
          aria-label="IFRS GAAP"
        >
          IFRS / US GAAP
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Revenue", value: revenue, source: `${gaap} ledger` },
          { label: "Operating profit", value: operatingProfit, source: `${gaap} P&L` },
          { label: "Cost base", value: costBase, source: "cost allocation model" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-xl font-semibold">{formatMoney(item.value)}</p>
              <ProvenanceChip
                asOf={entity.asOf}
                source={item.source}
                hops={[
                  { label: `${entity.jurisdictionCode} trial balance`, type: "ledger-line" },
                  { label: `${entity.name} segmentation`, type: "segmentation" },
                  { label: item.label, type: "metric" },
                ]}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SubstanceTab({ entity }: { entity: Entity }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        { label: "Headcount", value: entity.role === "principal" ? "184" : "42", detail: "Payroll system" },
        { label: "Payroll", value: formatMoney(entity.role === "principal" ? 28_400_000 : 5_900_000), detail: "FY2024" },
        { label: "Facilities", value: entity.role === "principal" ? "3" : "1", detail: entity.taxResidency },
      ].map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <CardTitle className="text-sm">{item.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p className="text-xl font-semibold text-foreground">{item.value}</p>
            <p>{item.detail}</p>
            <ProvenanceChip
              asOf={entity.asOf}
              source={`${entity.jurisdictionCode} substance extract`}
              hops={[
                { label: "Payroll extract", type: "metric" },
                { label: `${entity.name} profile`, type: "entity-pl" },
              ]}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PillarTwoTab({ entity }: { entity: Entity }) {
  const rows = [
    { label: "GloBE ETR", value: entity.jurisdictionCode === "DE" ? "12.4%" : "18.7%" },
    { label: "QDMTT applicability", value: entity.jurisdictionCode === "US" ? "Not applicable" : "Review" },
    { label: "Substance-based exclusion", value: "Available" },
    { label: "MNE group", value: "Veritax Group" },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        GloBE Attributes
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map(({ label, value }) => (
          <div key={label} className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgreementsTab({ flows }: { flows: Flow[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Flows and their agreement status
      </p>
      {flows.length === 0 ? (
        <EmptyState heading="No flows" description="No intercompany flows touch this entity." />
      ) : (
        flows.map((flow) => (
          <div
            key={flow.id}
            className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5 text-sm"
          >
            <span>
              {flow.kind} - {flow.method}
            </span>
            <div className="flex items-center gap-2">
              <Badge className={cn("text-xs capitalize", STATUS_COLORS[flow.status])}>
                {flow.status}
              </Badge>
              {flow.agreementId ? (
                <Badge variant="outline" className="text-xs text-success-soft-foreground border-success/25">
                  ICA: {flow.agreementId}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-danger-soft-foreground border-danger/25">
                  Gap - no ICA
                </Badge>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FindingsTab({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <EmptyState heading="No findings" description="No findings are associated with this entity's flows." />;
  }

  return (
    <div className="space-y-2">
      {findings.map((finding) => (
        <div
          key={finding.id}
          className="flex items-center gap-3 rounded-md border border-border p-2.5 text-sm"
        >
          <Badge variant="outline" className="shrink-0 font-mono text-xs">
            {finding.id}
          </Badge>
          <span className="truncate text-sm">{finding.title}</span>
          <span
            className={cn(
              "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs capitalize",
              SEVERITY_COLORS[finding.severity],
            )}
          >
            {finding.severity}
          </span>
        </div>
      ))}
    </div>
  );
}

function FilingsTab({ documents }: { documents: Document[] }) {
  const filings = documents.filter((document) => document.type === "local-file" || document.type === "master-file");

  if (filings.length === 0) {
    return <EmptyState heading="Filings" description="No filing evidence is attached to this entity yet." />;
  }

  return (
    <div className="space-y-2">
      {filings.map((document) => (
        <div
          key={document.id}
          className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5 text-sm"
        >
          <div>
            <p className="font-medium">{document.name}</p>
            <p className="text-xs text-muted-foreground">
              {document.jurisdiction} FY{document.fy} v{document.version}
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {document.hash}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function AuditHistoryTab({ entity, flows, findings }: { entity: Entity; flows: Flow[]; findings: Finding[] }) {
  const rows = [
    {
      label: "Entity profile refreshed",
      detail: `${entity.name} profile updated from corpus v.418.`,
    },
    {
      label: "Flow map reconciled",
      detail: `${flows.length} touching flows checked against agreements and ledger extracts.`,
    },
    {
      label: "Findings evaluated",
      detail: `${findings.length} findings linked to this entity are ready for review.`,
    },
  ];

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-md border border-border p-3 text-sm">
          <p className="font-medium">{row.label}</p>
          <p className="text-muted-foreground">{row.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function EntityPageContent({
  entity,
  relatedFlows,
  relatedFindings,
  relatedDocuments,
  defaultTab = "Overview",
  assignees = mockUsers,
  onRunScopedScan,
  onSaveStandingInstruction,
  onAssign,
  onExportProfile,
}: EntityPageContentProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [planOpen, setPlanOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [assigneeId, setAssigneeId] = useState(assignees[0]?.id ?? "");
  const [notice, setNotice] = useState<string | null>(null);

  const scopedScanPlan = useMemo(
    () => buildScopedScanPlan(entity, relatedFlows),
    [entity, relatedFlows],
  );

  function runScopedScan(payload: RunPayload): RunReference {
    const fallback = {
      id: `scoped-scan-${entity.id}`,
      href: `/runs?run=scoped-scan-${entity.id}`,
    };
    const result = onRunScopedScan?.(entity.id, payload);
    const runReference = result ?? fallback;
    setNotice(`Scoped scan run created for ${entity.name}.`);
    return runReference;
  }

  function saveStandingInstruction() {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    onSaveStandingInstruction?.(entity.id, trimmed);
    setNotice(`Standing instruction saved for ${entity.name}.`);
    setInstructionOpen(false);
  }

  function assignEntity() {
    if (!assigneeId) return;
    onAssign?.(entity.id, assigneeId);
    const user = assignees.find((item) => item.id === assigneeId);
    setNotice(`${entity.name} assigned to ${user?.name ?? assigneeId}.`);
    setAssignmentOpen(false);
  }

  function exportProfile(payload: ExportPayload) {
    onExportProfile?.(entity.id, payload);
    setNotice(`${entity.name} profile exported as ${payload.format} to ${payload.destination}.`);
    setExportOpen(false);
  }

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{entity.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {entity.role}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                {entity.jurisdictionCode}
              </Badge>
              <span className="text-sm text-muted-foreground">as-of {entity.asOf}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPlanOpen(true)} className="gap-1.5">
              <Play className="h-4 w-4" />
              Run scoped scan
            </Button>
            <Button variant="outline" onClick={() => setInstructionOpen((value) => !value)} className="gap-1.5">
              <ClipboardCheck className="h-4 w-4" />
              Add standing instruction
            </Button>
            <Button variant="outline" onClick={() => setAssignmentOpen((value) => !value)} className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              Assign
            </Button>
            <Button variant="outline" onClick={() => setExportOpen(true)} className="gap-1.5">
              <Download className="h-4 w-4" />
              Export profile
            </Button>
          </div>
        </div>

        {notice && (
          <Alert role="status">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {(instructionOpen || assignmentOpen) && (
          <div className="grid gap-3 lg:grid-cols-2">
            {instructionOpen && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Standing instruction</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Label htmlFor="standing-instruction">Instruction</Label>
                  <Textarea
                    id="standing-instruction"
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    placeholder="Keep Japan royalty gaps in the weekly review until an ICA is executed."
                  />
                  <Button onClick={saveStandingInstruction}>Save instruction</Button>
                </CardContent>
              </Card>
            )}

            {assignmentOpen && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Assign entity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Label htmlFor="entity-assignee">Owner</Label>
                  <select
                    id="entity-assignee"
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {assignees.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                  <Button onClick={assignEntity}>Save assignment</Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      <Separator />

      <div>
        <div role="tablist" className="flex flex-wrap gap-1 border-b border-border pb-0">
          {["Overview", "Financials", "Substance", "Pillar 2", "Agreements", "Findings", "Filings", "Audit history"].map(
            (tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-t-md border-b-2 px-3 py-2 text-sm transition-colors",
                  activeTab === tab
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab}
              </button>
            ),
          )}
        </div>

        <div className="mt-4">
          {activeTab === "Overview" && <OverviewTab entity={entity} documents={relatedDocuments} />}
          {activeTab === "Financials" && <FinancialsTab entity={entity} />}
          {activeTab === "Substance" && <SubstanceTab entity={entity} />}
          {activeTab === "Pillar 2" && <PillarTwoTab entity={entity} />}
          {activeTab === "Agreements" && <AgreementsTab flows={relatedFlows} />}
          {activeTab === "Findings" && <FindingsTab findings={relatedFindings} />}
          {activeTab === "Filings" && <FilingsTab documents={relatedDocuments} />}
          {activeTab === "Audit history" && (
            <AuditHistoryTab entity={entity} flows={relatedFlows} findings={relatedFindings} />
          )}
        </div>
      </div>

      <PlanConfirmationModal
        open={planOpen}
        plan={scopedScanPlan}
        onRun={runScopedScan}
        onCancel={() => setPlanOpen(false)}
      />
      <ExportDialog
        open={exportOpen}
        artifactClass="record"
        artifactName={`${entity.name} profile as-of ${entity.asOf}`}
        isSigned={false}
        uncitedClaimCount={0}
        onExport={exportProfile}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}
