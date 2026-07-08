"use client";

import { useMemo, useState } from "react";
import { AssignControl } from "@/components/patterns/pat-7-assignment";
import { ExportDialog } from "@/components/patterns/pat-10-export";
import { CommentThread, type Comment } from "@/components/patterns/pat-12-comments";
import {
  PlanConfirmationModal,
  type PlanSpec,
} from "@/components/patterns/pat-4-plan-confirmation";
import { FindingActionsRow } from "@/components/findings/finding-actions-row";
import { FindingDetailInspector, type Exhibit } from "@/components/findings/finding-detail-inspector";
import { FindingHistoryTab, type HistoryEvent } from "@/components/findings/finding-history-tab";
import { FindingLifecycleIndicator } from "@/components/findings/finding-lifecycle-indicator";
import { ProvenanceBlock } from "@/components/findings/provenance-block";
import { RemediationPaths, type RemediationPath } from "@/components/findings/remediation-paths";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Document, Entity, Finding, Flow, User } from "@/lib/mock/types";

interface RunPayload {
  instruction: string;
}

interface FindingDetailPageContentProps {
  finding: Finding;
  flows: Flow[];
  entities: Entity[];
  documents: Document[];
  users: User[];
  onClose?: () => void;
}

function nowIso() {
  return new Date().toISOString();
}

function statusLabel(status: Finding["status"]) {
  return status.replace(/-/g, " ");
}

function findingType(finding: Finding): "exception" | "gap" | "drift" | "documentation" {
  const text = `${finding.title} ${finding.summary}`.toLowerCase();
  if (text.includes("no executed") || text.includes("missing") || text.includes("gap")) return "gap";
  if (text.includes("drift")) return "drift";
  if (text.includes("documentation") || text.includes("local file")) return "documentation";
  return "exception";
}

function relatedFlow(finding: Finding, flows: Flow[]) {
  return flows.find((flow) => flow.id === finding.flowId);
}

function relatedDocuments(flow: Flow | undefined, documents: Document[]) {
  if (!flow) return documents.slice(0, 2);
  return documents.filter(
    (document) =>
      document.entityIds.includes(flow.fromEntityId) ||
      document.entityIds.includes(flow.toEntityId),
  );
}

function entityLabel(entityId: string, entities: Entity[]) {
  const entity = entities.find((item) => item.id === entityId);
  return entity ? `${entity.jurisdictionCode} ${entity.name}` : entityId;
}

function flowRouteLabel(flow: Flow | undefined, entities: Entity[]) {
  if (!flow) return "finding evidence";
  return `${entityLabel(flow.fromEntityId, entities)} to ${entityLabel(flow.toEntityId, entities)}`;
}

function buildExhibits(finding: Finding, flow: Flow | undefined, documents: Document[]): Exhibit[] {
  const docs = relatedDocuments(flow, documents);
  const localFile = docs.find((document) => document.type === "local-file") ?? docs[0];
  const policy = docs.find((document) => document.type === "memo" || document.type === "master-file") ?? docs[1] ?? docs[0];
  const agreement = docs.find((document) => document.type === "ica");

  return [
    {
      id: `${finding.id}-observed`,
      docName: localFile?.name ?? "Observed record",
      section: "Observed rate",
      snippet: finding.summary,
      confidence: finding.confidence / 100,
      extractorVersion: "extractor-2024.11",
      href: localFile ? `/demo/library/${localFile.id}?returnTo=/demo/findings/${finding.id}` : undefined,
    },
    {
      id: `${finding.id}-policy`,
      docName: policy?.name ?? "Policy record",
      section: "Policy comparison",
      snippet: "Policy terms were compared against observed values and benchmark range.",
      confidence: 0.92,
      extractorVersion: "extractor-2024.11",
      href: policy ? `/demo/library/${policy.id}?returnTo=/demo/findings/${finding.id}` : undefined,
    },
    ...(agreement
      ? [
          {
            id: `${finding.id}-agreement`,
            docName: agreement.name,
            section: "Agreement terms",
            snippet: "Agreement terms were checked against the current intercompany flow.",
            confidence: 0.89,
            extractorVersion: "extractor-2024.11",
            href: `/demo/library/${agreement.id}?returnTo=/demo/findings/${finding.id}`,
          },
        ]
      : []),
  ];
}

function buildRemediationPaths(finding: Finding, flow: Flow | undefined, entities: Entity[]): RemediationPath[] {
  const kind = flow?.kind ?? "intercompany";
  const method = flow?.method ?? "policy";
  const route = flowRouteLabel(flow, entities);
  const baseObjects = [
    `${finding.currency} exposure rollup`,
    `${route} flow record`,
    "local file support",
  ];

  return [
    {
      id: "path-document-defend",
      title: `Document and defend ${method} position`,
      description: `Compile cited exhibits and a reviewer memo for the current ${kind} position.`,
      effortClass: "medium",
      affectedObjects: baseObjects,
    },
    {
      id: "path-prospective-fix",
      title: "Prospective policy fix",
      description: "Prepare a governed policy update for future periods without changing the filed record.",
      effortClass: "high",
      affectedObjects: [...baseObjects, "future-period policy"],
      requiresExternal: true,
    },
  ];
}

