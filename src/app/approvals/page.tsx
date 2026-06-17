"use client";

import { MobileApprovalsView } from "@/components/approvals/mobile-approvals-view";
import { mockGateRequests, mockUsers } from "@/lib/mock";

const requesterMap = Object.fromEntries(mockUsers.map((u) => [u.id, u]));
const noop = () => {};

export default function ApprovalsPage() {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <MobileApprovalsView
        gates={mockGateRequests}
        requesterMap={requesterMap}
        onApprove={noop}
        onReject={noop}
        className="flex-1"
      />
    </div>
  );
}
