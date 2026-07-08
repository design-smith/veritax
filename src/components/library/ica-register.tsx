"use client";

import { format, parseISO } from "date-fns";
import { AlertTriangle, FileText, Plus } from "lucide-react";
import { DataTable, type Column } from "@/components/patterns/pat-8-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AgreementStatus = "executed" | "expired" | "missing" | "draft-only";

export interface ICAgreement {
  id: string;
  name: string;
  status: AgreementStatus;
  parties: string[];
  renewalDate: string | null;
  linkedFlowIds: string[];
  isGapRow?: boolean;
}

interface ICARegisterProps {
  agreements: ICAgreement[];
  onDraftRenewal: (agreementId: string) => void;
  onRequestExecution: (agreementId: string) => void;
  onOpen: (agreementId: string) => void;
  onCreateDraft?: (flowId: string) => void;
  className?: string;
}

const STATUS_CONFIG: Record<AgreementStatus, { label: string; cls: string }> = {
  executed: { label: "Executed", cls: "border-transparent bg-success-soft text-success-soft-foreground" },
  expired: { label: "Expired", cls: "border-transparent bg-danger-soft text-danger-soft-foreground" },
  missing: { label: "Missing", cls: "border-transparent bg-warning-soft text-warning-soft-foreground" },
  "draft-only": { label: "Draft only", cls: "border-transparent bg-info-soft text-info-soft-foreground" },
};

function renewalLabel(agreement: ICAgreement) {
  if (!agreement.renewalDate) return "No renewal date";
  return format(parseISO(agreement.renewalDate), "dd MMM yyyy");
}

export function ICARegister({
  agreements,
  onDraftRenewal,
  onRequestExecution,
  onOpen,
  onCreateDraft,
  className,
}: ICARegisterProps) {
  const counts = agreements.reduce<Record<AgreementStatus, number>>(
    (acc, agreement) => {
      acc[agreement.status] = (acc[agreement.status] ?? 0) + 1;
      return acc;
    },
    { executed: 0, expired: 0, missing: 0, "draft-only": 0 },
  );

  const columns: Column<ICAgreement>[] = [
    {
      key: "agreement",
      header: "Agreement",
      sortable: true,
      render: (agreement) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {agreement.isGapRow ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning-soft-foreground" />
            ) : (
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate text-sm font-medium">
              {agreement.isGapRow ? "Flow without agreement" : agreement.name}
            </span>
          </div>
          {agreement.isGapRow && <p className="text-xs text-muted-foreground">{agreement.name}</p>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (agreement) => (
        <Badge variant="outline" className={cn("text-xs", STATUS_CONFIG[agreement.status].cls)}>
          {STATUS_CONFIG[agreement.status].label}
        </Badge>
      ),
    },
    {
      key: "counterparties",
      header: "Counterparties",
      render: (agreement) => <span className="text-xs text-muted-foreground">{agreement.parties.join(" -> ")}</span>,
    },
    {
      key: "renewal",
      header: "Renewal date",
      sortable: true,
      render: (agreement) => (
        <span className={cn("text-xs text-muted-foreground", agreement.status === "expired" && "font-medium text-danger-soft-foreground")}>
          {renewalLabel(agreement)}
        </span>
      ),
    },
    {
      key: "flows",
      header: "Linked flows",
      render: (agreement) => <span className="font-mono text-xs text-muted-foreground">{agreement.linkedFlowIds.join(", ")}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (agreement) => (
        <div className="flex flex-wrap items-center gap-1" onClick={(event) => event.stopPropagation()}>
          {agreement.isGapRow ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onCreateDraft?.(agreement.linkedFlowIds[0])}
            >
              <Plus className="h-3 w-3" />
              Create agreement draft
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onOpen(agreement.id)}>
                Open
              </Button>
              {agreement.status === "executed" && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onDraftRenewal(agreement.id)}>
                  Draft renewal
                </Button>
              )}
              {(agreement.status === "expired" || agreement.status === "missing") && (
                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onRequestExecution(agreement.id)}>
                  Request execution
                </Button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap gap-3">
        {(["executed", "expired", "missing", "draft-only"] as AgreementStatus[]).map((status) => (
          <div key={status} className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="text-xl font-semibold tabular-nums" data-testid={`rollup-${status}`}>
              {counts[status]}
            </p>
            <p className="text-xs text-muted-foreground">{STATUS_CONFIG[status].label}</p>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={agreements}
        onRowOpen={(agreement) => onOpen(agreement.id)}
        enableFiltering
        enableDensity
        shareBasePath="/library?tab=ica"
      />
    </div>
  );
}
