"use client";

import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileText,
  Filter,
  MessageSquare,
  MoreHorizontal,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CitationChip } from "@/components/patterns/pat-1-citation-chip";
import { ProvenanceChip } from "@/components/patterns/pat-2-provenance";
import { StaleBadge } from "@/components/patterns/pat-3-staleness";
import { DataTable, type Column } from "@/components/patterns/pat-8-data-table";
import {
  DegradedState,
  EmptyState,
  LoadingState,
} from "@/components/surface-states";
import { cn } from "@/lib/utils";

type TokenSwatch = {
  name: string;
  role: string;
  className: string;
};

type FindingRow = {
  id: string;
  object: string;
  state: "ready" | "stale" | "blocked";
  citation: string;
  owner: string;
};

const tokenSwatches: TokenSwatch[] = [
  { name: "surface", role: "primary canvas", className: "bg-surface" },
  { name: "surface-secondary", role: "rails and toolbars", className: "bg-surface-secondary" },
  { name: "surface-elevated", role: "menus and dialogs", className: "bg-surface-elevated" },
  { name: "primary", role: "main action", className: "bg-primary" },
  { name: "info", role: "source context", className: "bg-info" },
  { name: "success", role: "resolved work", className: "bg-success" },
  { name: "warning", role: "review needed", className: "bg-warning" },
  { name: "danger", role: "blocked action", className: "bg-danger" },
];

const findings: FindingRow[] = [
  {
    id: "fn-108",
    object: "UK royalty rate exceeds reviewer range",
    state: "ready",
    citation: "UK Local File 4.2",
    owner: "Marcus Webb",
  },
  {
    id: "fn-117",
    object: "Germany allocation key lacks support",
    state: "stale",
    citation: "Ledger v.419",
    owner: "Ikaika Choi",
  },
  {
    id: "fn-126",
    object: "Japan local file claim has no source span",
    state: "blocked",
    citation: "missing",
    owner: "Sarah Kimura",
  },
];

const findingColumns: Column<FindingRow>[] = [
  {
    key: "id",
    header: "ID",
    sortable: true,
    render: (row) => <span className="font-mono text-xs text-muted-foreground">{row.id}</span>,
  },
  {
    key: "object",
    header: "Object",
    sortable: true,
    render: (row) => <span className="font-medium">{row.object}</span>,
  },
  {
    key: "state",
    header: "State",
    sortable: true,
    render: (row) => {
      const variant =
        row.state === "ready" ? "success" : row.state === "stale" ? "warning" : "destructive";
      return <Badge variant={variant}>{row.state}</Badge>;
    },
  },
  {
    key: "citation",
    header: "Citation",
    render: (row) => <span className="text-muted-foreground">{row.citation}</span>,
  },
  {
    key: "owner",
    header: "Owner",
    render: (row) => row.owner,
  },
];

const provenanceHops = [
  { label: "ERP row 8492", type: "ledger-line" },
  { label: "Royalty flow", type: "mapping" },
  { label: "UK tested party", type: "entity-pl" },
  { label: "Reviewer range", type: "benchmark" },
];

function noop() {}

