"use client";

import { ObligationsTable } from "@/components/calendar/obligations-table";
import { RegulatoryChangeProposal } from "@/components/calendar/regulatory-change-proposal";
import { mockObligations } from "@/lib/mock";

const DEMO_PROPOSALS = [
  { id: "rp1", description: "Brazil adds 3 obligations to 2 entities for FY2025 — accept to calendar", addedCount: 3, entityCount: 2, changelogUrl: "/changelog/rp1" },
];

const noop = () => {};

export default function CalendarPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <h1 className="text-2xl font-semibold">Calendar & Obligations</h1>
      <RegulatoryChangeProposal proposals={DEMO_PROPOSALS} onAccept={noop} onViewChangelog={noop} />
      <ObligationsTable obligations={mockObligations} onAttachEvidence={noop} onAssignOwner={noop} />
    </div>
  );
}
