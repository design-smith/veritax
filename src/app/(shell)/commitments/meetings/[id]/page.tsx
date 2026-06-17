"use client";

import { use } from "react";
import { MeetingDetail } from "@/components/commitments/meeting-detail/meeting-detail";

const DEMO_MEETINGS = [
  {
    id: "mtg1",
    title: "TP Year-End Planning — Q4 Review",
    date: "2025-11-10T14:00:00Z",
    participants: ["Marcus Webb", "Ikaika Choi", "Sarah Kimura"],
    classification: "ingested" as const,
    transcriptCustody: "allowed" as const,
    extractedCommitments: [
      { id: "cm1", text: "Refresh benchmark study for royalty comparables before year-end", ownerId: "u3" },
      { id: "cm2", text: "Obtain executed renewal for France commissionnaire agreement", ownerId: "u2" },
      { id: "cm3", text: "Complete Japan substance section with payroll data", ownerId: "u4" },
    ],
    extractedAssertions: [
      { id: "as1", text: "UK royalty rate (18%) is above the arm's length range of 10–14%", confidenceLabel: "confirmed" },
      { id: "as2", text: "France agreement expired Dec 2023 — renewals outstanding", confidenceLabel: "confirmed" },
    ],
    recapDraft: "Meeting covered TP year-end planning. Key actions: refresh benchmarks by Dec 15, renew France ICA, complete Japan substance. UK royalty rate flagged as critical issue requiring remediation before filing.",
  },
];

const noop = () => {};

export default function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const meeting = DEMO_MEETINGS.find((m) => m.id === id) ?? DEMO_MEETINGS[0];

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <MeetingDetail meeting={meeting} onOpenEmailDraft={noop} />
    </div>
  );
}
