import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SavedQuestionsTable } from "../saved-questions-table";

const questions = [
  {
    id: "q1",
    question: "What is the UK royalty rate?",
    lastAnswer: "The rate is 18%, above the arm's length range.",
    lastRunAt: "2025-11-20T10:00:00Z",
    hasChanged: false,
    isMonitored: false,
  },
  {
    id: "q2",
    question: "Is the France commissionnaire agreement expired?",
    lastAnswer: "Yes, it expired on 31 Dec 2023.",
    lastRunAt: "2025-11-21T09:00:00Z",
    hasChanged: true,
    isMonitored: true,
  },
];

describe("SavedQuestionsTable", () => {
  it("renders all saved questions", () => {
    render(<SavedQuestionsTable questions={questions} onReask={vi.fn()} onDelete={vi.fn()} onToggleMonitor={vi.fn()} />);
    expect(screen.getByText("What is the UK royalty rate?")).toBeInTheDocument();
    expect(screen.getByText(/France commissionnaire/)).toBeInTheDocument();
  });

  it("highlights rows where answer has changed", () => {
    render(<SavedQuestionsTable questions={questions} onReask={vi.fn()} onDelete={vi.fn()} onToggleMonitor={vi.fn()} />);
    const changedRow = screen.getByTestId("question-row-q2");
    expect(changedRow).toHaveClass("changed");
  });

  it("does not highlight rows where answer has not changed", () => {
    render(<SavedQuestionsTable questions={questions} onReask={vi.fn()} onDelete={vi.fn()} onToggleMonitor={vi.fn()} />);
    const unchangedRow = screen.getByTestId("question-row-q1");
    expect(unchangedRow).not.toHaveClass("changed");
  });

  it("shows monitor toggle as ON for monitored questions", () => {
    render(<SavedQuestionsTable questions={questions} onReask={vi.fn()} onDelete={vi.fn()} onToggleMonitor={vi.fn()} />);
    const toggles = screen.getAllByRole("checkbox");
    // q2 is monitored → checked
    const monitoredToggle = screen.getByTestId("monitor-toggle-q2");
    expect(monitoredToggle).toBeChecked();
  });

  it("calls onToggleMonitor with question id when monitor toggled", async () => {
    const onToggleMonitor = vi.fn();
    render(<SavedQuestionsTable questions={questions} onReask={vi.fn()} onDelete={vi.fn()} onToggleMonitor={onToggleMonitor} />);
    await userEvent.click(screen.getByTestId("monitor-toggle-q1"));
    expect(onToggleMonitor).toHaveBeenCalledWith("q1");
  });

  it("calls onReask when Re-ask button clicked", async () => {
    const onReask = vi.fn();
    render(<SavedQuestionsTable questions={questions} onReask={onReask} onDelete={vi.fn()} onToggleMonitor={vi.fn()} />);
    const reaskButtons = screen.getAllByRole("button", { name: /re-ask/i });
    await userEvent.click(reaskButtons[0]);
    expect(onReask).toHaveBeenCalledWith("q1");
  });

  it("renders last-run timestamp for each question", () => {
    render(<SavedQuestionsTable questions={questions} onReask={vi.fn()} onDelete={vi.fn()} onToggleMonitor={vi.fn()} />);
    expect(screen.getByText(/Nov 20/)).toBeInTheDocument();
  });
});
