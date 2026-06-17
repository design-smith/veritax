"use client";

import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { AlertTriangle, FileText } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface CitationChipProps {
  docName: string;
  section: string;
  confidence: number;
  extractorVersion: string;
  snippet?: string;
  isQuarantined?: boolean;
  onNavigate?: () => void;
  className?: string;
}

export function CitationChip({
  docName,
  section,
  confidence,
  extractorVersion,
  snippet,
  isQuarantined = false,
  onNavigate,
  className,
}: CitationChipProps) {
  if (isQuarantined) {
    return (
      <span
        title="No source found — excluded from export"
        className={cn(
          "inline-flex cursor-not-allowed items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300",
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
          onClick={onNavigate}
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