function buildRemediationPlan(finding: Finding, path: RemediationPath): PlanSpec {
  return {
    intent: `Create remediation work for ${finding.id}: ${path.title}.`,
    steps: [
      {
        id: "evidence",
        description: "Collect exhibits, comparison spans, and exposure lineage from the record.",
        scope: finding.id,
      },
      {
        id: "cascade",
        description: "Preview affected returns, documents, and customs consequences.",
      },
      {
        id: "work",
        description: "Create the remediation work object and route it to review.",
      },
    ],
    produces: [`remediation plan for ${finding.id}`, "cascade preview", "review-ready work item"],
    invalidates: ["prior remediation recommendation"],
    estimatedDuration: "30s-2min",
    costClass: "standard",
    instruction: `Prepare ${path.title} for ${finding.id}.`,
    permissionCheck: "allowed",
    tier: path.requiresExternal ? "methodology" : "run",
  };
}

function buildInitialHistory(finding: Finding, users: User[]): HistoryEvent[] {
  const actor = users[0]?.name ?? "System";
  return [
    {
      id: `${finding.id}-created`,
      timestamp: "2025-11-22T09:00:00Z",
      actor,
      type: "status_change",
      description: `Finding created as ${statusLabel(finding.status)}.`,
      instructionEcho: `Run rule ${finding.ruleId} against ${finding.flowId}.`,
      instructionTier: "run",
    },
  ];
}

