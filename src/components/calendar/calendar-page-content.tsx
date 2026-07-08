"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockObligations, mockUsers } from "@/lib/mock";
import type { Obligation } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

type CalendarViewObligation = Obligation & {
  entityName?: string;
  evidenceRef?: string;
  customerDefined?: boolean;
  snoozeReason?: string;
};

interface RegulatoryProposal {
  id: string;
  description: string;
  obligations: CalendarViewObligation[];
  changelogUrl: string;
}

type DraftMode =
  | { type: "none" }
  | { type: "manual" }
  | { type: "evidence"; obligationId: string }
  | { type: "owner"; obligationId: string }
  | { type: "snooze"; obligationId: string };

const INITIAL_PROPOSALS: RegulatoryProposal[] = [
  {
    id: "rp-brazil-2025",
    description: "Brazil adds 3 obligations to 2 entities for FY2025",
    changelogUrl: "/changelog/rp-brazil-2025",
    obligations: [
      {
        id: "ob-br-ecf",
        name: "Brazil ECF Filing FY2025",
        entityId: "e1",
        entityName: "Veritax Corp (US)",
        jurisdiction: "BR",
        due: "2025-07-31",
        status: "upcoming",
        ownerId: "u2",
      },
      {
        id: "ob-br-ecd",
        name: "Brazil ECD Filing FY2025",
        entityId: "e1",
        entityName: "Veritax Corp (US)",
        jurisdiction: "BR",
        due: "2025-05-30",
        status: "upcoming",
        ownerId: "u2",
      },
      {
        id: "ob-br-tp",
        name: "Brazil TP Local Documentation FY2025",
        entityId: "e4",
        entityName: "Veritax APAC Pte Ltd",
        jurisdiction: "BR",
        due: "2025-09-30",
        status: "upcoming",
        ownerId: "u3",
      },
    ],
  },
];

function ownerName(ownerId: string) {
  return mockUsers.find((user) => user.id === ownerId)?.name ?? "Unassigned";
}

function createInitialObligations(): CalendarViewObligation[] {
  return mockObligations.map((obligation) => ({
    ...obligation,
    entityName: obligation.entityId,
  }));
}

function statusClass(status: Obligation["status"]) {
  if (status === "filed") return "border-transparent bg-success-soft text-success-soft-foreground";
  if (status === "overdue") return "border-transparent bg-danger-soft text-danger-soft-foreground";
  if (status === "snoozed") return "border-transparent bg-info-soft text-info-soft-foreground";
  return "border-border text-muted-foreground";
}

