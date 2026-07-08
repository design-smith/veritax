"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle,
  Factory,
  FileText,
  GitPullRequest,
  RefreshCw,
  Scale,
  XCircle,
} from "lucide-react";
import { ProvenanceChip } from "@/components/patterns/pat-2-provenance";
import {
  PlanConfirmationModal,
  type PlanSpec,
} from "@/components/patterns/pat-4-plan-confirmation";
import { EmptyState } from "@/components/surface-states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Document, Entity, Finding, Flow } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

export interface JurisdictionCoverage {
  jurisdiction: string;
  jurisdictionCode: string;
  hasLocalFile: boolean;
  documentId?: string;
}

interface RunReference {
  id: string;
  href: string;
}

interface RunPayload {
  instruction: string;
}

interface GateReference {
  id: string;
  href: string;
}

interface FlowPageContentProps {
  flow: Flow;
  fromEntity: Entity;
  toEntity: Entity;
  coverageByJurisdiction: JurisdictionCoverage[];
  relatedFindings?: Finding[];
  relatedDocuments?: Document[];
  onRetest?: (flowId: string, payload: RunPayload) => RunReference | void;
  onOpenInFactory?: (href: string) => void;
  onProposePolicyChange?: (flowId: string) => GateReference | void;
}

const STATUS_COLORS: Record<Flow["status"], string> = {
  verified: "border-transparent bg-success-soft text-success-soft-foreground",
  drift: "border-transparent bg-warning-soft text-warning-soft-foreground",
  exception: "border-transparent bg-danger-soft text-danger-soft-foreground",
};

const SEVERITY_COLORS: Record<Finding["severity"], string> = {
  critical: "bg-danger-soft text-danger-soft-foreground",
  high: "bg-warning-soft text-warning-soft-foreground",
  medium: "bg-info-soft text-info-soft-foreground",
  low: "bg-secondary text-secondary-foreground",
};

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function buildRetestPlan(flow: Flow, fromEntity: Entity, toEntity: Entity): PlanSpec {
  return {
    intent: `Re-test ${flow.kind} range for ${fromEntity.name} to ${toEntity.name}.`,
    steps: [
      {
        id: "scope",
        description: "Load flow policy, observed ledger series, agreement, and coverage matrix.",
        scope: flow.id,
      },
      {
        id: "benchmark",
        description: "Refresh benchmark checks and compare observed range to current policy.",
      },
      {
        id: "findings",
        description: "Update findings, citations, and gates without changing policy inline.",
      },
    ],
    produces: [`${flow.id} re-test run`, "updated findings", "policy-vs-observed evidence"],
    invalidates: ["stale flow inspector summary", "prior benchmark refresh state"],
    estimatedDuration: "30s-2min",
    costClass: "standard",
    instruction: `Re-test ${flow.id} for FY2024 using the current agreement, benchmark, and ledger series.`,
    permissionCheck: "allowed",
    tier: "run",
  };
}

function agreementDocumentFor(flow: Flow, documents: Document[]) {
  if (!flow.agreementId) return undefined;

  return (
    documents.find((document) => document.type === "ica" && document.entityIds.includes(flow.fromEntityId) && document.entityIds.includes(flow.toEntityId)) ??
    documents.find((document) => document.type === "ica")
  );
}

function benchmarkDocumentFor(flow: Flow, documents: Document[]) {
  return (
    documents.find((document) => document.type === "benchmark" && document.name.toLowerCase().includes(flow.method.toLowerCase())) ??
    documents.find((document) => document.type === "benchmark")
  );
}

