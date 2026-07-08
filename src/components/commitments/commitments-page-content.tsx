"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Mail, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { mockCommitments, mockUsers } from "@/lib/mock";
import type { Commitment } from "@/lib/mock/types";
import {
  createCommitmentPlanApprovedEvent,
  DEMO_FRONTEND_TELEMETRY_CONTEXT,
  recordFrontendTelemetryEvent,
} from "@/lib/telemetry/product-telemetry";
import { cn } from "@/lib/utils";

type CommitmentFilter = "all" | "mine" | "by-me" | "team";

type CommitmentRecord = Commitment & {
  capturedById: string;
  sourceQuote: string;
  linkedObjectName?: string;
  planSteps?: string[];
  planInstructions?: string;
  chaseUpDraft?: string;
};

const CURRENT_USER_ID = "u3";

const PLAN_STATE_CLASSES: Record<Commitment["planState"], string> = {
  pending: "border-transparent bg-warning-soft text-warning-soft-foreground",
  approved: "border-transparent bg-success-soft text-success-soft-foreground",
  dismissed: "border-border text-muted-foreground",
  completed: "border-transparent bg-success-soft text-success-soft-foreground",
  external: "border-transparent bg-info-soft text-info-soft-foreground",
};

const SOURCE_ICONS = {
  meeting: MessageSquare,
  email: Mail,
};

function ownerName(ownerId: string) {
  return mockUsers.find((user) => user.id === ownerId)?.name ?? "Unassigned";
}

function firstName(ownerId: string) {
  return ownerName(ownerId).split(" ")[0] ?? "there";
}

function createCommitments(): CommitmentRecord[] {
  return mockCommitments.map((commitment) => {
    if (commitment.id === "cm1") {
      return {
        ...commitment,
        capturedById: "u2",
        sourceQuote: "We need the royalty comparables refreshed before year-end so the UK file is not blocked.",
        linkedObjectName: "CUT Benchmark Study - Software Royalties FY2022",
        planInstructions: "Refresh CUT comparables and stage benchmark citations for manager review.",
        planSteps: [
          "Open stale benchmark source",
          "Refresh license database comparables",
          "Stage citations and range movement",
          "Route to manager gate",
        ],
      };
    }

    if (commitment.id === "cm2") {
      return {
        ...commitment,
        capturedById: "u3",
        sourceQuote: "Legal owns the executed France renewal; we need a status check before closing the agreement gap.",
        linkedObjectName: "Commissionnaire Agreement - US/France",
      };
    }

    if (commitment.id === "cm4") {
      return {
        ...commitment,
        capturedById: "u3",
        sourceQuote: "Ask HR for Germany payroll support so the allocation key has current headcount evidence.",
        linkedObjectName: "Germany services cost allocation key",
        planInstructions: "Request Germany payroll data and stage extracted evidence for verification.",
        planSteps: ["Draft request", "Attach source thread", "Route extracted response to verification"],
      };
    }

    return {
      ...commitment,
      capturedById: "u2",
      sourceQuote: "Complete the missing substance section with current payroll support.",
      linkedObjectName: "Japan Local File FY2024 draft",
      planInstructions: "Collect payroll support and update the Japan substance section.",
      planSteps: ["Open draft", "Gather payroll support", "Stage updated section"],
    };
  });
}

function filterCommitments(commitments: CommitmentRecord[], filter: CommitmentFilter) {
  if (filter === "mine") return commitments.filter((commitment) => commitment.ownerId === CURRENT_USER_ID);
  if (filter === "by-me") return commitments.filter((commitment) => commitment.capturedById === CURRENT_USER_ID);
  if (filter === "team") return commitments;
  return commitments;
}

