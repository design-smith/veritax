"use client";

import { useMemo } from "react";
import { ProvenanceChip } from "@/components/patterns/pat-2-provenance";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/patterns/pat-8-data-table";
import type { Column } from "@/components/patterns/pat-8-data-table";
import type { Entity, Finding, Flow, User } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const SEVERITY_VARIANTS: Record<Finding["severity"], string> = {
  critical: "bg-danger-soft text-danger-soft-foreground dark:bg-danger-soft dark:text-danger-soft-foreground",
  high: "bg-warning-soft text-warning-soft-foreground dark:bg-warning-soft dark:text-warning-soft-foreground",
  medium: "bg-info-soft text-info-soft-foreground dark:bg-info-soft dark:text-info-soft-foreground",
  low: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<Finding["status"], string> = {
  detected: "Detected",
  triaged: "Triaged",
  "in-remediation": "In remediation",
  reviewed: "Reviewed",
  resolved: "Resolved",
  "verify-next-cycle": "Verify next cycle",
};

function formatExposure(n: number) {
  return n.toLocaleString("en-US");
}

interface FindingsListProps {
  findings: Finding[];
  flows?: Flow[];
  entities?: Entity[];
  users?: User[];
  onRowOpen: (finding: Finding) => void;
  onRowSelect?: (findings: Finding[]) => void;
  className?: string;
}

function flowLabel(finding: Finding, flowById: Map<string, Flow>, entityById: Map<string, Entity>) {
  const flow = flowById.get(finding.flowId);
  if (!flow) return finding.flowId;
  const from = entityById.get(flow.fromEntityId)?.jurisdictionCode ?? flow.fromEntityId;
  const to = entityById.get(flow.toEntityId)?.jurisdictionCode ?? flow.toEntityId;
  return `${from} to ${to} ${flow.kind}`;
}

function reviewerStateLabel(state: Finding["reviewerState"]) {
  return state.replace(/-/g, " ");
}

function TrendSparkline() {
  return (
    <svg
      role="img"
      aria-label="Finding trend sparkline"
      viewBox="0 0 96 28"
      className="h-7 w-24 text-primary"
    >
      <polyline
        points="2,22 18,19 34,17 50,11 66,14 82,8 94,6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FindingsList({
  findings,
  flows = [],
  entities = [],
  users = [],
  onRowOpen,
  onRowSelect,
  className,
}: FindingsListProps) {
  const sorted = useMemo(
    () => [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    [findings]
  );
  const flowById = useMemo(() => new Map(flows.map((flow) => [flow.id, flow])), [flows]);
  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const openCount = findings.filter(
    (f) => f.status !== "resolved" && f.status !== "verify-next-cycle"
  ).length;

  const totalExposure = findings.reduce((sum, f) => sum + f.exposure, 0);

  const columns: Column<Finding>[] = [
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      render: (f) => (
        <span
          data-testid="cell-severity"
          className={cn("rounded-full px-2 py-0.5 text-xs font-semibold capitalize", SEVERITY_VARIANTS[f.severity])}
        >
          {f.severity}
        </span>
      ),
    },
    {
      key: "id",
      header: "ID",
      render: (f) => <span className="font-mono text-xs text-muted-foreground">{f.id}</span>,
    },
    {
      key: "title",
      header: "Title",
      sortable: true,
      render: (f) => <span className="text-sm font-medium line-clamp-1">{f.title}</span>,
    },
    {
      key: "flow",
      header: "Flow",
      render: (f) => <span className="text-xs text-muted-foreground">{flowLabel(f, flowById, entityById)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (f) => (
        <Badge variant="outline" className="text-xs whitespace-nowrap">
          {STATUS_LABELS[f.status]}
        </Badge>
      ),
    },
    {
      key: "exposure",
      header: "Exposure",
      render: (f) => (
        <span className="text-sm tabular-nums">
          {formatExposure(f.exposure)} <span className="text-muted-foreground text-xs">{f.currency}</span>
        </span>
      ),
    },
    {
      key: "assignee",
      header: "Assignee",
      render: (f) => (
        <span className="text-xs text-muted-foreground">
          {f.assigneeId ? userById.get(f.assigneeId)?.name ?? f.assigneeId : "Unassigned"}
        </span>
      ),
    },
    {
      key: "reviewerState",
      header: "Reviewer state",
      render: (f) => (
        <Badge variant="secondary" className="text-xs capitalize">
          {reviewerStateLabel(f.reviewerState)}
        </Badge>
      ),
    },
    {
      key: "age",
      header: "Age",
      render: (f) => <span className="text-xs text-muted-foreground">{f.age}d</span>,
    },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Rollup header */}
      <div className="flex items-center gap-6 rounded-lg border border-border bg-card px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Open findings</p>
          <p className="text-xl font-semibold" data-testid="rollup-open-count">{openCount}</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-xs text-muted-foreground">Total exposure</p>
          <div className="flex items-center gap-2">
            <p className="text-xl font-semibold tabular-nums" data-testid="rollup-exposure">
              {formatExposure(totalExposure)}
            </p>
            <ProvenanceChip
              asOf="2024-12-31"
              source="findings exposure rollup"
              hops={[
                { label: "Open finding exposures", type: "metric" },
                { label: "Rulepack severity output", type: "mapping" },
              ]}
            />
          </div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-xs text-muted-foreground">Currencies</p>
          <p className="text-sm font-medium">
            {[...new Set(findings.map((f) => f.currency))].join(", ")}
          </p>
        </div>
        <div className="ml-auto">
          <p className="text-xs text-muted-foreground">Trend</p>
          <TrendSparkline />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={sorted}
        onRowOpen={onRowOpen}
        onRowSelect={onRowSelect}
        emptyState={
          <div className="py-12 text-center text-sm text-muted-foreground">
            No findings match the current view.
          </div>
        }
      />
    </div>
  );
}
