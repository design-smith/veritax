"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileText,
  GitBranch,
  Layers3,
  Network,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CitationChip } from "@/components/patterns/pat-1-citation-chip";
import { ProvenanceChip } from "@/components/patterns/pat-2-provenance";
import {
  StaleBadge,
  SurfaceStalenessBar,
} from "@/components/patterns/pat-3-staleness";
import {
  PlanConfirmationModal,
  type PlanSpec,
} from "@/components/patterns/pat-4-plan-confirmation";
import { GateCard } from "@/components/patterns/pat-5-gate-card";
import { InstructionInput } from "@/components/patterns/pat-6-instruction";
import { DataTable, type Column } from "@/components/patterns/pat-8-data-table";
import { ExportDialog } from "@/components/patterns/pat-10-export";
import {
  SensitivityChip,
  SensitivityNotice,
  VaultLockedEntry,
} from "@/components/patterns/pat-11-sensitivity";
import {
  CommentThread,
  type Comment,
} from "@/components/patterns/pat-12-comments";
import {
  DegradedState,
  DeniedState,
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/surface-states";
import {
  mockGateRequests,
  mockUsers,
  type GateRequest,
  type User,
} from "@/lib/mock";
import { cn } from "@/lib/utils";

type TokenSwatch = {
  name: string;
  value: string;
  className: string;
};

type FindingRow = {
  id: string;
  finding: string;
  severity: "critical" | "high" | "medium";
  status: string;
  exposure: string;
};

const tokenSwatches: TokenSwatch[] = [
  { name: "background", value: "0.985 0.002 90", className: "bg-background" },
  { name: "foreground", value: "0.12 0.01 60", className: "bg-foreground" },
  { name: "card", value: "1 0 0", className: "bg-card" },
  { name: "muted", value: "0.94 0.005 90", className: "bg-muted" },
  { name: "border", value: "0.88 0.01 90", className: "bg-border" },
  { name: "primary", value: "0.12 0.01 60", className: "bg-primary" },
  { name: "destructive", value: "0.577 0.245 27.325", className: "bg-destructive" },
];

const findingRows: FindingRow[] = [
  {
    id: "fn-001",
    finding: "UK royalty rate exceeds reviewer range",
    severity: "critical",
    status: "ready for review",
    exposure: "GBP 3.2M",
  },
  {
    id: "fn-014",
    finding: "Germany allocation key is not documented",
    severity: "high",
    status: "triaged",
    exposure: "EUR 85K",
  },
  {
    id: "fn-021",
    finding: "Singapore payroll data is stale",
    severity: "medium",
    status: "watching",
    exposure: "none",
  },
];

const findingColumns: Column<FindingRow>[] = [
  {
    key: "id",
    header: "ID",
    sortable: true,
    render: (row) => (
      <span className="font-mono text-xs text-muted-foreground">{row.id}</span>
    ),
  },
  {
    key: "finding",
    header: "Finding",
    sortable: true,
    render: (row) => row.finding,
  },
  {
    key: "severity",
    header: "Severity",
    sortable: true,
    render: (row) => (
      <Badge
        variant={row.severity === "critical" ? "destructive" : "outline"}
        className="capitalize"
      >
        {row.severity}
      </Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <span className="text-muted-foreground">{row.status}</span>,
  },
  {
    key: "exposure",
    header: "Exposure",
    render: (row) => (
      <span className="font-mono text-xs">{row.exposure}</span>
    ),
  },
];

const comments: Comment[] = [
  {
    id: "c-1",
    authorId: "u2",
    authorName: "Marcus Webb",
    text: "Confirm the policy rate before this finding moves through the gate.",
    timestamp: "2026-01-12T10:12:00Z",
  },
  {
    id: "c-2",
    authorId: "u3",
    authorName: "Ikaika Choi",
    text: "The cited local file section still shows the prior year rate.",
    timestamp: "2026-01-12T11:18:00Z",
    resolved: true,
  },
];

const planSpec: PlanSpec = {
  intent: "Run Mirror on the UK royalty flow and stage new findings for review.",
  steps: [
    {
      id: "step-1",
      description: "Pin corpus v.419 and rulepack rp-2026.01.",
      scope: "UK royalty flow",
    },
    {
      id: "step-2",
      description: "Compare agreement terms, ledger rates, and local file language.",
    },
    {
      id: "step-3",
      description: "Stage findings with citations and route gated changes.",
    },
  ],
  produces: ["finding candidates", "evidence chain", "run manifest"],
  invalidates: ["UK local file draft", "board pack tax slide"],
  estimatedDuration: "About 2 minutes",
  costClass: "standard",
  instruction: "Scan the UK royalty flow for FY2026 and stage only cited findings.",
  permissionCheck: "allowed",
  tier: "run",
};

const lineageHops = [
  { label: "Ledger row 8492", type: "ledger-line" },
  { label: "US to UK royalty flow", type: "mapping" },
  { label: "UK tested-party margin", type: "entity-pl" },
  { label: "Range watch tick", type: "metric" },
];

function noop() {}

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-6">
      <div className="grid gap-4 laptop:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          <p className="font-mono text-xs text-muted-foreground">{eyebrow}</p>
          <h2 className="font-display text-4xl leading-none tracking-tight text-foreground">
            {title}
          </h2>
        </div>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-5", className)}>
      {title && (
        <>
          <p className="mb-4 text-sm font-medium text-foreground">{title}</p>
          <Separator className="mb-4" />
        </>
      )}
      {children}
    </div>
  );
}

