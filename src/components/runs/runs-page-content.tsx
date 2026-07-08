"use client";

import { useMemo, useState } from "react";
import { RunsDrawer } from "@/components/runs/runs-drawer";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockRuns } from "@/lib/mock";
import type { Run } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

type OutputReviewState = "staged" | "promoted" | "changes-requested";

type ReviewableRun = Run & {
  outputReviews?: Record<string, OutputReviewState>;
};

interface ScheduledWatcher {
  id: string;
  name: string;
  scope: string;
  cadence: string;
  lastResult: string;
  status: "active" | "paused";
}

const STATUS_CLASSES: Record<Run["status"], string> = {
  queued: "border-border text-muted-foreground",
  running: "border-transparent bg-info-soft text-info-soft-foreground",
  done: "border-transparent bg-success-soft text-success-soft-foreground",
  failed: "border-transparent bg-danger-soft text-danger-soft-foreground",
  cancelled: "border-transparent bg-warning-soft text-warning-soft-foreground",
};

const INITIAL_WATCHERS: ScheduledWatcher[] = [
  {
    id: "watcher-benchmark",
    name: "Benchmark refresh watcher",
    scope: "CUT comparables - royalty",
    cadence: "Weekly, Monday 06:00",
    lastResult: "Last run failed at license database connection",
    status: "active",
  },
  {
    id: "watcher-local-file",
    name: "Local file freshness watcher",
    scope: "FY2024 local files with open citations",
    cadence: "Daily, 07:30",
    lastResult: "No stale sections found",
    status: "active",
  },
];

function createInitialRuns(): ReviewableRun[] {
  const [icScan, localFile, benchmarkRefresh] = mockRuns;

  return [
    {
      ...icScan,
      steps: icScan.steps.map((step) =>
        step.id === "r1s2"
          ? {
              ...step,
              toolCalls: [
                {
                  tool: "agreement-reader",
                  inputs: { corpusVersion: icScan.corpusVersion, scope: icScan.scope },
                  outputs: { agreementsRead: 8 },
                },
                {
                  tool: "flow-normalizer",
                  inputs: { rulepackVersion: icScan.rulepackVersion },
                  outputs: { normalizedFlows: 12 },
                },
              ],
            }
          : step,
      ),
    },
    {
      ...localFile,
      outputReviews: Object.fromEntries(localFile.outputs.map((output) => [output.id, "staged" as const])),
    },
    benchmarkRefresh,
    {
      id: "r4",
      stage: "range-retest",
      scope: "UK royalty range - watcher retry",
      initiator: "watcher",
      initiatorId: "u2",
      status: "running",
      steps: [
        { id: "r4s1", name: "Load accepted comparables", status: "done", durationMs: 900 },
        { id: "r4s2", name: "Retest interquartile range", status: "running" },
      ],
      outputs: [],
      corpusVersion: "v.419",
      rulepackVersion: "rp-2024.11",
      modelVersion: "claude-sonnet-4-6",
      costClass: "fast",
      startedAt: "2025-11-22T10:10:00Z",
    },
  ];
}

function formatInitiator(run: Run) {
  if (run.initiator === "watcher") return "Watcher";
  if (run.initiator === "system") return "System";
  return "User";
}

function matchesFilter(run: Run, status: string, stage: string, initiator: string, query: string) {
  const queryText = query.trim().toLowerCase();

  return (
    (status === "all" || run.status === status) &&
    (stage === "all" || run.stage === stage) &&
    (initiator === "all" || run.initiator === initiator) &&
    (!queryText ||
      run.stage.toLowerCase().includes(queryText) ||
      run.scope.toLowerCase().includes(queryText) ||
      run.id.toLowerCase().includes(queryText))
  );
}

