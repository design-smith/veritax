"use client";

import { useState } from "react";
import { BookOpen, Copy, Eye, ExternalLink, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CitationChip } from "@/components/patterns/pat-1-citation-chip";
import { cn } from "@/lib/utils";
import type { Finding } from "@/lib/mock/types";

export interface Exhibit {
  id: string;
  docName: string;
  section: string;
  snippet: string;
  confidence: number;
  extractorVersion: string;
  href?: string;
}

interface FindingDetailInspectorProps {
  finding: Finding;
  exhibits: Exhibit[];
  onClose: () => void;
  onOpenAllInViewer?: () => void;
  className?: string;
}

const SEVERITY_VARIANTS: Record<Finding["severity"], "default" | "secondary" | "destructive" | "warning"> = {
  critical: "destructive",
  high: "warning",
  medium: "secondary",
  low: "outline" as "secondary",
};

const STATUS_LABELS: Record<Finding["status"], string> = {
  detected: "Detected",
  triaged: "Triaged",
  "in-remediation": "In remediation",
  reviewed: "Reviewed",
  resolved: "Resolved",
  "verify-next-cycle": "Verify next cycle",
};

function formatExposure(amount: number): string {
  return amount.toLocaleString("en-US");
}

export function FindingDetailInspector({
  finding,
  exhibits,
  onClose,
  onOpenAllInViewer,
  className,
}: FindingDetailInspectorProps) {
  const [watching, setWatching] = useState(false);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{finding.id}</span>
            <Badge variant={SEVERITY_VARIANTS[finding.severity]} className="text-xs capitalize">
              {finding.severity}
            </Badge>
            <Badge variant="outline" className="text-xs">{STATUS_LABELS[finding.status]}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Watch"
            onClick={() => setWatching((w) => !w)}
          >
            <Star className={cn("h-4 w-4", watching && "fill-amber-400 text-amber-400")} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Copy link"
            onClick={() => navigator.clipboard?.writeText(`/findings/${finding.id}`)}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Close" onClick={onClose}>
            <span aria-hidden>×</span>
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto space-y-5 px-5 py-4">
        {/* Narrative */}
        <div className="space-y-2">
          <h3 className="text-base font-semibold">{finding.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{finding.summary}</p>
        </div>

        <Separator />

        {/* Exposure card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Exposure</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{formatExposure(finding.exposure)}</span>
            <span className="text-sm text-muted-foreground">{finding.currency}</span>
          </div>
          <p className="text-xs text-muted-foreground">Methodology note — see provenance for lineage</p>
        </div>

        <Separator />

        {/* Exhibits */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Exhibits ({exhibits.length})
            </p>
            {exhibits.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 px-2.5 text-xs"
                onClick={onOpenAllInViewer}
              >
                <BookOpen className="h-3.5 w-3.5" />
                Open all in Viewer
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {exhibits.map((exhibit) => (
              <div
                key={exhibit.id}
                className="rounded-md border border-border bg-muted/20 p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <CitationChip
                    docName={exhibit.docName}
                    section={exhibit.section}
                    confidence={exhibit.confidence}
                    extractorVersion={exhibit.extractorVersion}
                    snippet={exhibit.snippet}
                  />
                  {exhibit.href && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" asChild>
                      <a href={exhibit.href} aria-label="Open in viewer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
                <p className="text-xs italic text-muted-foreground line-clamp-2">&quot;{exhibit.snippet}&quot;</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
