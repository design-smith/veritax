import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  clearRecordedFrontendTelemetryEvents,
  getRecordedFrontendTelemetryEvents,
} from "@/lib/telemetry/product-telemetry";
import { AnswerBrief } from "../answer-brief";

const exhibits = [
  { id: "ex1", docName: "UK Local File FY2024", section: "§4.2", confidence: 0.91, extractorVersion: "v2.4", snippet: "Royalty rate is 18%" },
  { id: "ex2", docName: "TP Policy FY2024", section: "§3.1", confidence: 0.95, extractorVersion: "v2.4", snippet: "Policy rate 12%" },
];

describe("AnswerBrief", () => {
  afterEach(() => {
    clearRecordedFrontendTelemetryEvents();
  });

  const base = {
    question: "What is the royalty rate for Veritax UK?",
    answer: "The royalty rate charged to Veritax UK Ltd is 18%, which exceeds the arm's length range of 10-14% established by the CUT benchmark study.",
    exhibits,
    confidence: 0.88,
    onOpenAsView: vi.fn(),
    onExport: vi.fn(),
    onSave: vi.fn(),
    onEscalate: vi.fn(),
  };

  it("renders the answer text", () => {
    render(<AnswerBrief {...base} />);
    expect(screen.getByText(/18%, which exceeds/)).toBeInTheDocument();
  });

  it("renders exhibit citation chips", () => {
    render(<AnswerBrief {...base} />);
    expect(screen.getByText("UK Local File FY2024")).toBeInTheDocument();
    expect(screen.getByText("TP Policy FY2024")).toBeInTheDocument();
  });

  it("renders all four action buttons", () => {
    render(<AnswerBrief {...base} />);
    expect(screen.getByRole("button", { name: /open as view/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("shows Escalate button only when confidence is below threshold (0.85)", () => {
    render(<AnswerBrief {...base} confidence={0.7} />);
    expect(screen.getByRole("button", { name: /escalate/i })).toBeInTheDocument();
  });

  it("hides Escalate when confidence is above threshold", () => {
    render(<AnswerBrief {...base} confidence={0.95} />);
    expect(screen.queryByRole("button", { name: /escalate/i })).not.toBeInTheDocument();
  });

  it("calls onSave when Save button clicked", async () => {
    const onSave = vi.fn();
    render(<AnswerBrief {...base} onSave={onSave} />);
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("records Ask answer acceptance when opened as a view", async () => {
    const actions: string[] = [];
    render(
      <AnswerBrief
        {...base}
        answerId="ask-answer-1"
        onOpenAsView={() => actions.push("opened")}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /open as view/i }));

    expect(actions).toEqual(["opened"]);
    expect(getRecordedFrontendTelemetryEvents()).toMatchObject([
      {
        name: "adoption.ask_answer_accepted",
        surface: "ask",
        objectRef: { objectType: "ask-answer", objectId: "ask-answer-1" },
        metadata: { answerId: "ask-answer-1", confidenceBand: "medium" },
      },
    ]);
    expect(JSON.stringify(getRecordedFrontendTelemetryEvents())).not.toContain("royalty rate");
    expect(JSON.stringify(getRecordedFrontendTelemetryEvents())).not.toContain("arm's length");
  });

  it("renders the original question", () => {
    render(<AnswerBrief {...base} />);
    expect(screen.getByText(/What is the royalty rate/)).toBeInTheDocument();
  });

  it("renders a refusal answer with absence-evidence when isRefusal is true", () => {
    render(
      <AnswerBrief
        {...base}
        isRefusal
        answer="No executed renewal found after 31 Dec 2023 in corpus v.418"
      />
    );
    expect(screen.getByText(/No executed renewal/)).toBeInTheDocument();
    expect(screen.getByText(/no source found/i)).toBeInTheDocument();
  });
});
