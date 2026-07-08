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

// Keep the Friday mockup inside the five retained destinations.
function toDemoRef(ref: string) {
  if (!ref.startsWith("/")) return "/demo/briefing";
  if (ref.startsWith("/demo/")) return ref;
  if (ref.startsWith("/graph")) return "/demo/graph";
  if (ref.startsWith("/findings")) return ref.replace("/findings", "/demo/findings");
  if (ref.startsWith("/library") || ref.startsWith("/documents")) {
    return ref.replace(/^\/documents/, "/demo/library").replace(/^\/library/, "/demo/library");
  }
  return "/demo/gathering";
}

export default function DemoBriefingPage() {
  const router = useRouter();

  return (
    <BriefingContent
      events={mockEvents}
      gates={mockGateRequests}
      obligations={mockObligations}
      commitments={mockCommitments}
      requesterMap={requesterMap}
      onAcknowledge={noop}
      onOpen={(ref) => router.push(toDemoRef(ref))}
      onApprove={noop}
      onRequestChanges={noop}
      onReject={noop}
      onDelegate={noop}
      onApproveRun={noop}
      onDismissCommitment={noop}
      onNavigateObligation={(href) => router.push(toDemoRef(href))}
      onBoardPack={noop}
    />
  );
}
