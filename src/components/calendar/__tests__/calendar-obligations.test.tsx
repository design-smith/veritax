import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ObligationsTable } from "../obligations-table";
import { RegulatoryChangeProposal } from "../regulatory-change-proposal";
import { mockObligations } from "@/lib/mock";

describe("ObligationsTable", () => {
  it("renders all obligations", () => {
    render(<ObligationsTable obligations={mockObligations} onAttachEvidence={vi.fn()} onAssignOwner={vi.fn()} />);
    mockObligations.forEach((ob) => expect(screen.getByText(ob.name)).toBeInTheDocument());
  });

  it("renders jurisdiction for each obligation", () => {
    render(<ObligationsTable obligations={mockObligations} onAttachEvidence={vi.fn()} onAssignOwner={vi.fn()} />);
    mockObligations.forEach((ob) => {
      expect(screen.getAllByText(ob.jurisdiction).length).toBeGreaterThan(0);
    });
  });

  it("renders overdue status badge in red for overdue obligations", () => {
    render(<ObligationsTable obligations={mockObligations} onAttachEvidence={vi.fn()} onAssignOwner={vi.fn()} />);
    const overdue = mockObligations.find((o) => o.status === "overdue");
    if (overdue) {
      expect(screen.getByTestId(`status-${overdue.id}`)).toHaveClass("overdue");
    }
  });

  it("renders day-count chip for upcoming obligations", () => {
    render(<ObligationsTable obligations={mockObligations} onAttachEvidence={vi.fn()} onAssignOwner={vi.fn()} />);
    expect(screen.getAllByTestId(/day-chip/).length).toBeGreaterThan(0);
  });

  it("calls onAttachEvidence with obligation id when Attach clicked", async () => {
    const onAttachEvidence = vi.fn();
    render(<ObligationsTable obligations={[mockObligations[0]]} onAttachEvidence={onAttachEvidence} onAssignOwner={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /attach/i }));
    expect(onAttachEvidence).toHaveBeenCalledWith(mockObligations[0].id);
  });
});

describe("RegulatoryChangeProposal", () => {
  const proposals = [
    {
      id: "rp1",
      description: "Brazil adds 3 obligations to 2 entities for FY2025",
      addedCount: 3,
      entityCount: 2,
      changelogUrl: "/changelog/rp1",
    },
  ];

  it("renders the proposal description", () => {
    render(<RegulatoryChangeProposal proposals={proposals} onAccept={vi.fn()} onViewChangelog={vi.fn()} />);
    expect(screen.getByText(/Brazil adds 3 obligations/)).toBeInTheDocument();
  });

  it("renders Accept and View changelog buttons", () => {
    render(<RegulatoryChangeProposal proposals={proposals} onAccept={vi.fn()} onViewChangelog={vi.fn()} />);
    expect(screen.getByRole("button", { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /changelog/i })).toBeInTheDocument();
  });

  it("calls onAccept with proposal id when Accept clicked", async () => {
    const onAccept = vi.fn();
    render(<RegulatoryChangeProposal proposals={proposals} onAccept={onAccept} onViewChangelog={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith("rp1");
  });

  it("renders nothing when proposals array is empty", () => {
    const { container } = render(<RegulatoryChangeProposal proposals={[]} onAccept={vi.fn()} onViewChangelog={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
