import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DecisionQueueSection } from "../decision-queue-section";
import { mockGateRequests, mockUsers } from "@/lib/mock";

const gates = mockGateRequests;
const requesterMap = Object.fromEntries(mockUsers.map((u) => [u.id, u]));

describe("DecisionQueueSection", () => {
  it("renders a gate card for each request", () => {
    render(
      <DecisionQueueSection
        gates={gates}
        requesterMap={requesterMap}
        onApprove={vi.fn()}
        onRequestChanges={vi.fn()}
        onReject={vi.fn()}
        onDelegate={vi.fn()}
      />
    );
    // mockGateRequests has 3 gates; each should render its object name
    expect(screen.getByText(gates[0].objectName)).toBeInTheDocument();
    expect(screen.getByText(gates[1].objectName)).toBeInTheDocument();
  });

  it("removes the card when approve is called (optimistic)", async () => {
    const onApprove = vi.fn();
    render(
      <DecisionQueueSection
        gates={[gates[0]]}
        requesterMap={requesterMap}
        onApprove={onApprove}
        onRequestChanges={vi.fn()}
        onReject={vi.fn()}
        onDelegate={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledWith(gates[0].id);
    expect(screen.queryByText(gates[0].objectName)).not.toBeInTheDocument();
  });

  it("shows empty state when no pending gates remain", () => {
    render(
      <DecisionQueueSection
        gates={[]}
        requesterMap={requesterMap}
        onApprove={vi.fn()}
        onRequestChanges={vi.fn()}
        onReject={vi.fn()}
        onDelegate={vi.fn()}
      />
    );
    expect(screen.getByText(/no pending decisions/i)).toBeInTheDocument();
  });

  it("decrements visible count after each approval", async () => {
    render(
      <DecisionQueueSection
        gates={gates}
        requesterMap={requesterMap}
        onApprove={vi.fn()}
        onRequestChanges={vi.fn()}
        onReject={vi.fn()}
        onDelegate={vi.fn()}
      />
    );
    const initialApproveButtons = screen.getAllByRole("button", { name: /^approve & promote$/i });
    expect(initialApproveButtons).toHaveLength(gates.length);
    await userEvent.click(initialApproveButtons[0]);
    expect(screen.getAllByRole("button", { name: /^approve & promote$/i })).toHaveLength(gates.length - 1);
  });
});
