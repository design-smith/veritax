import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitmentsLane } from "../commitments-lane";
import type { Commitment } from "@/lib/mock/types";

const commitments: Commitment[] = [
  {
    id: "cm1",
    text: "Refresh benchmark study for royalty comparables",
    source: "meeting",
    sourceRef: "mtg-001",
    due: "2025-12-15",
    ownerId: "u3",
    linkedObjectId: "d5",
    planState: "pending",
  },
  {
    id: "cm2",
    text: "Obtain executed renewal for France commissionnaire agreement",
    source: "email",
    sourceRef: "email-001",
    due: "2025-12-31",
    ownerId: "u2",
    planState: "external",
  },
  {
    id: "cm3",
    text: "Complete Japan substance section with payroll data",
    source: "email",
    sourceRef: "email-002",
    due: "2025-12-20",
    ownerId: "u4",
    linkedObjectId: "d6",
    planState: "approved",
  },
];

describe("CommitmentsLane", () => {
  it("renders all commitments with text", () => {
    render(<CommitmentsLane commitments={commitments} onApproveRun={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText(/Refresh benchmark study/)).toBeInTheDocument();
    expect(screen.getByText(/France commissionnaire/)).toBeInTheDocument();
    expect(screen.getByText(/Japan substance section/)).toBeInTheDocument();
  });

  it("shows Approve & run button for approved-plan commitments", () => {
    render(<CommitmentsLane commitments={commitments} onApproveRun={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: /approve & run/i })).toBeInTheDocument();
  });

  it("does not show Approve & run for external commitments", () => {
    const external = [commitments[1]]; // planState: 'external'
    render(<CommitmentsLane commitments={external} onApproveRun={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /approve & run/i })).not.toBeInTheDocument();
  });

  it("external commitments show task controls (done/due) instead", () => {
    const external = [commitments[1]];
    render(<CommitmentsLane commitments={external} onApproveRun={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole("button", { name: /mark done/i })).toBeInTheDocument();
  });

  it("calls onApproveRun with commitment id when Approve & run clicked", async () => {
    const onApproveRun = vi.fn();
    render(<CommitmentsLane commitments={commitments} onApproveRun={onApproveRun} onDismiss={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /approve & run/i }));
    expect(onApproveRun).toHaveBeenCalledWith("cm3");
  });

  it("calls onDismiss with commitment id when Dismiss clicked", async () => {
    const onDismiss = vi.fn();
    render(<CommitmentsLane commitments={[commitments[0]]} onApproveRun={vi.fn()} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith("cm1");
  });

  it("shows source type chip (meeting / email)", () => {
    render(<CommitmentsLane commitments={commitments} onApproveRun={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getAllByText(/meeting/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/email/i).length).toBeGreaterThan(0);
  });
});
