import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeachStage } from "../teach-stage";

const questions = [
  {
    id: "q1",
    question: "Is GL account 47200 an intercompany royalty account?",
    options: ["Yes", "No", "Partially", "Unsure — escalate"],
    evidenceText: "Transactions from GL 47200 show regular payments labeled 'royalty fee'",
    consequenceLine: "Confirming maps GL 47200 → IC royalties for all periods",
  },
  {
    id: "q2",
    question: "Are the entities Veritax Corp (US) and Veritax Holdings the same legal entity?",
    options: ["Same entity", "Different entities", "Partially same", "Unsure — escalate"],
    evidenceText: "Both appear in the same tax group filings",
    consequenceLine: "Confirming will merge these two entity profiles",
  },
];

describe("TeachStage", () => {
  it("renders the current question text", () => {
    render(<TeachStage questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByText(/Is GL account 47200/)).toBeInTheDocument();
  });

  it("renders all options as numbered buttons", () => {
    render(<TeachStage questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByText("1. Yes")).toBeInTheDocument();
    expect(screen.getByText("2. No")).toBeInTheDocument();
    expect(screen.getByText("3. Partially")).toBeInTheDocument();
    expect(screen.getByText("4. Unsure — escalate")).toBeInTheDocument();
  });

  it("renders the evidence text panel", () => {
    render(<TeachStage questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByText(/Transactions from GL 47200/)).toBeInTheDocument();
  });

  it("renders the consequence line", () => {
    render(<TeachStage questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByText(/Confirming maps GL 47200/)).toBeInTheDocument();
  });

  it("calls onAnswer when an option button is clicked", async () => {
    const onAnswer = vi.fn();
    render(<TeachStage questions={questions} answeredCount={0} targetCount={40} onAnswer={onAnswer} onSkip={vi.fn()} onUndo={vi.fn()} onContinue={vi.fn()} />);
    await userEvent.click(screen.getByText("1. Yes"));
    expect(onAnswer).toHaveBeenCalledWith("q1", "Yes");
  });

  it("selects option 1 when key '1' is pressed", () => {
    const onAnswer = vi.fn();
    render(<TeachStage questions={questions} answeredCount={0} targetCount={40} onAnswer={onAnswer} onSkip={vi.fn()} onUndo={vi.fn()} onContinue={vi.fn()} />);
    fireEvent.keyDown(document, { key: "1" });
    expect(onAnswer).toHaveBeenCalledWith("q1", "Yes");
  });

  it("calls onSkip when 's' is pressed", () => {
    const onSkip = vi.fn();
    render(<TeachStage questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={onSkip} onUndo={vi.fn()} onContinue={vi.fn()} />);
    fireEvent.keyDown(document, { key: "s" });
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("calls onUndo when 'u' is pressed", () => {
    const onUndo = vi.fn();
    render(<TeachStage questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={onUndo} onContinue={vi.fn()} />);
    fireEvent.keyDown(document, { key: "u" });
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("shows answered count out of target", () => {
    render(<TeachStage questions={questions} answeredCount={15} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByText(/15 of 40/)).toBeInTheDocument();
  });

  it("shows corpus-confidence meter", () => {
    render(<TeachStage questions={questions} answeredCount={20} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("Continue button is disabled before target is reached", () => {
    render(<TeachStage questions={questions} answeredCount={15} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("Continue button is enabled when answeredCount >= targetCount", () => {
    render(<TeachStage questions={questions} answeredCount={40} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });
});
