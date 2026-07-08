"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Run } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

type OutputReviewState = "staged" | "promoted" | "changes-requested";

const STATUS_VARIANTS: Record<string, string> = {
  queued: "border-border text-muted-foreground",
  running: "border-transparent bg-info-soft text-info-soft-foreground",
  done: "border-transparent bg-success-soft text-success-soft-foreground",
  failed: "border-transparent bg-danger-soft text-danger-soft-foreground",
  cancelled: "border-transparent bg-warning-soft text-warning-soft-foreground",
};

function formatDuration(ms?: number): string {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface RunsDrawerProps {
  run: Run;
  onRerun: (runId: string) => void;
  onClose: () => void;
  outputReviews?: Record<string, OutputReviewState>;
  onApproveOutput?: (outputId: string) => void;
  onRequestOutputChanges?: (outputId: string) => void;
  onCancel?: () => void;
  onSubmitRerun?: (instructions: string) => void;
  className?: string;
}

export function RunsDrawer({
  run,
  onRerun,
  onClose,
  outputReviews,
  onApproveOutput,
  onRequestOutputChanges,
  onCancel,
  onSubmitRerun,
  className,
}: RunsDrawerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [editingRerun, setEditingRerun] = useState(false);
  const [editInstructions, setEditInstructions] = useState("");

  function toggleStep(stepId: string) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }

  function submitEditedRerun() {
    onSubmitRerun?.(editInstructions);
    setEditInstructions("");
    setEditingRerun(false);
  }

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold">{run.stage}</p>
            <Badge variant="outline" className={cn("text-xs", STATUS_VARIANTS[run.status])}>
              {run.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{run.scope}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="font-mono text-[10px]">
              corpus {run.corpusVersion}
            </Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">
              rules {run.rulepackVersion}
            </Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">
              model {run.modelVersion}
            </Badge>
            <Badge variant="outline" className="text-[10px] capitalize">
              {run.costClass}
            </Badge>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Steps</p>
          <div className="space-y-2">
            {run.steps.map((step, idx) => (
              <div key={step.id}>
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex shrink-0 flex-col items-center">
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold",
                        step.status === "done"
                          ? "border-transparent bg-success-soft text-success-soft-foreground"
                          : step.status === "failed"
                            ? "border-transparent bg-danger-soft text-danger-soft-foreground"
                            : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {idx + 1}
                    </div>
                    {idx < run.steps.length - 1 ? <div className="mt-1 h-4 w-px flex-1 bg-border" /> : null}
                  </div>

                  <div className="min-w-0 flex-1 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium">{step.name}</span>
                        <Badge variant="outline" className={cn("shrink-0 text-[10px]", STATUS_VARIANTS[step.status])}>
                          {step.status}
                        </Badge>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{formatDuration(step.durationMs)}</span>
                        {step.toolCalls && step.toolCalls.length > 0 ? (
                          <button
                            onClick={() => toggleStep(step.id)}
                            aria-label={`Trace ${step.name}`}
                            className="flex items-center gap-0.5 text-xs text-primary hover:underline"
                          >
                            {expandedSteps.has(step.id) ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            trace
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {expandedSteps.has(step.id) && step.toolCalls ? (
                      <div className="mt-2 space-y-1 rounded-md border border-border bg-muted/30 p-2">
                        {step.toolCalls.map((toolCall, index) => (
                          <div key={`${toolCall.tool}-${index}`} className="font-mono text-xs text-muted-foreground">
                            <span className="text-foreground">{toolCall.tool}</span>
                            {" -> "}
                            <span className="truncate">{JSON.stringify(toolCall.inputs).slice(0, 60)}...</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {run.outputs.length > 0 ? (
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Outputs</p>
            <div className="space-y-2">
              {run.outputs.map((output) => {
                const reviewState = outputReviews?.[output.id];

                return (
                  <div key={output.id} className="rounded-lg border border-border bg-card px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{output.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <p className="text-xs capitalize text-muted-foreground">{output.type}</p>
                          {reviewState ? (
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {reviewState.replace("-", " ")}
                            </Badge>
                          ) : null}
                        </div>
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

                    {reviewState ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => onApproveOutput?.(output.id)}
                          disabled={reviewState === "promoted"}
                        >
                          Approve and promote {output.name}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRequestOutputChanges?.(output.id)}
                          disabled={reviewState === "promoted"}
                        >
                          Request changes
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-3 px-5 py-3">
        {editingRerun && onSubmitRerun ? (
          <div className="rounded-lg border border-border bg-card p-3">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              <span>Edit instructions</span>
              <Textarea
                value={editInstructions}
                onChange={(event) => setEditInstructions(event.target.value)}
                placeholder="Describe what should change before this run is queued again."
              />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingRerun(false)}>
                Cancel edit
              </Button>
              <Button size="sm" onClick={submitEditedRerun}>
                Run edited rerun
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          {onCancel ? (
            <Button variant="outline" onClick={onCancel}>
              Cancel run
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (onSubmitRerun) {
                setEditingRerun(true);
                return;
              }

              onRerun(run.id);
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Re-run with edits
          </Button>
        </div>
      </div>
    </div>
  );
}
