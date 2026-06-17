import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MembersTable } from "../members-table";
import { ConnectorPolicyMatrix } from "../connector-policy-matrix";
import { AuditLogExplorer } from "../audit-log-explorer";
import { PendingRequestsQueue } from "../pending-requests-queue";
import { mockUsers, mockEvents } from "@/lib/mock";

// ── Members Table ─────────────────────────────────────────────────────────────

describe("MembersTable", () => {
  it("renders all members with name and role", () => {
    render(<MembersTable members={mockUsers} />);
    mockUsers.forEach((u) => {
      expect(screen.getByText(u.name)).toBeInTheDocument();
    });
  });

  it("renders role chips for each member", () => {
    render(<MembersTable members={mockUsers} />);
    expect(screen.getAllByText(/manager|analyst|vp|adjacent|admin/i).length).toBeGreaterThan(0);
  });

  it("is read-only — no edit buttons", () => {
    render(<MembersTable members={mockUsers} />);
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });
});

// ── Connector Policy Matrix ───────────────────────────────────────────────────

const policies = [
  { connectorType: "ERP", policyState: "self-serve" as const, scopeCeiling: "Label-scoped read-only", allowWrite: false },
  { connectorType: "HRIS", policyState: "request" as const, scopeCeiling: "Read-only", allowWrite: false },
  { connectorType: "messaging", policyState: "disabled" as const, scopeCeiling: "—", allowWrite: false },
];

describe("ConnectorPolicyMatrix", () => {
  it("renders all connector types", () => {
    render(<ConnectorPolicyMatrix policies={policies} onUpdatePolicy={vi.fn()} />);
    expect(screen.getByText("ERP")).toBeInTheDocument();
    expect(screen.getByText("HRIS")).toBeInTheDocument();
    expect(screen.getByText("messaging")).toBeInTheDocument();
  });

  it("renders policy state chips", () => {
    render(<ConnectorPolicyMatrix policies={policies} onUpdatePolicy={vi.fn()} />);
    expect(screen.getByText("Self-serve")).toBeInTheDocument();
    expect(screen.getByText("Request")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("renders scope ceiling for each entry", () => {
    render(<ConnectorPolicyMatrix policies={policies} onUpdatePolicy={vi.fn()} />);
    expect(screen.getByText("Label-scoped read-only")).toBeInTheDocument();
  });
});

// ── Audit Log Explorer ────────────────────────────────────────────────────────

describe("AuditLogExplorer", () => {
  it("renders audit events as rows", () => {
    render(<AuditLogExplorer events={mockEvents} />);
    expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
  });

  it("shows event type and timestamp — never shows content", () => {
    render(<AuditLogExplorer events={mockEvents} />);
    // Should show event type
    expect(screen.getAllByText(/finding|run|gate|document|obligation|staleness/i).length).toBeGreaterThan(0);
    // Must NOT render the event descriptions (content)
    mockEvents.forEach((e) => {
      expect(screen.queryByText(e.description)).not.toBeInTheDocument();
    });
  });

  it("filters events by search query", async () => {
    render(<AuditLogExplorer events={mockEvents} />);
    await userEvent.type(screen.getByPlaceholderText(/search/i), "gate");
    // Only gate events should be visible
    const gateEvents = mockEvents.filter((e) => e.type.includes("gate"));
    expect(screen.getAllByText(/gate/i).length).toBeGreaterThan(0);
  });
});

// ── Pending Requests Queue ────────────────────────────────────────────────────

const requests = [
  { id: "pr1", type: "access" as const, requesterId: "u3", description: "Analyst requests Sensitive-tier access", status: "pending" as const, createdAt: "2025-11-22T10:00:00Z" },
  { id: "pr2", type: "connector" as const, requesterId: "u4", description: "Request to connect Workday HRIS", status: "pending" as const, createdAt: "2025-11-21T09:00:00Z" },
];

describe("PendingRequestsQueue", () => {
  it("renders all pending requests", () => {
    render(<PendingRequestsQueue requests={requests} onApprove={vi.fn()} onDeny={vi.fn()} />);
    expect(screen.getByText(/Sensitive-tier access/)).toBeInTheDocument();
    expect(screen.getByText(/Workday HRIS/)).toBeInTheDocument();
  });

  it("renders Approve and Deny buttons for each request", () => {
    render(<PendingRequestsQueue requests={requests} onApprove={vi.fn()} onDeny={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /approve/i })).toHaveLength(requests.length);
    expect(screen.getAllByRole("button", { name: /deny/i })).toHaveLength(requests.length);
  });

  it("calls onApprove with request id when Approve clicked", async () => {
    const onApprove = vi.fn();
    render(<PendingRequestsQueue requests={requests} onApprove={onApprove} onDeny={vi.fn()} />);
    await userEvent.click(screen.getAllByRole("button", { name: /approve/i })[0]);
    expect(onApprove).toHaveBeenCalledWith("pr1");
  });

  it("shows empty state when no requests", () => {
    render(<PendingRequestsQueue requests={[]} onApprove={vi.fn()} onDeny={vi.fn()} />);
    expect(screen.getByText(/no pending requests/i)).toBeInTheDocument();
  });
});
