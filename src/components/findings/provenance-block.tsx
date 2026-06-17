"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ComparisonSpan {
  label: string;
  text: string;
  docName: string;
  section: string;
}

interface ProvenanceBlockProps {
  ruleId: string;
  ruleDescription: string;
  extractorVersion: string;
  modelVersion: string;
  confidence: number;
  calibrationNote?: string;
  comparisonSpans?: ComparisonSpan[];
  className?: string;
}

export function ProvenanceBlock({
  ruleId,
  ruleDescription,
  extractorVersion,
  modelVersion,
  confidence,
  calibrationNote,
  comparisonSpans = [],
  className,
}: ProvenanceBlockProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn("rounded-lg border border-border bg-muted/20 p-4 space-y-3", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">{ruleId}</Badge>
            <span className="text-sm text-foreground">{ruleDescription}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1 text-xs">
              Extractor <span className="font-mono">{extractorVersion}</span>
            </Badge>
            <Badge variant="secondary" className="gap-1 text-xs">
              Model <span className="font-mono">{modelVersion}</span>
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Confidence:</span>
        <span className="font-semibold">{Math.round(confidence * 100)}%</span>
        {calibrationNote && (
          <span className="text-xs text-muted-foreground">— {calibrationNote}</span>
        )}
      </div>

      {comparisonSpans.length > 0 && (
        <>
          <Separator />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Why am I seeing this?
          </Button>

          {expanded && (
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${comparisonSpans.length}, 1fr)` }}>
              {comparisonSpans.map((span) => (
                <div key={span.label} className="rounded-md border border-border bg-background p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{span.label}</Badge>
                    <span className="text-xs text-muted-foreground">{span.docName} · {span.section}</span>
                  </div>
                  <p className="text-xs italic text-foreground">&quot;{span.text}&quot;</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
