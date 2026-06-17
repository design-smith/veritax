import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MobileApprovalsView } from "../mobile-approvals-view";
import { mockGateRequests, mockUsers } from "@/lib/mock";

const gates = mockGateRequests;
const requesterMap = Object.fromEntries(mockUsers.map((u) => [u.id, u]));

describe("MobileApprovalsView", () => {
  it("renders compact header with pending count", () => {
    render(
      <MobileApprovalsView
        gates={gates}
        requesterMap={requesterMap}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText(new RegExp(`${gates.length}.*pending|pending.*${gates.length}`, "i"))).toBeInTheDocument();
  });

  it("renders each gate as a compact card", () => {
    render(
      <MobileApprovalsView
        gates={gates}
        requesterMap={requesterMap}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    gates.forEach((g) => expect(screen.getByText(g.objectName)).toBeInTheDocument());
  });

  it("renders Approve and Reject button on each card", () => {
    render(
      <MobileApprovalsView
        gates={gates}
        requesterMap={requesterMap}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getAllByRole("button", { name: /approve/i }).length).toBe(gates.length);
    expect(screen.getAllByRole("button", { name: /reject/i }).length).toBe(gates.length);
  });

  it("calls onApprove with gate id when Approve tapped", async () => {
    const onApprove = vi.fn();
    render(
      <MobileApprovalsView
        gates={[gates[0]]}
        requesterMap={requesterMap}
        onApprove={onApprove}
        onReject={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledWith(gates[0].id);
  });

  it("removes card after approval (optimistic)", async () => {
    render(
      <MobileApprovalsView
        gates={[gates[0]]}
        requesterMap={requesterMap}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(screen.queryByText(gates[0].objectName)).not.toBeInTheDocument();
  });

  it("requires reason before reject can be confirmed", async () => {
    render(
      <MobileApprovalsView
        gates={[gates[0]]}
        requesterMap={requesterMap}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(screen.getByRole("button", { name: /confirm reject/i })).toBeDisabled();
  });

  it("shows empty state when all gates resolved", async () => {
    render(
      <MobileApprovalsView
        gates={[]}
        requesterMap={requesterMap}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText(/no pending approvals|all clear/i)).toBeInTheDocument();
  });
});