export function CommitmentsPageContent() {
  const [commitments, setCommitments] = useState<CommitmentRecord[]>(() => createCommitments());
  const [filter, setFilter] = useState<CommitmentFilter>("all");
  const [selectedCommitmentId, setSelectedCommitmentId] = useState<string | null>(mockCommitments[0]?.id ?? null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState("");
  const [notice, setNotice] = useState("Commitments ready for review.");

  const selectedCommitment = commitments.find((commitment) => commitment.id === selectedCommitmentId) ?? commitments[0];
  const visibleCommitments = useMemo(() => filterCommitments(commitments, filter), [commitments, filter]);

  function updateSelectedCommitment(update: (commitment: CommitmentRecord) => CommitmentRecord) {
    if (!selectedCommitment) return;

    setCommitments((current) =>
      current.map((commitment) => (commitment.id === selectedCommitment.id ? update(commitment) : commitment)),
    );
  }

  function beginPlanEdit() {
    if (!selectedCommitment) return;
    setPlanDraft(selectedCommitment.planInstructions ?? "");
    setEditingPlan(true);
  }

  function savePlanEdit() {
    updateSelectedCommitment((commitment) => ({ ...commitment, planInstructions: planDraft.trim() }));
    setEditingPlan(false);
    setNotice("Commitment plan edits saved.");
  }

  function approveAndRun() {
    if (selectedCommitment) {
      recordFrontendTelemetryEvent(
        createCommitmentPlanApprovedEvent({
          ...DEMO_FRONTEND_TELEMETRY_CONTEXT,
          surface: "commitments",
          commitmentId: selectedCommitment.id,
        }),
      );
    }
    updateSelectedCommitment((commitment) => ({ ...commitment, planState: "approved" }));
    setNotice("Commitment plan approved and run queued.");
  }

  function dismissPlan() {
    updateSelectedCommitment((commitment) => ({ ...commitment, planState: "dismissed" }));
    setNotice("Commitment plan dismissed.");
  }

  function draftChaseUp() {
    updateSelectedCommitment((commitment) => ({
      ...commitment,
      chaseUpDraft: `${firstName(commitment.ownerId)}, can you send a status update on "${commitment.text}" before ${format(parseISO(commitment.due), "MMM d")}?`,
    }));
    setNotice("Chase-up draft prepared for user send.");
  }

  function markDone() {
    updateSelectedCommitment((commitment) => ({ ...commitment, planState: "completed" }));
    setNotice("External commitment completed.");
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden bg-background">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Commitments</h1>
              <p className="text-sm text-muted-foreground">
                Ambient work captured from meetings and mail, with receipts and clear plan state.
              </p>
            </div>
            <div role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
              {notice}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {[
              ["all", "All"],
              ["mine", "Mine"],
              ["by-me", "By me"],
              ["team", "Team"],
            ].map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? "default" : "outline"}
                onClick={() => setFilter(key as CommitmentFilter)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="min-h-0 overflow-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Commitment", "Owner", "Source", "Due", "Linked object", "Plan-state", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleCommitments.map((commitment) => {
                  const SourceIcon = SOURCE_ICONS[commitment.source];

                  return (
                    <tr key={commitment.id} className="bg-card transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{commitment.text}</td>
                      <td className="px-4 py-3">{ownerName(commitment.ownerId)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <SourceIcon className="h-3.5 w-3.5" />
                          {commitment.source}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {format(parseISO(commitment.due), "MMM d, yyyy")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{commitment.linkedObjectName ?? "None"}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-xs capitalize", PLAN_STATE_CLASSES[commitment.planState])}>
                          {commitment.planState}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" onClick={() => setSelectedCommitmentId(commitment.id)}>
                          Open commitment
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {selectedCommitment ? (
        <aside aria-label="Commitment detail" className="w-[28rem] shrink-0 overflow-y-auto border-l border-border bg-background p-5">
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">Commitment detail</h2>
                <Badge variant="outline" className={cn("text-xs capitalize", PLAN_STATE_CLASSES[selectedCommitment.planState])}>
                  {selectedCommitment.planState}
                </Badge>
              </div>
              <p className="mt-2 text-sm">{selectedCommitment.text}</p>
            </div>

            <section className="rounded-lg border border-border bg-card p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quoted source span</h3>
              <p className="mt-2 text-sm">{selectedCommitment.sourceQuote}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  citation {selectedCommitment.sourceRef}
                </Badge>
                {selectedCommitment.linkedObjectName ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedCommitment.linkedObjectName}
                  </Badge>
                ) : null}
              </div>
            </section>

            {selectedCommitment.planState === "external" || selectedCommitment.planState === "completed" ? (
              <section className="rounded-lg border border-border bg-card p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">External task controls</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  This work is outside a Veritax process. Track done state, due date, owner, and chase-up drafts only.
                </p>
                {selectedCommitment.chaseUpDraft ? (
                  <div className="mt-3 rounded-md border border-border bg-surface p-2 text-sm">
                    {selectedCommitment.chaseUpDraft}
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={draftChaseUp}>
                    Draft chase-up
                  </Button>
                  <Button size="sm" onClick={markDone} disabled={selectedCommitment.planState === "completed"}>
                    Mark done
                  </Button>
                </div>
              </section>
            ) : (
              <section className="rounded-lg border border-border bg-card p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compiled step plan</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                  {(selectedCommitment.planSteps ?? []).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>

                {editingPlan ? (
                  <div className="mt-3 space-y-2">
                    <label className="space-y-1 text-xs font-medium text-muted-foreground">
                      <span>Plan instructions</span>
                      <Textarea value={planDraft} onChange={(event) => setPlanDraft(event.target.value)} />
                    </label>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingPlan(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={savePlanEdit}>
                        Save plan edits
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 rounded-md border border-border bg-surface p-2 text-sm">
                    {selectedCommitment.planInstructions}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={approveAndRun} disabled={selectedCommitment.planState === "approved"}>
                    Approve and run
                  </Button>
                  <Button size="sm" variant="outline" onClick={beginPlanEdit}>
                    Edit plan
                  </Button>
                  <Button size="sm" variant="outline" onClick={dismissPlan}>
                    Dismiss
                  </Button>
                </div>
              </section>
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