export function RunsPageContent() {
  const [runs, setRuns] = useState<ReviewableRun[]>(() => createInitialRuns());
  const [watchers, setWatchers] = useState<ScheduledWatcher[]>(INITIAL_WATCHERS);
  const [editingWatcherId, setEditingWatcherId] = useState<string | null>(null);
  const [draftWatcherScope, setDraftWatcherScope] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [initiatorFilter, setInitiatorFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [notice, setNotice] = useState("Runs ready for review.");

  const selectedRun = runs.find((run) => run.id === selectedRunId);

  const stageOptions = useMemo(() => Array.from(new Set(runs.map((run) => run.stage))), [runs]);
  const filteredRuns = runs.filter((run) => matchesFilter(run, statusFilter, stageFilter, initiatorFilter, query));

  function reviewOutput(runId: string, outputId: string, reviewState: OutputReviewState) {
    setRuns((currentRuns) =>
      currentRuns.map((run) =>
        run.id === runId
          ? {
              ...run,
              outputReviews: {
                ...run.outputReviews,
                [outputId]: reviewState,
              },
            }
          : run,
      ),
    );

    setNotice(
      reviewState === "promoted"
        ? "Output promoted to the record and ready for downstream gates."
        : "Output sent back for changes before it can enter the record.",
    );
  }

  function cancelRun(runId: string) {
    setRuns((currentRuns) =>
      currentRuns.map((run) =>
        run.id === runId
          ? {
              ...run,
              status: "cancelled",
              steps: run.steps.map((step) =>
                step.status === "running" || step.status === "queued" ? { ...step, status: "failed" } : step,
              ),
            }
          : run,
      ),
    );

    const cancelledRun = runs.find((run) => run.id === runId);
    setNotice(`${cancelledRun?.stage ?? "Run"} cancelled; outputs and pins remain on the record.`);
  }

  function createEditedRerun(runId: string, instructions: string) {
    const sourceRun = runs.find((run) => run.id === runId);
    if (!sourceRun) return;

    const rerun: ReviewableRun = {
      ...sourceRun,
      id: `${sourceRun.id}-edited-${Date.now()}`,
      stage: `${sourceRun.stage} edited rerun`,
      status: "queued",
      scope: `${sourceRun.scope} - edited instructions`,
      initiator: "user",
      steps: [
        {
          id: `${sourceRun.id}-edited-queue`,
          name: "Queue edited run",
          status: "queued",
        },
      ],
      outputs: [],
      outputReviews: {},
      startedAt: new Date().toISOString(),
    };

    setRuns((currentRuns) => [rerun, ...currentRuns]);
    setSelectedRunId(rerun.id);
    setStatusFilter("all");
    setNotice(`Edited rerun queued with instructions: ${instructions.trim()}`);
  }

  function toggleWatcher(watcherId: string) {
    setWatchers((currentWatchers) =>
      currentWatchers.map((watcher) =>
        watcher.id === watcherId
          ? { ...watcher, status: watcher.status === "active" ? "paused" : "active" }
          : watcher,
      ),
    );
  }

  function startEditingWatcher(watcher: ScheduledWatcher) {
    setEditingWatcherId(watcher.id);
    setDraftWatcherScope(watcher.scope);
  }

  function saveWatcherScope(watcherId: string) {
    setWatchers((currentWatchers) =>
      currentWatchers.map((watcher) =>
        watcher.id === watcherId ? { ...watcher, scope: draftWatcherScope.trim() || watcher.scope } : watcher,
      ),
    );
    setEditingWatcherId(null);
    setNotice("Watcher scope updated and ready for the next scheduled run.");
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden bg-background">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
              <p className="text-sm text-muted-foreground">
                Review processes, trace their evidence, and promote staged outputs into the record.
              </p>
            </div>
            <div role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
              {notice}
            </div>
          </div>
        </div>

        <Tabs defaultValue="history" className="flex min-h-0 flex-1 flex-col px-6 py-4">
          <TabsList className="w-fit">
            <TabsTrigger value="history">Run history</TabsTrigger>
            <TabsTrigger value="watchers">Scheduled watchers</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="min-h-0 flex-1 overflow-hidden">
            <div className="grid h-full grid-rows-[auto_1fr] gap-3">
              <div className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 xl:grid-cols-[160px_190px_160px_1fr]">
                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  <span>Status</span>
                  <select
                    className="h-8 w-full rounded-md border border-input bg-surface px-2 text-sm text-foreground"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="queued">Queued</option>
                    <option value="running">Running</option>
                    <option value="done">Done</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  <span>Stage</span>
                  <select
                    className="h-8 w-full rounded-md border border-input bg-surface px-2 text-sm text-foreground"
                    value={stageFilter}
                    onChange={(event) => setStageFilter(event.target.value)}
                  >
                    <option value="all">All stages</option>
                    {stageOptions.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  <span>Initiator</span>
                  <select
                    className="h-8 w-full rounded-md border border-input bg-surface px-2 text-sm text-foreground"
                    value={initiatorFilter}
                    onChange={(event) => setInitiatorFilter(event.target.value)}
                  >
                    <option value="all">All initiators</option>
                    <option value="user">User</option>
                    <option value="watcher">Watcher</option>
                    <option value="system">System</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs font-medium text-muted-foreground">
                  <span>Scope search</span>
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stage, scope, or id" />
                </label>
              </div>

              <div className="min-h-0 overflow-auto rounded-lg border border-border bg-card">
                <div className="grid grid-cols-[1.2fr_1fr_120px_120px_100px] border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Process</span>
                  <span>Scope</span>
                  <span>Status</span>
                  <span>Initiator</span>
                  <span>Cost</span>
                </div>
                <div className="divide-y divide-border">
                  {filteredRuns.map((run) => (
                    <button
                      key={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                      className={cn(
                        "grid w-full grid-cols-[1.2fr_1fr_120px_120px_100px] items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                        selectedRunId === run.id && "bg-primary-soft",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{run.stage}</span>
                        <span className="block font-mono text-xs text-muted-foreground">{run.id}</span>
                      </span>
                      <span className="truncate text-muted-foreground">{run.scope}</span>
                      <span>
                        <Badge variant="outline" className={cn("text-xs", STATUS_CLASSES[run.status])}>
                          {run.status}
                        </Badge>
                      </span>
                      <span className="text-muted-foreground">{formatInitiator(run)}</span>
                      <span className="capitalize text-muted-foreground">{run.costClass}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="watchers" className="min-h-0 flex-1 overflow-auto">
            <div className="grid gap-3 xl:grid-cols-2">
              {watchers.map((watcher) => (
                <article
                  key={watcher.id}
                  aria-label={watcher.name}
                  className="rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold">{watcher.name}</h2>
                      <p className="mt-1 text-xs text-muted-foreground">{watcher.cadence}</p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {watcher.status}
                    </Badge>
                  </div>

                  {editingWatcherId === watcher.id ? (
                    <div className="mt-4 space-y-3">
                      <label className="space-y-1 text-xs font-medium text-muted-foreground">
                        <span>Watcher scope</span>
                        <Input value={draftWatcherScope} onChange={(event) => setDraftWatcherScope(event.target.value)} />
                      </label>
                      <button
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                        onClick={() => saveWatcherScope(watcher.id)}
                      >
                        Save watcher scope
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm">{watcher.scope}</p>
                      <p className="text-xs text-muted-foreground">{watcher.lastResult}</p>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                      onClick={() => toggleWatcher(watcher.id)}
                    >
                      {watcher.status === "active" ? "Pause watcher" : "Resume watcher"}
                    </button>
                    <button
                      className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                      onClick={() => startEditingWatcher(watcher)}
                    >
                      Edit scope
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {selectedRun ? (
        <aside aria-label="Run details" className="w-[26rem] shrink-0 overflow-hidden border-l border-border">
          <RunsDrawer
            run={selectedRun}
            outputReviews={selectedRun.outputReviews}
            onApproveOutput={(outputId) => reviewOutput(selectedRun.id, outputId, "promoted")}
            onRequestOutputChanges={(outputId) => reviewOutput(selectedRun.id, outputId, "changes-requested")}
            onCancel={selectedRun.status === "queued" || selectedRun.status === "running" ? () => cancelRun(selectedRun.id) : undefined}
            onSubmitRerun={(instructions) => createEditedRerun(selectedRun.id, instructions)}
            onRerun={() => undefined}
            onClose={() => setSelectedRunId(null)}
          />
        </aside>
      ) : null}
    </div>
  );
}
