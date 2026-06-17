"use client";

import { useState } from "react";
import { RunsDrawer } from "@/components/runs/runs-drawer";
import { Badge } from "@/components/ui/badge";
import { mockRuns } from "@/lib/mock";
import { cn } from "@/lib/utils";
import type { Run } from "@/lib/mock/types";

const STATUS_COLORS: Record<Run["status"], string> = {
  queued:    "border-border text-muted-foreground",
  running:   "border-blue-300 bg-blue-50 text-blue-700",
  done:      "border-green-300 bg-green-50 text-green-700",
  failed:    "border-red-300 bg-red-50 text-red-700",
  cancelled: "border-amber-300 bg-amber-50 text-amber-700",
};

const noop = () => {};

export default function RunsPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const selectedRun = mockRuns.find((r) => r.id === selectedRunId);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* Run list */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2 px-6 py-4">
          <h1 className="text-2xl font-semibold mb-4">Runs</h1>
          {mockRuns.map((run) => (
            <button
              key={run.id}
              onClick={() => setSelectedRunId(run.id)}
              className={cn(
                "flex w-full items-start gap-4 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30",
                selectedRunId === run.id && "border-primary/30 bg-primary/5",
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{run.stage}</p>
                  <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[run.status])}>
                    {run.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{run.scope}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground font-mono">{run.id}</p>
                <p className="text-xs text-muted-foreground capitalize">{run.costClass}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Drawer panel */}
      {selectedRun && (
        <div className="w-96 shrink-0 border-l border-border overflow-hidden">
          <RunsDrawer
            run={selectedRun}
            onRerun={noop}
            onClose={() => setSelectedRunId(null)}
          />
        </div>
      )}
    </div>
  );
}
