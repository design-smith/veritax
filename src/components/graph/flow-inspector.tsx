"use client";

import { ArrowRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CopyLinkButton } from "@/components/patterns/copy-link-button";
import type { Entity, Flow } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<Flow["status"], string> = {
  verified: "border-transparent bg-success-soft text-success-soft-foreground",
  drift:    "border-transparent bg-warning-soft text-warning-soft-foreground",
  exception:"border-transparent bg-danger-soft text-danger-soft-foreground",
};

interface FlowInspectorProps {
  flow: Flow;
  fromEntity: Entity;
  toEntity: Entity;
  onClose: () => void;
  className?: string;
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

export function FlowInspector({ flow, fromEntity, toEntity, onClose, className }: FlowInspectorProps) {
  const delta = flow.observedRate - flow.policyRate;
  const deltaSign = delta > 0 ? "+" : "";

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap text-sm font-semibold">
            <span className="truncate max-w-[120px]">{fromEntity.name}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate max-w-[120px]">{toEntity.name}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-xs">{flow.kind}</Badge>
            <Badge variant="outline" className="text-xs font-mono">{flow.method}</Badge>
            <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[flow.status])}>
              {flow.status}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CopyLinkButton target={{ type: "flow", id: flow.id }} className="h-7 w-7" />
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Close" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Policy vs Observed */}
      <div className="p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Policy vs Observed</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">Policy rate</p>
            <p className="text-lg font-semibold">{pct(flow.policyRate)}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground mb-1">Observed rate</p>
            <p className={cn("text-lg font-semibold", flow.status === "exception" ? "text-danger-soft-foreground" : "")}>
              {pct(flow.observedRate)}
            </p>
          </div>
        </div>

        <div className={cn("rounded-md border p-2 text-xs", STATUS_COLORS[flow.status])}>
          Delta: <span className="font-semibold">{deltaSign}{pct(delta)}</span>
          {" "}— status: <span className="font-semibold">{flow.status}</span>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div>
            <p className="mb-0.5">Exposure</p>
            <p className="font-medium text-foreground">
              {flow.exposure.toLocaleString()} <span className="text-muted-foreground">{flow.currency}</span>
            </p>
          </div>
          <div>
            <p className="mb-0.5">Agreement</p>
            <p className="font-medium text-foreground">{flow.agreementId ?? "None found"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
