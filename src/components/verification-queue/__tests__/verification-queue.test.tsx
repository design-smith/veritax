import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerificationQueue } from "../verification-queue";

const questions = [
  {
    id: "q1",
    category: "entity-merge" as const,
    question: "Are Veritax Corp (US) and Veritax Holdings Inc the same legal entity?",
    options: ["Same entity", "Different entities", "Partially same", "Unsure — escalate"],
    evidenceText: "Both appear in the same consolidated group tax return with the same EIN.",
    consequenceLine: "Confirming will merge these two entity profiles across all periods.",
  },
  {
    id: "q2",
    category: "account-mapping" as const,
    question: "Is GL account 47200 an intercompany royalty payable account?",
    options: ["Yes", "No", "Partially", "Unsure — escalate"],
    evidenceText: "GL 47200 shows recurring credits labeled 'royalty fee' to foreign subsidiaries.",
    consequenceLine: "Confirming maps GL 47200 → IC royalties for all periods.",
  },
  {
    id: "q3",
    category: "extraction-correction" as const,
    question: "Is the extracted royalty rate of 12% correct for §3.1?",
    options: ["Correct", "Incorrect — it is different", "Partially correct", "Cannot determine"],
    evidenceText: "§3.1 states: 'The applicable royalty rate shall be 12% of net revenue.'",
    consequenceLine: "Confirming validates the extraction for this field.",
  },
];

describe("VerificationQueue", () => {
  it("renders the current question card", () => {
    render(<VerificationQueue questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText(/Veritax Corp.*Veritax Holdings/)).toBeInTheDocument();
  });

  it("renders the question category chip", () => {
    render(<VerificationQueue questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText("entity-merge")).toBeInTheDocument();
  });

  it("renders all options as numbered buttons", () => {
    render(<VerificationQueue questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText("1. Same entity")).toBeInTheDocument();
    expect(screen.getByText("2. Different entities")).toBeInTheDocument();
    expect(screen.getByText("4. Unsure — escalate")).toBeInTheDocument();
  });

  it("renders the evidence text", () => {
    render(<VerificationQueue questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText(/consolidated group tax return/)).toBeInTheDocument();
  });

  it("renders the consequence line", () => {
    render(<VerificationQueue questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText(/merge these two entity profiles/)).toBeInTheDocument();
  });

  it("calls onAnswer with id and option when option clicked", async () => {
    const onAnswer = vi.fn();
    render(<VerificationQueue questions={questions} answeredCount={0} targetCount={40} onAnswer={onAnswer} onSkip={vi.fn()} onUndo={vi.fn()} />);
    await userEvent.click(screen.getByText("1. Same entity"));
    expect(onAnswer).toHaveBeenCalledWith("q1", "Same entity");
  });

  it("selects option 1 on key '1'", () => {
    const onAnswer = vi.fn();
    render(<VerificationQueue questions={questions} answeredCount={0} targetCount={40} onAnswer={onAnswer} onSkip={vi.fn()} onUndo={vi.fn()} />);
    fireEvent.keyDown(document, { key: "1" });
    expect(onAnswer).toHaveBeenCalledWith("q1", "Same entity");
  });

  it("calls onSkip on key 's'", () => {
    const onSkip = vi.fn();
    render(<VerificationQueue questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={onSkip} onUndo={vi.fn()} />);
    fireEvent.keyDown(document, { key: "s" });
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("calls onUndo on key 'u'", () => {
    const onUndo = vi.fn();
    render(<VerificationQueue questions={questions} answeredCount={0} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={onUndo} />);
    fireEvent.keyDown(document, { key: "u" });
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("shows progress: answered / target", () => {
    render(<VerificationQueue questions={questions} answeredCount={12} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText(/12.*40|12 of 40/)).toBeInTheDocument();
  });

  it("renders corpus-confidence progress bar", () => {
    render(<VerificationQueue questions={questions} answeredCount={20} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows celebration state when all questions exhausted", () => {
    render(<VerificationQueue questions={[]} answeredCount={40} targetCount={40} onAnswer={vi.fn()} onSkip={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText(/all caught up|queue empty/i)).toBeInTheDocument();
  });
});
