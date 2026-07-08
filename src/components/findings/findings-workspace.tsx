"use client";

import { useMemo, useState } from "react";
import { BulkActionsBar } from "@/components/findings/bulk-actions-bar";
import { FindingsList } from "@/components/findings/findings-list";
import { SavedViewsBar, useSavedViews } from "@/components/findings/saved-views";
import { TriageSubView } from "@/components/findings/triage-sub-view";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Entity, Finding, Flow, User } from "@/lib/mock/types";

interface SavedViewDefinition {
  id: string;
  label: string;
  filters: Record<string, unknown>;
}

interface FindingsWorkspaceProps {
  initialFindings: Finding[];
  flows: Flow[];
  entities: Entity[];
  users: User[];
  defaultViews?: SavedViewDefinition[];
  onOpenFinding?: (finding: Finding) => void;
}

const DEFAULT_VIEWS: SavedViewDefinition[] = [
  { id: "open", label: "Open", filters: { status: "open" } },
  { id: "all", label: "All", filters: {} },
  { id: "triage", label: "Candidates", filters: { triage: true } },
];

function isOpenFinding(finding: Finding) {
  return finding.status !== "resolved" && finding.status !== "verify-next-cycle";
}

function asCandidate(finding: Finding): Finding {
  return {
    ...finding,
    id: `cand-${finding.id}`,
    reviewerState: "unreviewed",
    status: "detected",
  };
}

export function FindingsWorkspace({
  initialFindings,
  flows,
  entities,
  users,
  defaultViews = DEFAULT_VIEWS,
  onOpenFinding,
}: FindingsWorkspaceProps) {
  const [findings, setFindings] = useState(initialFindings);
  const [candidates, setCandidates] = useState(() => initialFindings.slice(0, 3).map(asCandidate));
  const [selectedFindings, setSelectedFindings] = useState<Finding[]>([]);
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [currentViewId, setCurrentViewId] = useState("open");
  const [notice, setNotice] = useState<string | null>(null);
  const { views, saveView } = useSavedViews(defaultViews);

  const visibleFindings = useMemo(() => {
    if (currentViewId === "all") return findings;
    return findings.filter(isOpenFinding);
  }, [currentViewId, findings]);

  function assignSelected(selected: Finding[]) {
    const assignee = users.find((user) => user.role === "analyst") ?? users[0];
    if (!assignee) return;
    const ids = new Set(selected.map((finding) => finding.id));
    setFindings((current) =>
      current.map((finding) =>
        ids.has(finding.id) ? { ...finding, assigneeId: assignee.id, status: "triaged" } : finding,
      ),
    );
    setSelectedFindings([]);
    setSelectionVersion((version) => version + 1);
    setNotice(`${selected.length} finding${selected.length === 1 ? "" : "s"} assigned to ${assignee.name}.`);
  }

  function watchSelected(selected: Finding[]) {
    setNotice(`${selected.length} finding${selected.length === 1 ? "" : "s"} added to watch list.`);
  }

  function exportSelected(selected: Finding[]) {
    setNotice(`${selected.length} finding${selected.length === 1 ? "" : "s"} exported as a communication list.`);
  }

  function moveSelectedToTriage(selected: Finding[], reason: string) {
    const selectedIds = new Set(selected.map((finding) => finding.id));
    const candidateIds = new Set(candidates.map((candidate) => candidate.id));
    const nextCandidates = selected
      .map(asCandidate)
      .filter((candidate) => !candidateIds.has(candidate.id));
    setCandidates((current) => [...nextCandidates, ...current]);
    setFindings((current) => current.filter((finding) => !selectedIds.has(finding.id)));
    setSelectedFindings([]);
    setSelectionVersion((version) => version + 1);
    setNotice(`${selected.length} finding${selected.length === 1 ? "" : "s"} moved to candidate triage: ${reason}`);
  }

  function promoteCandidate(candidateId: string, reason: string) {
    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    const promoted: Finding = {
      ...candidate,
      id: candidate.id.replace(/^cand-/, ""),
      status: "triaged",
      reviewerState: "unreviewed",
    };
    setCandidates((current) => current.filter((item) => item.id !== candidateId));
    setFindings((current) => [promoted, ...current]);
    setCurrentViewId("open");
    setNotice(`${promoted.id} promoted to finding: ${reason}`);
  }

  return (
    <div className="space-y-4 px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Findings</h1>
      </div>

      {notice && (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="findings">
        <TabsList>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="triage">Triage candidates</TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="mt-4 space-y-3">
          <SavedViewsBar
            currentViewId={currentViewId}
            views={views}
            onSwitchView={setCurrentViewId}
            onSaveView={saveView}
          />

          {selectedFindings.length > 0 && (
            <BulkActionsBar
              selected={selectedFindings}
              onAssign={assignSelected}
              onWatch={watchSelected}
              onExportList={exportSelected}
              onMoveToTriage={moveSelectedToTriage}
            />
          )}

          <FindingsList
            key={`findings-list-${selectionVersion}-${currentViewId}`}
            findings={visibleFindings}
            flows={flows}
            entities={entities}
            users={users}
            onRowOpen={(finding) => onOpenFinding?.(finding)}
            onRowSelect={setSelectedFindings}
          />
        </TabsContent>

        <TabsContent value="triage" className="mt-4">
          <TriageSubView candidates={candidates} onPromote={promoteCandidate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
