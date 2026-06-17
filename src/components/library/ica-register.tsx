"use client";

import { format, parseISO } from "date-fns";
import { AlertTriangle, FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
  executed:   { label: "Executed",   cls: "border-green-300 bg-green-50 text-green-700" },
  expired:    { label: "Expired",    cls: "border-red-300 bg-red-50 text-red-700" },
  missing:    { label: "Missing",    cls: "border-amber-300 bg-amber-50 text-amber-700" },
  "draft-only": { label: "Draft only", cls: "border-blue-300 bg-blue-50 text-blue-700" },
};

export function ICARegister({
  agreements,
  onDraftRenewal,
  onRequestExecution,
  onOpen,
  onCreateDraft,
  className,
}: ICARegisterProps) {
  const counts = agreements.reduce<Record<AgreementStatus, number>>(
    (acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; return acc; },
    { executed: 0, expired: 0, missing: 0, "draft-only": 0 },
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Rollup header */}
      <div className="flex flex-wrap gap-4">
        {(["executed", "expired", "missing", "draft-only"] as AgreementStatus[]).map((s) => (
          <div key={s} className={cn("rounded-lg border px-3 py-2 text-center", STATUS_CONFIG[s].cls)}>
            <p
              className="text-xl font-semibold"
              data-testid={`rollup-${s}`}
            >
              {counts[s]}
            </p>
            <p className="text-xs">{STATUS_CONFIG[s].label}</p>
          </div>
        ))}
      </div>

      <Separator />

      {/* Rows */}
      <div className="space-y-2">
        {agreements.map((ag) => {
          const { label, cls } = STATUS_CONFIG[ag.status];

          if (ag.isGapRow) {
            return (
              <div
                key={ag.id}
                className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Flow without agreement
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      {ag.parties.join(" ↔ ")} — flows: {ag.linkedFlowIds.join(", ")}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => onCreateDraft?.(ag.linkedFlowIds[0])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create agreement draft
                </Button>
              </div>
            );
          }

          return (
            <div
              key={ag.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{ag.name}</span>
                  <Badge variant="outline" className={cn("text-xs shrink-0", cls)}>
                    {label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ag.parties.join(" ↔ ")}
                  {ag.renewalDate && (
                    <span className={cn("ml-2", ag.status === "expired" ? "text-destructive font-medium" : "")}>
                      · Renewal: {format(parseISO(ag.renewalDate), "dd MMM yyyy")}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                  onClick={() => onOpen(ag.id)}>
                  Open
                </Button>
                {ag.status === "executed" && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                    onClick={() => onDraftRenewal(ag.id)}>
                    Draft renewal
                  </Button>
                )}
                {(ag.status === "expired" || ag.status === "missing") && (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                    onClick={() => onRequestExecution(ag.id)}>
                    Request execution
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
