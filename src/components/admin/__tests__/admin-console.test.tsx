import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { mockEvents, mockUsers } from "@/lib/mock";
import { AuditLogExplorer } from "../audit-log-explorer";
import { ConnectorPolicyMatrix } from "../connector-policy-matrix";
import { MembersTable } from "../members-table";
import { PendingRequestsQueue } from "../pending-requests-queue";
import type { ConnectorPolicy } from "../connector-policy-matrix";
import type { PendingRequest } from "../pending-requests-queue";

const policies: ConnectorPolicy[] = [
  { connectorType: "ERP", policyState: "self-serve", scopeCeiling: "Label-scoped read-only", allowWrite: false },
  { connectorType: "HRIS", policyState: "request", scopeCeiling: "Read-only", allowWrite: false },
  { connectorType: "messaging", policyState: "disabled", scopeCeiling: "No access", allowWrite: false },
];

const requests: PendingRequest[] = [
  {
    id: "pr1",
    type: "access",
    requesterId: "u3",
    description: "Analyst requests Sensitive-tier access",
    status: "pending",
    createdAt: "2025-11-22T10:00:00Z",
  },
  {
    id: "pr2",
    type: "connector",
    requesterId: "u4",
    description: "Request to connect Workday HRIS",
    status: "pending",
    createdAt: "2025-11-21T09:00:00Z",
  },
];

function ConnectorPolicyHarness() {
  const [lastPolicyChange, setLastPolicyChange] = useState("none");

  return (
    <>
      <ConnectorPolicyMatrix
        policies={policies}
        onUpdatePolicy={(connectorType, state) => setLastPolicyChange(`${connectorType}:${state}`)}
      />
      <p>Last policy change: {lastPolicyChange}</p>
    </>
  );
}

function PendingRequestsHarness() {
  const [visibleRequests, setVisibleRequests] = useState(requests);
  const [decision, setDecision] = useState("none");

  function resolveRequest(requestId: string, status: "approved" | "denied") {
    setVisibleRequests((current) => current.filter((request) => request.id !== requestId));
    setDecision(`${requestId}:${status}`);
  }

  return (
    <>
      <PendingRequestsQueue
        requests={visibleRequests}
        onApprove={(requestId) => resolveRequest(requestId, "approved")}
        onDeny={(requestId) => resolveRequest(requestId, "denied")}
      />
      <p>Last request decision: {decision}</p>
    </>
  );
}

describe("MembersTable", () => {
  it("renders members with role chips in a read-only SCIM view", () => {
    render(<MembersTable members={mockUsers} />);

    mockUsers.forEach((user) => expect(screen.getByText(user.name)).toBeInTheDocument());
    expect(screen.getAllByText(/manager|analyst|vp|adjacent|admin/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });
});

describe("ConnectorPolicyMatrix", () => {
  it("renders connector types, policy states, and scope ceilings", () => {
    render(<ConnectorPolicyHarness />);

    expect(screen.getByText("ERP")).toBeInTheDocument();
    expect(screen.getByText("HRIS")).toBeInTheDocument();
    expect(screen.getByText("messaging")).toBeInTheDocument();
    expect(screen.getByText("Self-serve")).toBeInTheDocument();
    expect(screen.getByText("Request")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText("Label-scoped read-only")).toBeInTheDocument();
  });
});

describe("AuditLogExplorer", () => {
  it("renders searchable metadata rows and never shows event descriptions", async () => {
    const user = userEvent.setup();
    render(<AuditLogExplorer events={mockEvents} />);

    expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
    mockEvents.forEach((event) => {
      expect(screen.queryByText(event.description)).not.toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText(/search/i), "gate");

    expect(screen.getAllByText(/gate/i).length).toBeGreaterThan(0);
  });
});

describe("PendingRequestsQueue", () => {
  it("renders pending requests and moves approved requests out of the queue", async () => {
    const user = userEvent.setup();
    render(<PendingRequestsHarness />);

    expect(screen.getByText(/Sensitive-tier access/)).toBeInTheDocument();
    expect(screen.getByText(/Workday HRIS/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /approve/i })).toHaveLength(requests.length);
    expect(screen.getAllByRole("button", { name: /deny/i })).toHaveLength(requests.length);

    await user.click(screen.getAllByRole("button", { name: /approve/i })[0]);

    expect(screen.getByText("Last request decision: pr1:approved")).toBeInTheDocument();
    expect(screen.queryByText(/Sensitive-tier access/)).not.toBeInTheDocument();
  });

  it("shows an empty state when the queue is clear", async () => {
    const user = userEvent.setup();
    render(<PendingRequestsHarness />);

    await user.click(screen.getAllByRole("button", { name: /approve/i })[0]);
    await user.click(screen.getAllByRole("button", { name: /deny/i })[0]);

    expect(screen.getByText(/no pending requests/i)).toBeInTheDocument();
  });
});
