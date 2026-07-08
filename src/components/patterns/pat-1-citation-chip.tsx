"use client";

import { useEffect } from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { AlertTriangle, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { TelemetryObjectRef } from "@/lib/telemetry/metadata-telemetry";
import {
  createCitationOpenedEvent,
  createQuarantinedClaimRenderedEvent,
  DEMO_FRONTEND_TELEMETRY_CONTEXT,
  recordFrontendTelemetryEvent,
} from "@/lib/telemetry/product-telemetry";
import { cn } from "@/lib/utils";

interface CitationChipProps {
  docName: string;
  section: string;
  confidence: number;
  extractorVersion: string;
  snippet?: string;
  documentId?: string;
  spanId?: string;
  returnTo?: string;
  isQuarantined?: boolean;
  telemetrySurface?: string;
  telemetryObjectRef?: TelemetryObjectRef;
  onNavigate?: (href?: string) => void;
  className?: string;
}

function buildCitationHref(documentId?: string, spanId?: string, returnTo?: string) {
  if (!documentId) return undefined;
  const params = new URLSearchParams();
  if (spanId) params.set("span", spanId);
  if (returnTo) params.set("returnTo", returnTo);
  const query = params.toString();
  return `/library/${encodeURIComponent(documentId)}${query ? `?${query}` : ""}`;
}

export function CitationChip({
  docName,
  section,
  confidence,
  extractorVersion,
  snippet,
  documentId,
  spanId,
  returnTo,
  isQuarantined = false,
  telemetrySurface = "unknown",
  telemetryObjectRef,
  onNavigate,
  className,
}: CitationChipProps) {
  const href = buildCitationHref(documentId, spanId, returnTo);
  const citationId = spanId ?? documentId ?? "citation";

  useEffect(() => {
    if (!isQuarantined) return;

    recordFrontendTelemetryEvent(
      createQuarantinedClaimRenderedEvent({
        ...DEMO_FRONTEND_TELEMETRY_CONTEXT,
        surface: telemetrySurface,
        objectRef: telemetryObjectRef,
        claimClass: "missing-source",
      }),
    );
  }, [citationId, isQuarantined, telemetryObjectRef, telemetrySurface]);

  function handleCitationOpen() {
    recordFrontendTelemetryEvent(
      createCitationOpenedEvent({
        ...DEMO_FRONTEND_TELEMETRY_CONTEXT,
        surface: telemetrySurface,
        objectRef: telemetryObjectRef,
        citationId,
      }),
    );
    onNavigate?.(href);
  }

  if (isQuarantined) {
    return (
      <span
        title="No source found — excluded from export"
        className={cn(
          "inline-flex cursor-not-allowed items-center gap-1 rounded border border-warning/25 bg-warning-soft px-1.5 py-0.5 text-xs text-warning-soft-foreground dark:border-warning/30 dark:bg-warning-soft dark:text-warning-soft-foreground",
          className,
        )}
      >
        <AlertTriangle className="h-3 w-3" />
        <span className="font-mono">no source</span>
      </span>
    );
  }

  return (
    <HoverCardPrimitive.Root openDelay={200} closeDelay={100}>
      <HoverCardPrimitive.Trigger asChild>
        <button
          aria-label="citation"
          onClick={handleCitationOpen}
          className={cn(
            "inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-xs text-primary transition-colors hover:bg-primary/10",
            className,
          )}
        >
          <FileText className="h-3 w-3 shrink-0" />
          <span className="font-medium">{docName}</span>
          <span className="text-primary/60">·</span>
          <span className="font-mono">{section}</span>
        </button>
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          side="top"
          align="start"
          className="z-50 w-80 rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        >
          <div className="p-3">
            <p className="text-xs font-semibold">{docName}</p>
            <p className="text-xs text-muted-foreground">{section}</p>
          </div>
          {snippet && (
            <>
              <Separator />
              <div className="p-3">
                <p className="line-clamp-3 text-xs italic text-muted-foreground">&quot;{snippet}&quot;</p>
              </div>
            </>
          )}
          <Separator />
          <div className="flex items-center justify-between p-2 text-[11px] text-muted-foreground">
            <span>
              Confidence:{" "}
              <span className="font-medium text-foreground">
                {Math.round(confidence * 100)}%
              </span>
            </span>
            <span>
              Extractor: <span className="font-mono">{extractorVersion}</span>
            </span>
          </div>
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}