export function FindingDetailPageContent({
  finding,
  flows,
  entities,
  documents,
  users,
  onClose,
}: FindingDetailPageContentProps) {
  const [currentFinding, setCurrentFinding] = useState(finding);
  const [history, setHistory] = useState(() => buildInitialHistory(finding, users));
  const [comments, setComments] = useState<Comment[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<RemediationPath | null>(null);

  const actor = users[0] ?? { id: "system", name: "System", email: "system@veritax.local", role: "admin" as const };
  const flow = relatedFlow(currentFinding, flows);
  const exhibits = useMemo(
    () => buildExhibits(currentFinding, flow, documents),
    [currentFinding, documents, flow],
  );
  const remediationPaths = useMemo(
    () => buildRemediationPaths(currentFinding, flow, entities),
    [currentFinding, entities, flow],
  );
  const remediationPlan = selectedPath ? buildRemediationPlan(currentFinding, selectedPath) : null;
  const assignmentScope = `${currentFinding.id} + ${flowRouteLabel(flow, entities)} evidence`;

  function addHistory(event: Omit<HistoryEvent, "id" | "timestamp" | "actor"> & { actor?: string }) {
    setHistory((current) => [
      {
        id: `${currentFinding.id}-event-${current.length + 1}`,
        timestamp: nowIso(),
        actor: event.actor ?? actor.name,
        ...event,
      },
      ...current,
    ]);
  }

  function confirmFinding() {
    setCurrentFinding((current) => ({
      ...current,
      status: "reviewed",
      reviewerState: "confirmed",
    }));
    addHistory({
      type: "status_change",
      description: `Confirmed by ${actor.name}.`,
    });
    setNotice(`${currentFinding.id} confirmed by ${actor.name}.`);
  }

  function dismissFinding(_findingId: string, reason: string, note?: string) {
    setCurrentFinding((current) => ({
      ...current,
      status: "reviewed",
      reviewerState: "dismissed",
    }));
    addHistory({
      type: "status_change",
      description: `Dismissed as ${reason}.`,
      reason: note ? `${reason}: ${note}` : reason,
    });
    setNotice(`${currentFinding.id} dismissed as ${reason}.`);
  }

  function assignFinding(payload: { userId: string; dueDate?: string; note?: string }) {
    const assignee = users.find((user) => user.id === payload.userId);
    setCurrentFinding((current) => ({
      ...current,
      assigneeId: payload.userId,
      status: current.status === "detected" ? "triaged" : current.status,
    }));
    addHistory({
      type: "assignment",
      description: `Assigned to ${assignee?.name ?? payload.userId}.`,
      instructionEcho: payload.note,
      instructionTier: payload.note ? "run" : undefined,
    });
    setNotice(`${currentFinding.id} assigned to ${assignee?.name ?? payload.userId}.`);
    setAssignOpen(false);
  }

  function addComment(payload: { text: string; mentions: string[] }) {
    setComments((current) => [
      ...current,
      {
        id: `${currentFinding.id}-comment-${current.length + 1}`,
        authorId: actor.id,
        authorName: actor.name,
        text: payload.text,
        timestamp: nowIso(),
      },
    ]);
    addHistory({
      type: "comment",
      description: `Comment added${payload.mentions.length > 0 ? " with mention" : ""}.`,
      instructionEcho: payload.text,
      instructionTier: "style",
    });
  }

  function resolveComment(commentId: string, resolved: boolean) {
    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId ? { ...comment, resolved } : comment,
      ),
    );
  }

  function openAllInViewer() {
    const firstHref = exhibits.find((exhibit) => exhibit.href)?.href;
    setNotice(firstHref ? `Viewer opened with ${exhibits.length} exhibits.` : "No viewer anchor is available.");
  }

  function selectPath(pathId: string) {
    const path = remediationPaths.find((item) => item.id === pathId);
    if (!path) return;
    setSelectedPath(path);
    setPlanOpen(true);
  }

  function runRemediation(payload: RunPayload) {
    if (!selectedPath) return undefined;
    addHistory({
      type: "instruction",
      description: `Remediation path selected: ${selectedPath.title}.`,
      instructionEcho: payload.instruction,
      instructionTier: selectedPath.requiresExternal ? "methodology" : "run",
    });
    setCurrentFinding((current) => ({
      ...current,
      status: "in-remediation",
    }));
    setNotice(`Remediation run created for ${currentFinding.id}.`);
    return {
      id: `remediation-${currentFinding.id}-${selectedPath.id}`,
      href: `/demo/gathering?run=remediation-${currentFinding.id}-${selectedPath.id}`,
    };
  }

  function createDataRequest() {
    addHistory({
      type: "instruction",
      description: "Data request created for missing evidence.",
      instructionEcho: `Request source support for ${currentFinding.id}.`,
      instructionTier: "run",
    });
    setNotice(`Data request created for ${currentFinding.id}.`);
  }

  function exportMemo() {
    setExportOpen(true);
  }

  function completeExport(payload: { format: string; destination: string }) {
    addHistory({
      type: "instruction",
      description: `Memo exported as ${payload.format} to ${payload.destination}.`,
    });
    setNotice(`${currentFinding.id} memo exported as ${payload.format}.`);
    setExportOpen(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-6">
      <FindingLifecycleIndicator
        status={currentFinding.status}
        nextCycleDate={currentFinding.status === "resolved" ? "2025-06-30" : undefined}
      />

      {notice && (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <Separator />

      <FindingDetailInspector
        finding={currentFinding}
        exhibits={exhibits}
        onClose={onClose ?? (() => undefined)}
        onOpenAllInViewer={openAllInViewer}
      />

      <Separator />

      <ProvenanceBlock
        ruleId={currentFinding.ruleId}
        ruleDescription="Finding was created by comparing asserted policy terms to observed record values."
        extractorVersion="extractor-2024.11"
        modelVersion="mirror-examiner-2024.11"
        confidence={currentFinding.confidence / 100}
        calibrationNote="Calibrated on similar intercompany exceptions and gap classes."
        comparisonSpans={[
          {
            label: "Finding summary",
            text: currentFinding.summary,
            docName: exhibits[0]?.docName ?? "Record",
            section: exhibits[0]?.section ?? "Summary",
          },
          {
            label: "Policy basis",
            text: "Policy and agreement evidence were compared to observed records.",
            docName: exhibits[1]?.docName ?? "Policy",
            section: exhibits[1]?.section ?? "Policy",
          },
        ]}
      />

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Remediation paths</h2>
        <RemediationPaths paths={remediationPaths} onSelectPath={selectPath} />
      </section>

      <Separator />

      <FindingActionsRow
        findingId={currentFinding.id}
        findingType={findingType(currentFinding)}
        reviewerState={currentFinding.reviewerState}
        onConfirm={confirmFinding}
        onDismiss={dismissFinding}
        onAssign={() => setAssignOpen(true)}
        onComment={() => setNotice("Comment thread is ready.")}
        onExportMemo={exportMemo}
        onDataRequest={createDataRequest}
      />

      <Separator />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Comments</h2>
        <CommentThread
          objectRef={`finding:${currentFinding.id}`}
          comments={comments}
          users={users}
          onAdd={addComment}
          onResolve={(commentId) => resolveComment(commentId, true)}
          onUnresolve={(commentId) => resolveComment(commentId, false)}
        />
      </section>

      <Separator />

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="mt-3">
          <FindingHistoryTab events={history} />
        </TabsContent>
      </Tabs>

      <AssignControl
        open={assignOpen}
        users={users}
        objectScope={assignmentScope}
        currentAssigneeId={currentFinding.assigneeId}
        onAssign={assignFinding}
        onClose={() => setAssignOpen(false)}
      />

      <ExportDialog
        open={exportOpen}
        artifactClass="communication"
        artifactName={`Finding memo ${currentFinding.id}`}
        uncitedClaimCount={0}
        onExport={completeExport}
        onClose={() => setExportOpen(false)}
      />

      {remediationPlan && (
        <PlanConfirmationModal
          open={planOpen}
          plan={remediationPlan}
          onRun={runRemediation}
          onCancel={() => setPlanOpen(false)}
        />
      )}
    </div>
  );
}