function PolicyObservedPanel({ flow }: { flow: Flow }) {
  const delta = flow.observedRate - flow.policyRate;
  const series = [
    { period: "Q1", policy: flow.policyRate, observed: flow.observedRate - 0.012 },
    { period: "Q2", policy: flow.policyRate, observed: flow.observedRate - 0.006 },
    { period: "Q3", policy: flow.policyRate, observed: flow.observedRate - 0.002 },
    { period: "Q4", policy: flow.policyRate, observed: flow.observedRate },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Policy vs Observed</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Policy rate", value: pct(flow.policyRate), source: "policy file" },
            { label: "Observed rate", value: pct(flow.observedRate), source: "ledger series" },
            {
              label: "Delta",
              value: `${delta > 0 ? "+" : ""}${pct(delta)}`,
              source: "range test",
            },
          ].map((item) => (
            <div key={item.label} className="space-y-2">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p
                className={cn(
                  "text-2xl font-semibold",
                  item.label === "Delta" && delta > 0 ? "text-danger-soft-foreground" : "",
                )}
              >
                {item.value}
              </p>
              <ProvenanceChip
                asOf="2024-12-31"
                source={item.source}
                hops={[
                  { label: `${flow.id} ledger extract`, type: "ledger-line" },
                  { label: `${flow.method} mapping`, type: "mapping" },
                  { label: item.label, type: "metric" },
                ]}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-md border border-border p-3" aria-label="policy observed series">
          {series.map((point) => (
            <div key={point.period} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 text-xs">
              <span className="font-mono text-muted-foreground">{point.period}</span>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(Math.max(point.observed * 500, 8), 100)}%` }}
                />
              </div>
              <span className="font-medium">{pct(point.observed)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AgreementCard({ flow, documents }: { flow: Flow; documents: Document[] }) {
  const agreementDocument = agreementDocumentFor(flow, documents);
  const expired = agreementDocument?.name.toLowerCase().includes("2020") ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Governing Agreement</CardTitle>
      </CardHeader>
      <CardContent>
        {flow.agreementId ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{agreementDocument?.name ?? flow.agreementId}</p>
              <p className="text-xs text-muted-foreground">
                {expired ? "EXPIRED - open in Viewer before reliance" : "Executed - current"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={expired ? "border-danger/25 text-danger-soft-foreground" : "border-success/25 text-success-soft-foreground"}
              >
                {expired ? "EXPIRED" : "Executed"}
              </Badge>
              <Button asChild size="sm" variant="outline">
                <a href={`/library/${agreementDocument?.id ?? flow.agreementId}`}>Open in Viewer</a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-danger-soft-foreground">
            <XCircle className="h-4 w-4" />
            <span className="text-sm font-medium">No agreement found - gap</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BenchmarkCard({ flow, documents }: { flow: Flow; documents: Document[] }) {
  const benchmark = benchmarkDocumentFor(flow, documents);
  const stale = benchmark?.fy !== "2024";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Benchmark</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{benchmark?.name ?? `${flow.method} benchmark set`}</p>
            <p className="text-xs text-muted-foreground">
              Current set for {flow.kind} range testing
            </p>
          </div>
          <Badge
            variant="outline"
            className={stale ? "border-warning/25 text-warning-soft-foreground" : "border-success/25 text-success-soft-foreground"}
          >
            {stale ? "Refresh required" : "Current"}
          </Badge>
        </div>
        <ProvenanceChip
          asOf={benchmark ? `${benchmark.fy}-12-31` : "2024-12-31"}
          source={benchmark?.name ?? "Benchmark index"}
          isStale={stale}
          staleReason={stale ? "Benchmark set is older than FY2024." : undefined}
          hops={[
            { label: "Comparable set", type: "metric", href: benchmark ? `/library/${benchmark.id}` : undefined },
            { label: `${flow.method} range`, type: "mapping" },
          ]}
        />
      </CardContent>
    </Card>
  );
}

function FindingsOnFlow({ findings }: { findings: Finding[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Findings on flow</CardTitle>
      </CardHeader>
      <CardContent>
        {findings.length === 0 ? (
          <EmptyState heading="No findings" description="No findings are currently linked to this flow." />
        ) : (
          <div className="space-y-2">
            {findings.map((finding) => (
              <div key={finding.id} className="rounded-md border border-border p-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {finding.id}
                  </Badge>
                  <Badge className={cn("text-xs capitalize", SEVERITY_COLORS[finding.severity])}>
                    {finding.severity}
                  </Badge>
                </div>
                <p className="mt-2 font-medium">{finding.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{finding.summary}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CoverageCard({ coverageByJurisdiction }: { coverageByJurisdiction: JurisdictionCoverage[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Documentation Coverage by Jurisdiction</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {coverageByJurisdiction.map((coverage) => (
            <div
              key={coverage.jurisdictionCode}
              className={cn(
                "flex items-center justify-between rounded-md border p-2.5 text-sm",
                !coverage.hasLocalFile
                  ? "border-danger/25 bg-danger-soft dark:border-danger/30 dark:bg-danger-soft"
                  : "border-border",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold">{coverage.jurisdictionCode}</span>
                <span className="text-muted-foreground">{coverage.jurisdiction}</span>
              </div>
              {coverage.hasLocalFile ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-success-soft-foreground" />
                  <span className="text-xs text-success-soft-foreground">Covered</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-danger-soft-foreground" />
                  <span className="text-xs font-medium text-danger-soft-foreground">Missing - flagged</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CustomsLinkageCard({ flow }: { flow: Flow }) {
  const customsRelevant = flow.kind === "goods" || flow.kind === "royalty";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Customs linkage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <Scale className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium">
              {customsRelevant ? "Customs review required" : "No customs linkage flagged"}
            </p>
            <p className="text-xs text-muted-foreground">
              {customsRelevant
                ? "Royalty and goods flows remain linked to customs valuation review before policy changes."
                : "This flow type does not currently affect customs valuation."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FlowPageContent({
  flow,
  fromEntity,
  toEntity,
  coverageByJurisdiction,
  relatedFindings = [],
  relatedDocuments = [],
  onRetest,
  onOpenInFactory,
  onProposePolicyChange,
}: FlowPageContentProps) {
  const [retestOpen, setRetestOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [gateReference, setGateReference] = useState<GateReference | null>(null);
  const retestPlan = useMemo(
    () => buildRetestPlan(flow, fromEntity, toEntity),
    [flow, fromEntity, toEntity],
  );

  function runRetest(payload: RunPayload): RunReference {
    const fallback = {
      id: `retest-${flow.id}`,
      href: `/runs?run=retest-${flow.id}`,
    };
    const result = onRetest?.(flow.id, payload);
    const runReference = result ?? fallback;
    setNotice(`Re-test range run created for ${flow.id}.`);
    return runReference;
  }

  function openInFactory() {
    const href = `/factory?flow=${flow.id}`;
    onOpenInFactory?.(href);
    setNotice(`${flow.id} opened in Factory.`);
  }

  function proposePolicyChange() {
    const fallback = {
      id: `governed-edit-${flow.id}`,
      href: `/verification?gate=governed-edit-${flow.id}`,
    };
    const result = onProposePolicyChange?.(flow.id);
    const reference = result ?? fallback;
    setGateReference(reference);
    setNotice(`Governed edit request created for ${flow.id}; gate is ready for review.`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xl font-semibold">
              <span>{fromEntity.name}</span>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span>{toEntity.name}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {flow.kind}
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                {flow.method}
              </Badge>
              <Badge variant="outline" className={cn("text-xs capitalize", STATUS_COLORS[flow.status])}>
                {flow.status}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {formatMoney(flow.exposure, flow.currency)} exposure
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRetestOpen(true)} variant="outline" className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Re-test range
            </Button>
            <Button onClick={openInFactory} variant="outline" className="gap-1.5">
              <Factory className="h-4 w-4" />
              Open in Factory
            </Button>
            <Button onClick={proposePolicyChange} variant="outline" className="gap-1.5">
              <GitPullRequest className="h-4 w-4" />
              Propose policy change
            </Button>
          </div>
        </div>

        {notice && (
          <Alert role="status">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {gateReference && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Governed edit request created. Policy remains unchanged until the gate clears.</span>
            </div>
            <a
              href={gateReference.href}
              className="font-medium text-primary underline underline-offset-2"
            >
              Open gate {gateReference.id}
            </a>
          </div>
        )}
      </div>

      <Separator />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <PolicyObservedPanel flow={flow} />
          <AgreementCard flow={flow} documents={relatedDocuments} />
          <CoverageCard coverageByJurisdiction={coverageByJurisdiction} />
        </div>
        <div className="space-y-4">
          <BenchmarkCard flow={flow} documents={relatedDocuments} />
          <FindingsOnFlow findings={relatedFindings} />
          <CustomsLinkageCard flow={flow} />
        </div>
      </div>

      <PlanConfirmationModal
        open={retestOpen}
        plan={retestPlan}
        onRun={runRetest}
        onCancel={() => setRetestOpen(false)}
      />
    </div>
  );
}