export function CalendarPageContent() {
  const [obligations, setObligations] = useState<CalendarViewObligation[]>(() => createInitialObligations());
  const [proposals, setProposals] = useState<RegulatoryProposal[]>(INITIAL_PROPOSALS);
  const [notice, setNotice] = useState("Calendar ready for review.");
  const [draftMode, setDraftMode] = useState<DraftMode>({ type: "none" });
  const [manualName, setManualName] = useState("");
  const [manualEntity, setManualEntity] = useState("");
  const [manualJurisdiction, setManualJurisdiction] = useState("");
  const [manualDue, setManualDue] = useState("");
  const [manualOwner, setManualOwner] = useState(mockUsers[1]?.id ?? "u2");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [newOwner, setNewOwner] = useState(mockUsers[0]?.id ?? "u1");
  const [snoozeReason, setSnoozeReason] = useState("");

  const sortedObligations = useMemo(
    () => [...obligations].sort((a, b) => a.due.localeCompare(b.due)),
    [obligations],
  );

  function acceptProposal(proposalId: string) {
    const proposal = proposals.find((item) => item.id === proposalId);
    if (!proposal) return;

    setObligations((current) => [...current, ...proposal.obligations]);
    setProposals((current) => current.filter((item) => item.id !== proposalId));
    setNotice("Brazil rulepack proposal accepted; 3 obligations added to the calendar.");
  }

  function saveManualObligation() {
    const obligation: CalendarViewObligation = {
      id: `manual-${Date.now()}`,
      name: manualName.trim(),
      entityId: manualEntity.trim(),
      entityName: manualEntity.trim(),
      jurisdiction: manualJurisdiction.trim().toUpperCase(),
      due: manualDue,
      status: "upcoming",
      ownerId: manualOwner,
      customerDefined: true,
    };

    setObligations((current) => [...current, obligation]);
    setManualName("");
    setManualEntity("");
    setManualJurisdiction("");
    setManualDue("");
    setManualOwner(mockUsers[1]?.id ?? "u2");
    setDraftMode({ type: "none" });
    setNotice("Manual obligation added as customer-defined.");
  }

  function saveEvidence() {
    if (draftMode.type !== "evidence") return;

    setObligations((current) =>
      current.map((obligation) =>
        obligation.id === draftMode.obligationId
          ? { ...obligation, status: "filed", evidenceRef: evidenceRef.trim() }
          : obligation,
      ),
    );
    setEvidenceRef("");
    setDraftMode({ type: "none" });
    setNotice("Filing evidence attached; obligation locked to filed.");
  }

  function saveOwner() {
    if (draftMode.type !== "owner") return;

    setObligations((current) =>
      current.map((obligation) =>
        obligation.id === draftMode.obligationId ? { ...obligation, ownerId: newOwner } : obligation,
      ),
    );
    setDraftMode({ type: "none" });
    setNotice("Owner assignment updated with access consequences recorded.");
  }

  function saveSnooze() {
    if (draftMode.type !== "snooze") return;

    setObligations((current) =>
      current.map((obligation) =>
        obligation.id === draftMode.obligationId
          ? { ...obligation, status: "snoozed", snoozeReason: snoozeReason.trim() }
          : obligation,
      ),
    );
    setSnoozeReason("");
    setDraftMode({ type: "none" });
    setNotice("Snooze reason logged for manager review.");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar & Obligations</h1>
          <p className="text-sm text-muted-foreground">
            Statutory and engagement duties only, with owner, evidence, and status kept on the record.
          </p>
        </div>
        <div role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
          {notice}
        </div>
      </div>

      {proposals.length > 0 ? (
        <section aria-label="Regulatory change lane" className="space-y-2">
          {proposals.map((proposal) => (
            <div key={proposal.id} className="rounded-lg border border-info/25 bg-info-soft p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-info-soft-foreground">{proposal.description}</p>
                  <a href={proposal.changelogUrl} className="text-xs text-info-soft-foreground underline">
                    View changelog
                  </a>
                </div>
                <Button size="sm" onClick={() => acceptProposal(proposal.id)}>
                  Accept Brazil adds 3 obligations
                </Button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <Tabs defaultValue="table" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="wheel">Year wheel</TabsTrigger>
            <TabsTrigger value="gantt">Gantt</TabsTrigger>
          </TabsList>
          <Button size="sm" onClick={() => setDraftMode({ type: "manual" })}>
            Add manual obligation
          </Button>
        </div>

        <TabsContent value="wheel">
          <section aria-label="Year wheel" className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Year wheel</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Jurisdiction rings group obligations by local-TZ due month and status.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {Array.from(new Set(sortedObligations.map((item) => item.jurisdiction))).map((jurisdiction) => (
                <div key={jurisdiction} className="rounded-md border border-border bg-surface p-3">
                  <p className="font-mono text-xs">{jurisdiction}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {sortedObligations.filter((item) => item.jurisdiction === jurisdiction).length} duties
                  </p>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="gantt">
          <section aria-label="Gantt" className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Gantt</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Hard deadlines are sequenced by due date with filed and snoozed states carried forward.
            </p>
            <div className="mt-4 space-y-2">
              {sortedObligations.slice(0, 6).map((obligation) => (
                <div key={obligation.id} className="grid grid-cols-[150px_1fr] items-center gap-3 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{format(parseISO(obligation.due), "MMM d, yyyy")}</span>
                  <span className="rounded-md border border-border bg-surface px-3 py-2">{obligation.name}</span>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="table">
          <section aria-label="Obligations table" className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Obligation", "Entity", "Jurisdiction", "Due", "Owner", "Status", "Evidence", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedObligations.map((obligation) => (
                  <tr key={obligation.id} className="bg-card transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{obligation.name}</div>
                      {obligation.customerDefined ? (
                        <Badge variant="outline" className="mt-1 text-[10px]">
                          customer-defined
                        </Badge>
                      ) : null}
                      {obligation.snoozeReason ? (
                        <p className="mt-1 text-xs text-muted-foreground">{obligation.snoozeReason}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{obligation.entityName ?? obligation.entityId}</td>
                    <td className="px-4 py-3 font-mono text-xs">{obligation.jurisdiction}</td>
                    <td className="px-4 py-3">{format(parseISO(obligation.due), "MMM d, yyyy")} local</td>
                    <td className="px-4 py-3">{ownerName(obligation.ownerId)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("text-xs capitalize", statusClass(obligation.status))}>
                        {obligation.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{obligation.evidenceRef ?? "No evidence attached"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setDraftMode({ type: "evidence", obligationId: obligation.id })}>
                          Attach filing evidence
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setNewOwner(obligation.ownerId);
                            setDraftMode({ type: "owner", obligationId: obligation.id });
                          }}
                        >
                          Assign owner
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDraftMode({ type: "snooze", obligationId: obligation.id })}>
                          Snooze with reason
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </TabsContent>
      </Tabs>

      {draftMode.type === "manual" ? (
        <section aria-label="Manual obligation form" className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Add manual obligation</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="space-y-1 text-xs font-medium text-muted-foreground lg:col-span-2">
              <span>Obligation name</span>
              <Input value={manualName} onChange={(event) => setManualName(event.target.value)} />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              <span>Entity</span>
              <Input value={manualEntity} onChange={(event) => setManualEntity(event.target.value)} />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              <span>Jurisdiction</span>
              <Input value={manualJurisdiction} onChange={(event) => setManualJurisdiction(event.target.value)} />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              <span>Due date</span>
              <Input type="date" value={manualDue} onChange={(event) => setManualDue(event.target.value)} />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              <span>Owner</span>
              <select
                className="h-8 w-full rounded-md border border-input bg-surface px-2 text-sm text-foreground"
                value={manualOwner}
                onChange={(event) => setManualOwner(event.target.value)}
              >
                {mockUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDraftMode({ type: "none" })}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveManualObligation}>
              Save manual obligation
            </Button>
          </div>
        </section>
      ) : null}

      {draftMode.type === "evidence" ? (
        <section aria-label="Filing evidence form" className="rounded-lg border border-border bg-card p-4">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Evidence reference</span>
            <Input value={evidenceRef} onChange={(event) => setEvidenceRef(event.target.value)} />
          </label>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={saveEvidence}>
              Save filing evidence
            </Button>
          </div>
        </section>
      ) : null}

      {draftMode.type === "owner" ? (
        <section aria-label="Owner assignment form" className="rounded-lg border border-border bg-card p-4">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>New owner</span>
            <select
              className="h-8 w-full max-w-sm rounded-md border border-input bg-surface px-2 text-sm text-foreground"
              value={newOwner}
              onChange={(event) => setNewOwner(event.target.value)}
            >
              {mockUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 text-xs text-muted-foreground">
            Assignment grants this obligation record and filing-evidence slot, then revokes access on unassignment.
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={saveOwner}>
              Save owner
            </Button>
          </div>
        </section>
      ) : null}

      {draftMode.type === "snooze" ? (
        <section aria-label="Snooze form" className="rounded-lg border border-border bg-card p-4">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            <span>Snooze reason</span>
            <Input value={snoozeReason} onChange={(event) => setSnoozeReason(event.target.value)} />
          </label>
          <div className="mt-2 text-xs text-muted-foreground">Hard-deadline snoozes are logged for manager review.</div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={saveSnooze}>
              Save snooze
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
