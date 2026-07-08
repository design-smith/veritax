"use client";

import { ArrowLeft, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Document } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const CUSTODY_STYLES: Record<Document["custody"], string> = {
  materialized: "border-transparent bg-success-soft text-success-soft-foreground",
  "extract-only": "border-transparent bg-info-soft text-info-soft-foreground",
  reference: "border-border text-muted-foreground",
};

const SENSITIVITY_STYLES: Record<Document["sensitivity"], string> = {
  standard: "",
  sensitive: "border-transparent bg-warning-soft text-warning-soft-foreground",
  privileged: "border-transparent bg-danger-soft text-danger-soft-foreground",
};

interface ViewerHeaderProps {
  document: Document;
  onBack: () => void;
  originLabel?: string;
  className?: string;
}

export function ViewerHeader({ document, onBack, originLabel, className }: ViewerHeaderProps) {
  const hashShort = document.hash.slice(0, 20) + "…";

  return (
    <div className={cn("flex flex-col gap-2 border-b border-border bg-background px-4 py-3", className)}>
      {/* Breadcrumb */}
      {originLabel && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-fit gap-1.5 px-1 text-xs text-muted-foreground"
          onClick={onBack}
          aria-label={`Return to ${originLabel}`}
        >
          <ArrowLeft className="h-3 w-3" />
          {originLabel}
        </Button>
      )}

      {/* Document name + meta */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold leading-tight truncate">{document.name}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn("text-[10px]", CUSTODY_STYLES[document.custody])}>
              {document.custody}
            </Badge>
            {document.sensitivity !== "standard" && (
              <Badge variant="outline" className={cn("text-[10px]", SENSITIVITY_STYLES[document.sensitivity])}>
                {document.sensitivity}
              </Badge>
            )}
            <span className="flex items-center gap-0.5 font-mono text-[10px] text-muted-foreground">
              <Hash className="h-2.5 w-2.5" />
              {hashShort}
            </span>
            <span className="text-[10px] text-muted-foreground">{document.sourcePath}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
