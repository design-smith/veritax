"use client";

import { useState } from "react";
import { MeetingDetail, type Meeting } from "@/components/commitments/meeting-detail/meeting-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const DEMO_MEETINGS: Meeting[] = [
  {
    id: "mtg1",
    title: "TP Year-End Planning - Q4 Review",
    date: "2025-11-10T14:00:00Z",
    participants: ["Marcus Webb", "Ikaika Choi", "Sarah Kimura"],
    classification: "ingested",
    transcriptCustody: "allowed",
    extractedCommitments: [
      { id: "cm1", text: "Refresh benchmark study for royalty comparables before year-end", ownerId: "u3" },
      { id: "cm2", text: "Obtain executed renewal for France commissionnaire agreement", ownerId: "u2" },
      { id: "cm3", text: "Complete Japan substance section with payroll data", ownerId: "u4" },
    ],
    extractedAssertions: [
      { id: "as1", text: "UK royalty rate is above the arm's length range", confidenceLabel: "confirmed" },
      { id: "as2", text: "France agreement expired and renewal is outstanding", confidenceLabel: "confirmed" },
    ],
    recapDraft:
      "Meeting covered TP year-end planning. Key actions: refresh benchmarks by Dec 15, renew France ICA, complete Japan substance. UK royalty rate remains a critical remediation item before filing.",
  },
  {
    id: "mtg2",
    title: "Legal Intake - France Renewal Check",
    date: "2025-11-12T16:00:00Z",
    participants: ["Marcus Webb", "Legal Ops"],
    classification: "commitments-only",
    transcriptCustody: "commitments-only",
    extractedCommitments: [
      { id: "cm2", text: "Obtain executed renewal for France commissionnaire agreement", ownerId: "u2" },
    ],
    extractedAssertions: [
      { id: "as3", text: "Transcript content is commitments-only under custody policy", confidenceLabel: "restricted" },
    ],
    recapDraft:
      "Meeting captured only the France renewal commitment. Transcript body is withheld under commitments-only custody.",
  },
];

interface MeetingDetailPageContentProps {
  meetingId: string;
}

export function MeetingDetailPageContent({ meetingId }: MeetingDetailPageContentProps) {
  const meeting = DEMO_MEETINGS.find((item) => item.id === meetingId) ?? DEMO_MEETINGS[0];
  const [notice, setNotice] = useState("Meeting detail ready for review.");
  const [emailDraftOpen, setEmailDraftOpen] = useState(false);
  const [intakeEnabled, setIntakeEnabled] = useState(true);

  function openEmailDraft() {
    setEmailDraftOpen(true);
    setNotice("Recap draft opened under send-on-approval policy.");
  }

  function approveRecapSend() {
    setNotice("Recap send approved and queued for policy delivery.");
  }

  function toggleIntakeConsent() {
    setIntakeEnabled((current) => !current);
    setNotice(intakeEnabled ? "Meeting intake consent turned off." : "Meeting intake consent turned on.");
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">calendar-linked</Badge>
          <Badge variant={intakeEnabled ? "secondary" : "outline"}>
            {intakeEnabled ? "Intake consent on" : "Intake consent off"}
          </Badge>
        </div>
        <div role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
          {notice}
        </div>
      </div>

      <MeetingDetail meeting={meeting} onOpenEmailDraft={openEmailDraft} />

      <section aria-label="Intake settings shortcut" className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Intake settings shortcut</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Personal meeting intake stays beneath IT ceilings and can be changed from this surface.
            </p>
          </div>
          <Button variant="outline" onClick={toggleIntakeConsent}>
            {intakeEnabled ? "Turn off meeting intake" : "Turn on meeting intake"}
          </Button>
        </div>
      </section>

      {emailDraftOpen ? (
        <section aria-label="Email draft" className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Email draft</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Recap is held by send-on-approval policy until you approve delivery.
              </p>
            </div>
            <Button size="sm" onClick={approveRecapSend}>
              Approve recap send
            </Button>
          </div>
          <div className="mt-3 rounded-md border border-border bg-surface p-3 text-sm">
            {meeting.recapDraft}
          </div>
        </section>
      ) : null}
    </div>
  );
}
