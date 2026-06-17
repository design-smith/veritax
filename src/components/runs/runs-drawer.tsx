"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Run } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const STATUS_VARIANTS: Record<string, string> = {
  queued:    "border-border text-muted-foreground",
  running:   "border-blue-300 bg-blue-50 text-blue-700",
  done:      "border-green-300 bg-green-50 text-green-700",
  failed:    "border-red-300 bg-red-50 text-red-700",
  cancelled: "border-amber-300 bg-amber-50 text-amber-700",
};

function formatDuration(ms?: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface RunsDrawerProps {
  run: Run;
  onRerun: (runId: string) => void;
  onClose: () => void;
  className?: string;
}

export function RunsDrawer({ run, onRerun, onClose, className }: RunsDrawerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  function toggleStep(stepId: string) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) { next.delete(stepId); } else { next.add(stepId); }
      return next;
    });
  }

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold">{run.stage}</p>
            <Badge variant="outline" className={cn("text-xs", STATUS_VARIANTS[run.status])}>
              {run.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{run.scope}</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <Badge variant="secondary" className="font-mono text-[10px]">corpus {run.corpusVersion}</Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">rules {run.rulepackVersion}</Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">model {run.modelVersion}</Badge>
            <Badge variant="outline" className="text-[10px] capitalize">{run.costClass}</Badge>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto space-y-5 px-5 py-4">
        {/* Step timeline */}
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
            Steps
          </p>
          <div className="space-y-2">
            {run.steps.map((step, idx) => (
              <div key={step.id}>
                <div className="flex items-start gap-3">
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center shrink-0 mt-1">
                    <div className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold",
                      step.status === "done" ? "border-green-400 bg-green-50 text-green-700" :
                      step.status === "failed" ? "border-red-400 bg-red-50 text-red-700" :
                      "border-border bg-muted text-muted-foreground"
                    )}>
                      {idx + 1}
                    </div>
                    {idx < run.steps.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{step.name}</span>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", STATUS_VARIANTS[step.status])}>
                          {step.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatDuration(step.durationMs)}
                        </span>
                        {step.toolCalls && step.toolCalls.length > 0 && (
                          <button
                            onClick={() => toggleStep(step.id)}
                            className="text-xs text-primary hover:underline flex items-center gap-0.5"
                          >
                            {expandedSteps.has(step.id) ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            trace
                          </button>
                        )}
                      </div>
                    </div>

                    {expandedSteps.has(step.id) && step.toolCalls && (
                      <div className="mt-2 rounded-md border border-border bg-muted/30 p-2 space-y-1">
                        {step.toolCalls.map((tc, i) => (
                          <div key={i} className="text-xs font-mono text-muted-foreground">
                            <span className="text-foreground">{tc.tool}</span>
                            {" → "}
                            <span className="truncate">{JSON.stringify(tc.inputs).slice(0, 60)}…</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Outputs */}
        {run.outputs.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
              Outputs
            </p>
            <div className="space-y-2">
              {run.outputs.map((output) => (
                <div key={output.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{output.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{output.type}</p>
                  </div>
                  <a
                    href={output.objectRef}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    aria-label="Review"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Review
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Footer */}
      <div className="flex justify-end px-5 py-3">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => onRerun(run.id)}
        >
          <RefreshCw className="h-4 w-4" />
          Re-run with edits
        </Button>
      </div>
    </div>
  );
}
