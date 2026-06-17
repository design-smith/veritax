import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FindingHistoryTab } from "../finding-history-tab";

const events = [
  {
    id: "h1",
    timestamp: "2025-11-22T09:00:00Z",
    actor: "System",
    type: "status_change" as const,
    description: "Finding detected by IC scan r1",
  },
  {
    id: "h2",
    timestamp: "2025-11-22T11:00:00Z",
    actor: "Ikaika Choi",
    type: "assignment" as const,
    description: "Assigned to Ikaika Choi",
  },
  {
    id: "h3",
    timestamp: "2025-11-22T14:00:00Z",
    actor: "Ikaika Choi",
    type: "instruction" as const,
    description: "Instruction submitted",
    instructionEcho: "Focus on royalty rate deviations above 10% of benchmark",
    instructionTier: "run" as const,
  },
  {
    id: "h4",
    timestamp: "2025-11-22T15:30:00Z",
    actor: "Marcus Webb",
    type: "gate_decision" as const,
    description: "Gate approved",
    gateDecision: "approved" as const,
  },
];

describe("FindingHistoryTab", () => {
  it("renders all events in reverse-chronological order", () => {
    render(<FindingHistoryTab events={events} />);
    const items = screen.getAllByRole("listitem");
    // Most recent first
    expect(items[0]).toHaveTextContent("Gate approved");
    expect(items[3]).toHaveTextContent("Finding detected");
  });

  it("renders actor names and event descriptions", () => {
    render(<FindingHistoryTab events={events} />);
    expect(screen.getAllByText("Ikaika Choi").length).toBeGreaterThan(0);
    expect(screen.getByText("Marcus Webb")).toBeInTheDocument();
    expect(screen.getByText("Assigned to Ikaika Choi")).toBeInTheDocument();
  });

  it("renders instruction echo verbatim with tier badge", () => {
    render(<FindingHistoryTab events={events} />);
    expect(
      screen.getByText("Focus on royalty rate deviations above 10% of benchmark")
    ).toBeInTheDocument();
    expect(screen.getByText("run")).toBeInTheDocument();
  });

  it("renders gate decision with approved chip", () => {
    render(<FindingHistoryTab events={events} />);
    expect(screen.getByText("approved")).toBeInTheDocument();
  });

  it("shows empty state when no events", () => {
    render(<FindingHistoryTab events={[]} />);
    expect(screen.getByText(/no history/i)).toBeInTheDocument();
  });
});
