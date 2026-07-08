"use client";

import { useState } from "react";
import { BookOpen, ExternalLink, Star } from "lucide-react";
import { CopyLinkButton } from "@/components/patterns/copy-link-button";
import { CitationChip } from "@/components/patterns/pat-1-citation-chip";
import { ProvenanceChip } from "@/components/patterns/pat-2-provenance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Finding } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

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
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{finding.id}</span>
            <Badge variant={SEVERITY_VARIANTS[finding.severity]} className="text-xs capitalize">
              {finding.severity}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {STATUS_LABELS[finding.status]}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            aria-label="Watch"
            onClick={() => setWatching((value) => !value)}
          >
            <Star className={cn("h-4 w-4", watching && "fill-warning text-warning-soft-foreground")} />
          </Button>
          <CopyLinkButton target={{ type: "finding", id: finding.id }} className="h-7 w-7" />
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Close" onClick={onClose}>
            <span aria-hidden>x</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div className="space-y-2">
          <h3 className="text-base font-semibold">{finding.title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{finding.summary}</p>
          {exhibits.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {exhibits.slice(0, 2).map((exhibit) => (
                <CitationChip
                  key={`narrative-${exhibit.id}`}
                  docName={exhibit.docName}
                  section={exhibit.section}
                  confidence={exhibit.confidence}
                  extractorVersion={exhibit.extractorVersion}
                  snippet={exhibit.snippet}
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Exposure</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold">{formatExposure(finding.exposure)}</span>
            <span className="text-sm text-muted-foreground">{finding.currency}</span>
          </div>
          <ProvenanceChip
            asOf="2024-12-31"
            source={`${finding.ruleId} exposure calculation`}
            hops={[
              { label: `${finding.flowId} observed amount`, type: "ledger-line" },
              { label: "severity and exposure mapping", type: "mapping" },
              { label: "finding exposure", type: "metric" },
            ]}
          />
          <p className="text-xs text-muted-foreground">Methodology note - see provenance for lineage</p>
        </div>

        <Separator />

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
              <div key={exhibit.id} className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
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
                <p className="line-clamp-2 text-xs italic text-muted-foreground">
                  &quot;{exhibit.snippet}&quot;
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
