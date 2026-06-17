"use client";

import { useRouter } from "next/navigation";
import { BriefingContent } from "@/components/briefing/briefing-content";
import {
  mockCommitments,
  mockEvents,
  mockGateRequests,
  mockObligations,
  mockUsers,
} from "@/lib/mock";

const requesterMap = Object.fromEntries(mockUsers.map((u) => [u.id, u]));

const noop = () => {};

export default function BriefingPage() {
  const router = useRouter();

  return (
    <BriefingContent
      events={mockEvents}
      gates={mockGateRequests}
      obligations={mockObligations}
      commitments={mockCommitments}
      requesterMap={requesterMap}
      onAcknowledge={noop}
      onOpen={(ref) => router.push(ref)}
      onApprove={noop}
      onRequestChanges={noop}
      onReject={noop}
      onDelegate={noop}
      onApproveRun={noop}
      onDismissCommitment={noop}
      onNavigateObligation={(href) => router.push(href)}
      onBoardPack={noop}
    />
  );
}
