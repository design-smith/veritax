import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { TeachStage } from "../teach-stage";

const questions = [
  {
    id: "q1",
    question: "Is GL account 47200 an intercompany royalty account?",
    options: ["Yes", "No", "Partially", "Unsure - escalate"],
    evidenceText: "Transactions from GL 47200 show regular payments labeled 'royalty fee'",
    consequenceLine: "Confirming maps GL 47200 to IC royalties for all periods",
  },
  {
    id: "q2",
    question: "Are the entities Veritax Corp (US) and Veritax Holdings the same legal entity?",
    options: ["Same entity", "Different entities", "Partially same", "Unsure - escalate"],
    evidenceText: "Both appear in the same tax group filings",
    consequenceLine: "Confirming will merge these two entity profiles",
  },
];

function TeachHarness({
  initialAnswered = 0,
  targetCount = 40,
}: {
  initialAnswered?: number;
  targetCount?: number;
}) {
  const [answeredCount, setAnsweredCount] = useState(initialAnswered);
  const [lastAnswer, setLastAnswer] = useState("none");
  const [skipped, setSkipped] = useState(false);
  const [undone, setUndone] = useState(false);
  const [continued, setContinued] = useState(false);

  return (
    <>
      <TeachStage
        questions={questions}
        answeredCount={answeredCount}
        targetCount={targetCount}
        onAnswer={(questionId, option) => {
          setLastAnswer(`${questionId}:${option}`);
          setAnsweredCount((current) => current + 1);
        }}
        onSkip={() => setSkipped(true)}
        onUndo={() => {
          setUndone(true);
          setAnsweredCount((current) => Math.max(0, current - 1));
        }}
        onContinue={() => setContinued(true)}
      />
      <p>Last answer: {lastAnswer}</p>
      <p>Skipped: {skipped ? "yes" : "no"}</p>
      <p>Undone: {undone ? "yes" : "no"}</p>
      <p>Teach continued: {continued ? "yes" : "no"}</p>
    </>
  );
}

describe("TeachStage", () => {
  it("shows the current question, evidence, consequence, options, and confidence meter", () => {
    render(<TeachHarness />);

    expect(screen.getByText(/Is GL account 47200/)).toBeInTheDocument();
    expect(screen.getByText("1. Yes")).toBeInTheDocument();
    expect(screen.getByText("2. No")).toBeInTheDocument();
    expect(screen.getByText("3. Partially")).toBeInTheDocument();
    expect(screen.getByText("4. Unsure - escalate")).toBeInTheDocument();
    expect(screen.getByText(/Transactions from GL 47200/)).toBeInTheDocument();
    expect(screen.getByText(/Confirming maps GL 47200/)).toBeInTheDocument();
    expect(screen.getByText(/0 of 40/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("records a visible answer when an option button is clicked", async () => {
    const user = userEvent.setup();
    render(<TeachHarness />);

    await user.click(screen.getByText("1. Yes"));

    expect(screen.getByText("Last answer: q1:Yes")).toBeInTheDocument();
    expect(screen.getByText(/1 of 40/)).toBeInTheDocument();
  });

  it("supports the keyboard answer, skip, and undo shortcuts", () => {
    render(<TeachHarness initialAnswered={1} />);

    fireEvent.keyDown(document, { key: "1" });
    fireEvent.keyDown(document, { key: "s" });
    fireEvent.keyDown(document, { key: "u" });

    expect(screen.getByText("Last answer: q1:Yes")).toBeInTheDocument();
    expect(screen.getByText("Skipped: yes")).toBeInTheDocument();
    expect(screen.getByText("Undone: yes")).toBeInTheDocument();
    expect(screen.getByText(/1 of 40/)).toBeInTheDocument();
  });

  it("keeps Continue disabled until the target is reached", () => {
    render(<TeachHarness initialAnswered={15} targetCount={40} />);

    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("continues to Reveal once the target is reached", async () => {
    const user = userEvent.setup();
    render(<TeachHarness initialAnswered={40} targetCount={40} />);

    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText("Teach continued: yes")).toBeInTheDocument();
  });
});
