"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/patterns/pat-8-data-table";
import type { Column } from "@/components/patterns/pat-8-data-table";
import type { Finding } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const SEVERITY_VARIANTS: Record<Finding["severity"], string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
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
  onRowOpen: (finding: Finding) => void;
  onRowSelect?: (findings: Finding[]) => void;
  className?: string;
}

export function FindingsList({ findings, onRowOpen, onRowSelect, className }: FindingsListProps) {
  const sorted = useMemo(
    () => [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    [findings]
  );

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
          <p className="text-xl font-semibold tabular-nums" data-testid="rollup-exposure">
            {formatExposure(totalExposure)}
          </p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-xs text-muted-foreground">Currencies</p>
          <p className="text-sm font-medium">
            {[...new Set(findings.map((f) => f.currency))].join(", ")}
          </p>
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
