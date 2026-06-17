import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PipelineKanban } from "../pipeline-kanban";
import { PIPELINE_STAGES, type PipelineDocument, isLegalTransition } from "../pipeline-data";

// ── State machine ─────────────────────────────────────────────────────────────

describe("isLegalTransition", () => {
  it("allows Queued → Generating", () => {
    expect(isLegalTransition("queued", "generating")).toBe(true);
  });

  it("allows Generating → Self-check", () => {
    expect(isLegalTransition("generating", "self-check")).toBe(true);
  });

  it("allows Internal review → External review", () => {
    expect(isLegalTransition("internal-review", "external-review")).toBe(true);
  });

  it("does NOT allow skipping a stage (Queued → Internal review)", () => {
    expect(isLegalTransition("queued", "internal-review")).toBe(false);
  });

  it("does NOT allow going backwards (Signed → Internal review)", () => {
    expect(isLegalTransition("signed", "internal-review")).toBe(false);
  });
});

// ── PipelineKanban component ──────────────────────────────────────────────────

const docs: PipelineDocument[] = [
  { id: "d1", name: "Veritax UK Local File FY2024", fy: "2024", jurisdiction: "GB", version: 2, stage: "internal-review", redlineCount: 3, blockerChips: [] },
  { id: "d2", name: "Veritax GmbH Local File FY2024", fy: "2024", jurisdiction: "DE", version: 1, stage: "queued", redlineCount: 0, blockerChips: [] },
  { id: "d3", name: "Group Master File FY2024", fy: "2024", jurisdiction: "US", version: 3, stage: "self-check", redlineCount: 0, blockerChips: ["failed-assertion:§4.2"] },
];

describe("PipelineKanban", () => {
  it("renders all pipeline stage column headers", () => {
    render(<PipelineKanban documents={docs} onMoveStage={vi.fn()} onOpenWorkspace={vi.fn()} />);
    PIPELINE_STAGES.forEach((stage) => {
      expect(screen.getByText(stage.label)).toBeInTheDocument();
    });
  });

  it("renders each document card in its correct column", () => {
    render(<PipelineKanban documents={docs} onMoveStage={vi.fn()} onOpenWorkspace={vi.fn()} />);
    expect(screen.getByText("Veritax UK Local File FY2024")).toBeInTheDocument();
    expect(screen.getByText("Veritax GmbH Local File FY2024")).toBeInTheDocument();
  });

  it("shows redline count on cards that have changes", () => {
    render(<PipelineKanban documents={docs} onMoveStage={vi.fn()} onOpenWorkspace={vi.fn()} />);
    expect(screen.getByText(/3 changes/i)).toBeInTheDocument();
  });

  it("shows blocker chips on blocked cards", () => {
    render(<PipelineKanban documents={docs} onMoveStage={vi.fn()} onOpenWorkspace={vi.fn()} />);
    expect(screen.getByText(/failed-assertion/i)).toBeInTheDocument();
  });

  it("drag is illegal — drop is rejected with reason", async () => {
    render(<PipelineKanban documents={docs} onMoveStage={vi.fn()} onOpenWorkspace={vi.fn()} />);
    const card = screen.getByTestId("pipeline-card-d1");
    // Simulate drag start
    fireEvent.dragStart(card);
    // Attempt to drop on a column — should show illegal-drag notice
    const queuedCol = screen.getByTestId("pipeline-col-queued");
    fireEvent.dragOver(queuedCol);
    fireEvent.drop(queuedCol);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/drag.*illegal|not allowed|use action/i)).toBeInTheDocument();
  });

  it("calls onMoveStage when Send to internal review clicked on valid card", async () => {
    const onMoveStage = vi.fn();
    render(<PipelineKanban documents={docs} onMoveStage={onMoveStage} onOpenWorkspace={vi.fn()} />);
    // d1 is in internal-review → available action: Send to external review
    await userEvent.click(screen.getByTestId("pipeline-card-d1"));
    const actionBtn = screen.getByRole("button", { name: /send to external review/i });
    await userEvent.click(actionBtn);
    expect(onMoveStage).toHaveBeenCalledWith("d1", "external-review");
  });

  it("calls onOpenWorkspace when card double-clicked", async () => {
    const onOpenWorkspace = vi.fn();
    render(<PipelineKanban documents={docs} onMoveStage={vi.fn()} onOpenWorkspace={onOpenWorkspace} />);
    await userEvent.dblClick(screen.getByTestId("pipeline-card-d1"));
    expect(onOpenWorkspace).toHaveBeenCalledWith("d1");
  });
});
