"use client";

import { AlertTriangle, ArrowRight, ChevronRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface LineageHop {
  label: string;
  type: string;
  href?: string;
}

interface ProvenanceChipProps {
  asOf: string;
  source: string;
  hops?: LineageHop[];
  isStale?: boolean;
  staleReason?: string;
  className?: string;
}

const HOP_TYPE_LABELS: Record<string, string> = {
  "ledger-line": "Ledger line",
  mapping: "Mapping",
  "entity-pl": "Entity P&L",
  segmentation: "Segmentation",
  metric: "Metric",
};

export function ProvenanceChip({
  asOf,
  source,
  hops = [],
  isStale = false,
  staleReason,
  className,
}: ProvenanceChipProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          aria-label="provenance"
          className={cn(
            "inline-flex items-center gap-1.5 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted",
            className,
          )}
        >
          <Clock className="h-3 w-3 shrink-0" />
          <span>as-of {asOf}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="font-medium text-foreground">{source}</span>
          {isStale && (
            <span
              title={staleReason ?? "Stale data"}
              className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 dark:bg-amber-600"
            >
              <AlertTriangle className="h-2.5 w-2.5 text-white" />
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Data lineage</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-1">
          <p className="text-xs text-muted-foreground mb-3">
            Source: <span className="font-medium text-foreground">{source}</span>
            {" · "}as-of <span className="font-medium text-foreground">{asOf}</span>
          </p>
          {hops.map((hop, i) => (
            <div key={hop.label} className="flex items-start gap-2">
              {i > 0 && (
                <div className="flex w-5 justify-center">
                  <ArrowRight className="h-3 w-3 text-muted-foreground/40 mt-1" />
                </div>
              )}
              {i === 0 && <div className="w-5" />}
              <div className="flex-1 rounded-md border border-border bg-card p-2">
                <p className="text-xs font-medium">{hop.label}</p>
                <Badge variant="outline" className="mt-1 text-[10px]">
                  {HOP_TYPE_LABELS[hop.type] ?? hop.type}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        {isStale && staleReason && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mb-0.5 mr-1 inline h-3 w-3" />
            {staleReason}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
