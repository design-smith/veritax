"use client";

import { AlertTriangle, ArrowRight, ChevronRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { TelemetryObjectRef } from "@/lib/telemetry/metadata-telemetry";
import {
  createProvenanceOpenedEvent,
  DEMO_FRONTEND_TELEMETRY_CONTEXT,
  recordFrontendTelemetryEvent,
} from "@/lib/telemetry/product-telemetry";
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
  telemetrySurface?: string;
  telemetryObjectRef?: TelemetryObjectRef;
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
  telemetrySurface = "unknown",
  telemetryObjectRef,
  className,
}: ProvenanceChipProps) {
  function handleProvenanceOpen() {
    recordFrontendTelemetryEvent(
      createProvenanceOpenedEvent({
        ...DEMO_FRONTEND_TELEMETRY_CONTEXT,
        surface: telemetrySurface,
        objectRef: telemetryObjectRef,
        hopCount: hops.length,
      }),
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          aria-label="provenance"
          onClick={handleProvenanceOpen}
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
              className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-warning dark:bg-warning-soft"
            >
              <AlertTriangle className="h-2.5 w-2.5 text-warning-foreground" />
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle>Data lineage</SheetTitle>
          <SheetDescription>
            Trace the figure back through the record.
          </SheetDescription>
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
              {hop.href ? (
                <a
                  href={hop.href}
                  aria-label={hop.label}
                  className="flex-1 rounded-md border border-border bg-card p-2 transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring/35"
                >
                  <p className="text-xs font-medium">{hop.label}</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {HOP_TYPE_LABELS[hop.type] ?? hop.type}
                  </Badge>
                </a>
              ) : (
                <div className="flex-1 rounded-md border border-border bg-card p-2">
                  <p className="text-xs font-medium">{hop.label}</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">
                    {HOP_TYPE_LABELS[hop.type] ?? hop.type}
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>
        {isStale && staleReason && (
          <div className="mt-4 rounded-md border border-warning/25 bg-warning-soft p-2 text-xs text-warning-soft-foreground dark:border-warning/30 dark:bg-warning-soft dark:text-warning-soft-foreground">
            <AlertTriangle className="mb-0.5 mr-1 inline h-3 w-3" />
            {staleReason}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