function Section({
  id,
  label,
  title,
  description,
  children,
}: {
  id: string;
  label: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-5">
      <div className="grid gap-3 laptop:grid-cols-[260px_1fr]">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{label}</p>
          <h2 className="heading-lg mt-1 text-foreground">{title}</h2>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Panel({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface p-4 shadow-hairline", className)}>
      {(title || description) && (
        <div className="mb-4 space-y-1">
          {title && <p className="text-sm font-semibold">{title}</p>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function TokenSwatch({ swatch }: { swatch: TokenSwatch }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <div className={cn("h-9 w-9 rounded-md border border-border", swatch.className)} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{swatch.name}</p>
        <p className="truncate text-xs text-muted-foreground">{swatch.role}</p>
      </div>
    </div>
  );
}

function AppShellPreview() {
  const nav = ["Briefing", "Graph", "Findings", "Library", "Runs"];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-hairline">
      <div className="flex h-11 items-center justify-between border-b border-border bg-surface px-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-semibold">Veritax</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">FY2026</Badge>
          <Button size="sm" variant="outline">
            <Search className="h-3.5 w-3.5" />
            Ask
          </Button>
        </div>
      </div>
      <div className="grid min-h-[300px] grid-cols-[88px_minmax(0,1fr)] tablet:grid-cols-[160px_minmax(0,1fr)]">
        <div className="min-w-0 border-r border-border bg-surface-secondary p-2">
          {nav.map((item, index) => (
            <div
              key={item}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                index === 2 ? "bg-surface text-foreground shadow-hairline" : "text-muted-foreground",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              <span className="truncate">{item}</span>
            </div>
          ))}
        </div>
        <div className="min-w-0 space-y-3 p-3 tablet:p-4">
          <div className="flex min-w-0 flex-col gap-2 tablet:flex-row tablet:items-start tablet:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">mirror.run</p>
              <h3 className="heading-md mt-1">Findings ready for review</h3>
            </div>
            <Badge variant="success" className="w-fit">
              record staged
            </Badge>
          </div>
          {findings.map((finding) => (
            <div
              key={finding.id}
              className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{finding.object}</p>
                <p className="text-xs text-muted-foreground">{finding.citation}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="mx-auto max-w-[1280px] space-y-16 px-5 py-8 desktop:px-10">
        <header className="grid gap-6 border-b border-border pb-8 laptop:grid-cols-[1fr_520px]">
          <div className="space-y-5">
            <Badge variant="info" className="gap-1.5">
              <Sparkles className="h-3 w-3" />
              OpenAI Apps SDK UI adapter
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-normal text-foreground tablet:text-5xl">
                App design system for dense tax review.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                Veritax now uses a gray-first OpenAI Apps SDK UI grammar: compact controls,
                elevated overlays, semantic soft states, and evidence surfaces that stay easy to scan.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button>
                <Play className="h-4 w-4" />
                Run Mirror
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4" />
                Export record
              </Button>
              <Button variant="soft">
                <MessageSquare className="h-4 w-4" />
                Ask brief
              </Button>
            </div>
          </div>
          <AppShellPreview />
        </header>

        <Section
          id="foundation"
          label="Foundation"
          title="SDK token vocabulary"
          description="The foundation keeps the app close to the OpenAI Apps SDK UI system while staying compatible with the current Tailwind 3 pipeline."
        >
          <div className="grid gap-3 tablet:grid-cols-2 laptop:grid-cols-4">
            {tokenSwatches.map((swatch) => (
              <TokenSwatch key={swatch.name} swatch={swatch} />
            ))}
          </div>
          <div className="grid gap-3 laptop:grid-cols-3">
            <Panel title="Typography" description="One sans family carries product UI. Mono remains for versions and IDs.">
              <div className="space-y-3">
                <p className="heading-xl">Record changes need review</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Findings, gates, citations, obligations, and runs use compact sentence case.
                </p>
                <p className="font-mono text-xs text-muted-foreground">corpus v.419 / rulepack rp-2026.01</p>
              </div>
            </Panel>
            <Panel title="Elevation" description="Overlays rise; cards mostly sit flat.">
              <div className="grid gap-3">
                <div className="rounded-lg border border-border bg-surface p-3 shadow-hairline">surface</div>
                <div className="rounded-lg border border-border bg-surface-elevated p-3 shadow-elevation-200">
                  elevated
                </div>
              </div>
            </Panel>
            <Panel title="Motion" description="Transitions are 150ms and state-driven.">
              <div className="space-y-3">
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </Panel>
          </div>
        </Section>

        <Section
          id="controls"
          label="Controls"
          title="Compact, familiar actions"
          description="Controls use the SDK pattern of neutral primary, outline, soft, ghost, and semantic danger. The shape stays standard across the app."
        >
          <div className="grid gap-3 laptop:grid-cols-3">
            <Panel title="Buttons">
              <div className="flex flex-wrap gap-2">
                <Button>Approve gate</Button>
                <Button variant="outline">Request changes</Button>
                <Button variant="secondary">Save view</Button>
                <Button variant="soft">Copy link</Button>
                <Button variant="destructive">Reject</Button>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </Panel>
            <Panel title="Badges">
              <div className="flex flex-wrap gap-2">
                <Badge>primary</Badge>
                <Badge variant="outline">draft</Badge>
                <Badge variant="info">cited</Badge>
                <Badge variant="success">resolved</Badge>
                <Badge variant="warning">stale</Badge>
                <Badge variant="destructive">blocked</Badge>
                <Badge variant="discovery">proposal</Badge>
              </div>
            </Panel>
            <Panel title="Forms">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="scope">Scope</Label>
                  <Input id="scope" placeholder="UK royalty flow" />
                </div>
                <Select defaultValue="mirror">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mirror">Mirror run</SelectItem>
                    <SelectItem value="factory">Factory draft</SelectItem>
                    <SelectItem value="monitor">Monitor tick</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea placeholder="Add reviewer context" rows={3} />
              </div>
            </Panel>
          </div>

          <Panel title="Inline controls" description="Switches, checkboxes, menus, popovers, and tooltips share one surface language.">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox defaultChecked />
                Require citations
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch defaultChecked />
                Watch drift
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="space-y-3">
                  <p className="text-sm font-semibold">Finding filters</p>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <label className="flex items-center gap-2">
                      <Checkbox defaultChecked />
                      Ready for review
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox />
                      Stale proposals
                    </label>
                  </div>
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Record actions</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy citation path
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Database className="mr-2 h-4 w-4" />
                    Open source object
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-danger">Quarantine claim</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Citation status">
                    <ShieldCheck className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>All visible claims have citations.</TooltipContent>
              </Tooltip>
            </div>
          </Panel>
        </Section>

        <Section
          id="evidence"
          label="Evidence"
          title="Product patterns keep their contracts"
          description="Canonical Veritax patterns now inherit the OpenAI SDK visual layer while keeping their existing props and behavior."
        >
          <div className="grid gap-3 laptop:grid-cols-[1fr_380px]">
            <Panel title="Cited claim">
              <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm leading-7">
                UK royalty charge is outside the reviewer range{" "}
                <CitationChip
                  docName="UK Local File"
                  section="4.2"
                  confidence={0.94}
                  extractorVersion="ext-18"
                  snippet="The FY2026 royalty rate is stated as 18 percent for UK distribution activity."
                />{" "}
                and traces back to the ledger{" "}
                <ProvenanceChip asOf="FY2026" source="ledger v.419" hops={provenanceHops} />.
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StaleBadge whatChanged="Corpus v.419 changed the source rate." onViewDiff={noop} />
                <Badge variant="info">ready for review</Badge>
                <Badge variant="outline">gate required</Badge>
              </div>
            </Panel>
            <Panel title="Review alert">
              <Alert variant="info">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Finding is staged</AlertTitle>
                <AlertDescription>
                  The run proposed one record change. A reviewer must promote it through a gate.
                </AlertDescription>
              </Alert>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Play className="h-4 w-4" />
                Open gate modal
              </Button>
            </Panel>
          </div>
        </Section>

        <Section
          id="data"
          label="Data"
          title="Dense tables stay calm"
          description="Tables use subtle borders, compact cells, hover affordances, keyboard focus, and semantic state chips."
        >
          <DataTable
            columns={findingColumns}
            data={findings}
            onRowOpen={noop}
            onRowSelect={noop}
            bulkActions={
              <div className="flex gap-2">
                <Button size="sm" variant="outline">Assign</Button>
                <Button size="sm" variant="outline">Export</Button>
              </div>
            }
          />
        </Section>

        <Section
          id="surfaces"
          label="Surfaces"
          title="Every state has a useful surface"
          description="Loading, empty, and degraded states follow the same surfaces as the rest of the app."
        >
          <div className="grid gap-3 laptop:grid-cols-3">
            <Panel title="Empty">
              <EmptyState
                heading="No findings staged"
                description="Run Mirror to compare the record and stage cited findings."
                action={<Button size="sm">Run Mirror</Button>}
                className="rounded-lg border border-border py-8"
              />
            </Panel>
            <Panel title="Loading">
              <div className="rounded-lg border border-border">
                <LoadingState rows={5} />
              </div>
            </Panel>
            <Panel title="Degraded">
              <DegradedState affectedSources={["SharePoint", "ERP"]}>
                <div className="space-y-2 rounded-lg border border-border p-4">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </DegradedState>
            </Panel>
          </div>
        </Section>

        <Section
          id="composition"
          label="Composition"
          title="Panels compose without decoration"
          description="The system favors real product surfaces over decorative cards. Repeated panels are compact, titled, and task oriented."
        >
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
                  <CardDescription>Runs compare source material and leave cited changes ready for review.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 laptop:grid-cols-3">
                  {["Record read", "Findings staged", "Gate pending"].map((item, index) => (
                    <div key={item} className="rounded-lg border border-border bg-surface-secondary p-3">
                      <p className="font-mono text-xs text-muted-foreground">0{index + 1}</p>
                      <p className="mt-1 text-sm font-semibold">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="factory">
              <Card>
                <CardHeader>
                  <CardTitle>Factory drafts from the record</CardTitle>
                  <CardDescription>Drafts inherit citations and block unresolved claims.</CardDescription>
                </CardHeader>
              </Card>
            </TabsContent>
            <TabsContent value="monitor">
              <Card>
                <CardHeader>
                  <CardTitle>Monitor watches drift</CardTitle>
                  <CardDescription>Digest surfaces carry routine updates; gates carry reviewer decisions.</CardDescription>
                </CardHeader>
              </Card>
            </TabsContent>
          </Tabs>
        </Section>

        <footer className="border-t border-border py-6">
          <div className="flex flex-col justify-between gap-3 tablet:flex-row tablet:items-center">
            <div>
              <p className="text-sm font-semibold">Veritax app design system</p>
              <p className="text-sm text-muted-foreground">
                OpenAI Apps SDK UI grammar, adapted for this app shell and product workflow.
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Landing page untouched.
            </div>
          </div>
        </footer>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Promote staged finding?</DialogTitle>
              <DialogDescription>
                This changes the record for the UK royalty flow and preserves the citation chain.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-border bg-surface-secondary p-3 text-sm">
              <p className="font-semibold">UK royalty rate exceeds reviewer range</p>
              <p className="mt-1 text-muted-foreground">Source: UK Local File 4.2, corpus v.419</p>
            </div>
            <Separator />
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => setDialogOpen(false)}>Promote finding</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