function TokenSwatch({ swatch }: { swatch: TokenSwatch }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-md border", swatch.className)} />
      <div>
        <p className="text-sm font-medium">{swatch.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{swatch.value}</p>
      </div>
    </div>
  );
}

function ShellPreview() {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="flex h-10 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="font-display text-lg leading-none">Veritax</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">
            FY2026
          </Badge>
          <Button size="sm" variant="outline">
            <Search className="h-3.5 w-3.5" />
            Ask
          </Button>
        </div>
      </div>
      <div className="grid min-h-[280px] grid-cols-[180px_1fr]">
        <div className="border-r bg-muted/40 p-3">
          {["Briefing", "Graph", "Findings", "Library", "Runs"].map((item, index) => (
            <div
              key={item}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                index === 2
                  ? "bg-background text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {item}
            </div>
          ))}
        </div>
        <div className="p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs text-muted-foreground">Mirror run</p>
              <h3 className="mt-1 font-display text-3xl leading-none">
                Findings ready for review
              </h3>
            </div>
            <Badge variant="warning">3 gates</Badge>
          </div>
          <div className="grid gap-3">
            {[
              "Royalty rate exceeds reviewer range",
              "Agreement version conflict",
              "Unsupported claim quarantined",
            ].map((item, index) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                  <span className="text-sm">{item}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphFragment() {
  const nodes = [
    { label: "US Principal", meta: "policy owner", x: "left-4 top-8" },
    { label: "UK Ltd", meta: "limited risk", x: "right-6 top-4" },
    { label: "Germany GmbH", meta: "local file", x: "right-12 bottom-6" },
    { label: "Royalty flow", meta: "exception", x: "left-24 bottom-10" },
  ];

  return (
    <div className="relative min-h-[260px] overflow-hidden rounded-lg border bg-background p-5">
      <div className="absolute left-16 top-24 h-px w-[65%] rotate-[-8deg] bg-border" />
      <div className="absolute bottom-24 left-32 h-px w-[55%] rotate-[12deg] bg-border" />
      <div className="absolute left-44 top-16 h-[55%] w-px rotate-[28deg] bg-border" />
      {nodes.map((node) => (
        <div
          key={node.label}
          className={cn(
            "absolute rounded-md border bg-card px-3 py-2 shadow-none",
            node.x,
          )}
        >
          <p className="text-sm font-medium">{node.label}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{node.meta}</p>
        </div>
      ))}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border bg-foreground px-3 py-1 text-background">
        <Network className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px]">Intercompany Graph</span>
      </div>
    </div>
  );
}

function ProductSurface() {
  return (
    <Panel className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">surface grammar</p>
          <p className="text-sm font-medium">Claims render with evidence or quarantine.</p>
        </div>
        <SensitivityChip tier="sensitive" />
      </div>
      <div className="rounded-md border bg-background p-4">
        <p className="text-sm leading-7">
          UK royalty charge is outside the current reviewer range{" "}
          <CitationChip
            docName="UK Local File"
            section="4.2"
            confidence={0.94}
            extractorVersion="ext-18"
            snippet="The FY2026 royalty rate is stated as 18 percent for UK distribution activity."
          />{" "}
          and the computed margin traces back to the ledger{" "}
          <ProvenanceChip
            asOf="FY2026"
            source="ledger v.419"
            hops={lineageHops}
          />
          .
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <CitationChip
          docName="Agreement"
          section="2.1"
          confidence={0.88}
          extractorVersion="ext-18"
        />
        <CitationChip
          docName="Claim"
          section="missing"
          confidence={0}
          extractorVersion="ext-18"
          isQuarantined
        />
        <StaleBadge whatChanged="Corpus v.419 changed the source rate." onViewDiff={noop} />
      </div>
    </Panel>
  );
}

export default function DesignSystemPage() {
  const [planOpen, setPlanOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const gate = mockGateRequests[0] as GateRequest;
  const requester = mockUsers.find((user) => user.id === gate.requesterId) as User;

  return (
    <div className="mx-auto max-w-[1280px] space-y-20 px-6 py-10 desktop:px-12">
      <header className="grid gap-8 border-b pb-10 laptop:grid-cols-[1fr_440px]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-3 rounded-full border bg-card px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
            <span className="font-mono text-xs text-muted-foreground">
              Veritax design system
            </span>
          </div>
          <div className="space-y-4">
            <h1 className="max-w-4xl font-display text-6xl leading-[0.92] tracking-tight text-foreground tablet:text-7xl">
              The record, rendered for review.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Product UI follows the landing page foundation: warm neutral
              surfaces, crisp borders, serif display moments, mono metadata,
              and evidence-first controls for tax work.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button>
              <Play className="h-4 w-4" />
              Run Mirror
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4" />
              Export with citations
            </Button>
          </div>
        </div>
        <ShellPreview />
      </header>

      <Section
        id="foundation"
        eyebrow="Foundation"
        title="Landing page tokens in product UI"
        description="The app uses the same OKLCH neutral foundation as the landing page, translated for Tailwind utilities and product density."
      >
        <div className="grid gap-4 laptop:grid-cols-[1fr_1fr]">
          <Panel title="Color tokens">
            <div className="grid gap-4 tablet:grid-cols-2">
              {tokenSwatches.map((swatch) => (
                <TokenSwatch key={swatch.name} swatch={swatch} />
              ))}
            </div>
          </Panel>
          <Panel title="Type system">
            <div className="space-y-5">
              <div>
                <p className="font-mono text-xs text-muted-foreground">
                  Instrument Serif / display
                </p>
                <p className="font-display text-5xl leading-none">
                  Veritax keeps the record.
                </p>
              </div>
              <div>
                <p className="font-mono text-xs text-muted-foreground">
                  Instrument Sans / interface
                </p>
                <p className="text-base leading-7">
                  Findings, citations, gates, and runs use calm product type.
                </p>
              </div>
              <div>
                <p className="font-mono text-xs text-muted-foreground">
                  JetBrains Mono / metadata
                </p>
                <p className="font-mono text-sm">corpus v.419 / rulepack rp-2026.01</p>
              </div>
            </div>
          </Panel>
        </div>
      </Section>

      <Section
        id="primitives"
        eyebrow="Primitives"
        title="Quiet controls, clear states"
        description="Buttons, badges, fields, tabs, cards, and tables stay familiar. The visual change is restraint, not novelty."
      >
        <div className="grid gap-4 laptop:grid-cols-3">
          <Panel title="Actions">
            <div className="flex flex-wrap gap-2">
              <Button>Approve gate</Button>
              <Button variant="outline">Request changes</Button>
              <Button variant="secondary">Save view</Button>
              <Button variant="destructive">Reject</Button>
              <Button variant="ghost" size="icon" aria-label="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </Panel>
          <Panel title="Status chips">
            <div className="flex flex-wrap gap-2">
              <Badge>ready for review</Badge>
              <Badge variant="outline">draft</Badge>
              <Badge variant="warning">stale</Badge>
              <Badge variant="success">resolved</Badge>
              <Badge variant="destructive">blocked</Badge>
            </div>
          </Panel>
          <Panel title="Inputs">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="instruction">Run instruction</Label>
                <Input id="instruction" placeholder="Scan UK royalty flow" />
              </div>
              <Textarea placeholder="Add reviewer context" rows={3} />
            </div>
          </Panel>
        </div>

        <Panel title="Data table">
          <DataTable
            columns={findingColumns}
            data={findingRows}
            onRowOpen={noop}
            onRowSelect={noop}
            bulkActions={
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  Assign
                </Button>
                <Button size="sm" variant="outline">
                  Export
                </Button>
              </div>
            }
          />
        </Panel>

        <Panel title="Tabs and cards">
          <Tabs defaultValue="mirror">
            <TabsList>
              <TabsTrigger value="mirror">Mirror</TabsTrigger>
              <TabsTrigger value="factory">Factory</TabsTrigger>
              <TabsTrigger value="monitor">Monitor</TabsTrigger>
            </TabsList>
            <TabsContent value="mirror">
              <Card>
                <CardHeader>
                  <CardTitle>Mirror stages findings</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-muted-foreground">
                  Runs read the record, compare source material, and leave changes
                  in staging until a reviewer promotes them through a gate.
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="factory">
              <Card>
                <CardHeader>
                  <CardTitle>Factory drafts from the record</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-muted-foreground">
                  Drafts inherit citations and remain blocked when claims cannot
                  resolve to source material.
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="monitor">
              <Card>
                <CardHeader>
                  <CardTitle>Monitor watches drift</CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-7 text-muted-foreground">
                  Alerts stay exception-first. Digest surfaces carry routine
                  updates; gates carry reviewer urgency.
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Panel>
      </Section>

      <Section
        id="evidence"
        eyebrow="Evidence chain"
        title="No claim without source"
        description="The product language is direct: record, runs, processes, findings, citations, gates. UI exposes provenance instead of hiding it in a tooltip maze."
      >
        <div className="grid gap-4 laptop:grid-cols-[1fr_380px]">
          <ProductSurface />
          <Panel title="Staleness proposal">
            <div className="overflow-hidden rounded-md border">
              <SurfaceStalenessBar count={3} onReview={noop} />
              <div className="space-y-3 p-4">
                {["UK Local File", "Board pack", "Royalty finding"].map((item) => (
                  <div key={item} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{item}</p>
                      <p className="text-xs text-muted-foreground">
                        Inputs changed since last build.
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </Section>

      <Section
        id="gates"
        eyebrow="Gates and runs"
        title="Propose, then promote"
        description="No process commits directly to the record. The interface makes staging, review, permission, and sign-off visible."
      >
        <div className="grid gap-4 laptop:grid-cols-[1fr_420px]">
          <GateCard
            gate={gate}
            objectSummary="Draft local file update with two changed assertions and one citation repair."
            requester={requester}
            diffSummary="Royalty rate changed from 12 percent to 18 percent in the draft."
            onApprove={noop}
            onRequestChanges={noop}
            onReject={noop}
            onDelegate={noop}
          />
          <Panel title="Run manifest">
            <div className="space-y-4">
              <div className="rounded-md border bg-foreground p-4 text-background">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-background/60">mirror.run</span>
                  <Badge variant="outline" className="border-background/20 text-background">
                    ready for review
                  </Badge>
                </div>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-background/70">
{`run: mirror.initial_scan
scope: UK royalty FY2026
corpus: v.419
outputs:
  findings: staged
  citations: required
  gates: manager_review`}
                </pre>
              </div>
              <Button onClick={() => setPlanOpen(true)}>
                <Play className="h-4 w-4" />
                Open plan confirmation
              </Button>
            </div>
          </Panel>
        </div>
      </Section>

      <Section
        id="governed-actions"
        eyebrow="Governed actions"
        title="Review paths stay explicit"
        description="Instructions classify before they run. Exports block uncited claims. Sensitive objects name the policy consequence."
      >
        <div className="grid gap-4 laptop:grid-cols-3">
          <Panel title="Instruction input">
            <InstructionInput
              initialValue="Run a scoped scan for the UK royalty flow."
              existingInstructions={["Always cite agreement sections for royalty rates."]}
              onSubmit={noop}
            />
          </Panel>
          <Panel title="Export guard">
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Export blocked</AlertTitle>
                <AlertDescription>
                  Two claims need citations before this artifact can leave the record.
                </AlertDescription>
              </Alert>
              <Button onClick={() => setExportOpen(true)}>
                <Download className="h-4 w-4" />
                Open export dialog
              </Button>
            </div>
          </Panel>
          <Panel title="Sensitivity">
            <div className="space-y-3">
              <SensitivityNotice tier="sensitive" />
              <VaultLockedEntry label="Privileged memo" onContactCounsel={noop} />
            </div>
          </Panel>
        </div>
      </Section>

      <Section
        id="states"
        eyebrow="State vocabulary"
        title="Every surface has five states"
        description="Loading follows the real layout. Empty states teach the source of future work. Denied and degraded states name the policy or source issue."
      >
        <div className="grid gap-4 laptop:grid-cols-2">
          <Panel title="Empty and loading">
            <div className="grid gap-4 tablet:grid-cols-2">
              <EmptyState
                heading="No findings staged"
                description="Mirror has not returned findings for this scope yet."
                action={<Button size="sm">Run Mirror</Button>}
                className="rounded-md border py-10"
              />
              <div className="rounded-md border">
                <LoadingState rows={6} />
              </div>
            </div>
          </Panel>
          <Panel title="Denied, degraded, error">
            <div className="space-y-4">
              <DeniedState
                tierName="Privileged"
                reason="Content access is counsel-administered for this object."
                onRequestAccess={noop}
                className="rounded-md border py-10"
              />
              <DegradedState affectedSources={["SharePoint", "ERP"]}>
                <div className="rounded-md border p-4">
                  <Skeleton className="mb-2 h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </DegradedState>
              <ErrorState incidentId="inc-2026-0112" onRetry={noop} className="rounded-md border py-10" />
            </div>
          </Panel>
        </div>
      </Section>

      <Section
        id="graph"
        eyebrow="Intercompany Graph"
        title="The object behind the projections"
        description="The product surface should keep entities, flows, agreements, payments, proof, and reviewer actions visibly connected."
      >
        <div className="grid gap-4 laptop:grid-cols-[1fr_380px]">
          <GraphFragment />
          <Panel title="Graph object grammar">
            <div className="space-y-4">
              {[
                { icon: Database, label: "Record object", text: "Versioned entity, flow, agreement, or artifact." },
                { icon: GitBranch, label: "Lineage", text: "Every figure walks back to a source row or span." },
                { icon: ShieldCheck, label: "Gate", text: "Only reviewer promotion changes the record." },
                { icon: Clock3, label: "As-of lens", text: "Surfaces respect fiscal year and knowledge time." },
                { icon: Layers3, label: "Projection", text: "Files and board packs render from the same object." },
              ].map(({ icon: Icon, label, text }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </Section>

      <Section
        id="collaboration"
        eyebrow="Collaboration"
        title="Comments stay anchored"
        description="Threads belong to findings, document spans, gates, and runs. Resolved context stays available without crowding the current review."
      >
        <Panel className="max-w-3xl">
          <CommentThread
            objectRef="finding/fn-001"
            comments={comments}
            users={mockUsers}
            onAdd={noop}
            onResolve={noop}
            onUnresolve={noop}
          />
        </Panel>
      </Section>

      <footer className="border-t py-8">
        <div className="flex flex-col justify-between gap-4 tablet:flex-row tablet:items-center">
          <div>
            <p className="font-display text-2xl">Veritax</p>
            <p className="text-sm text-muted-foreground">
              Calm, cited, controlled product UI for tax teams.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Design system follows the landing foundation.
          </div>
        </div>
      </footer>

      <PlanConfirmationModal
        open={planOpen}
        plan={planSpec}
        onRun={() => setPlanOpen(false)}
        onCancel={() => setPlanOpen(false)}
      />
      <ExportDialog
        open={exportOpen}
        artifactClass="record"
        artifactName="UK Local File FY2026 draft"
        uncitedClaimCount={2}
        onExport={noop}
        onClose={() => setExportOpen(false)}
      />
    </div>
  );
}
