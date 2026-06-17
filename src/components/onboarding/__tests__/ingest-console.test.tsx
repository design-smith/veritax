import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IngestConsole } from "../ingest-console";

const counters = {
  docsTotal: 24,
  docsByType: { "local-file": 8, "master-file": 2, ica: 6, other: 8 },
  entitiesDiscovered: 6,
  agreementsFound: 8,
};

const streamItems = [
  { id: "s1", name: "Veritax UK Local File FY2024.pdf", type: "local-file" as const },
  { id: "s2", name: "IC Royalty Agreement US-UK.pdf", type: "ica" as const },
  { id: "s3", name: "TP Policy FY2024.docx", type: "master-file" as const },
];

const problemItems = [
  { id: "p1", name: "corrupt-file.pdf", issue: "unreadable" as const },
  { id: "p2", name: "duplicate-policy.pdf", issue: "duplicate" as const },
];

describe("IngestConsole", () => {
  it("renders document count", () => {
    render(<IngestConsole counters={counters} streamItems={streamItems} problemItems={[]} onContinue={vi.fn()} onFixProblem={vi.fn()} />);
    expect(screen.getByTestId("counter-docs")).toHaveTextContent("24");
  });

  it("renders entities discovered count", () => {
    render(<IngestConsole counters={counters} streamItems={streamItems} problemItems={[]} onContinue={vi.fn()} onFixProblem={vi.fn()} />);
    expect(screen.getByTestId("counter-entities")).toHaveTextContent("6");
  });

  it("renders agreements found count", () => {
    render(<IngestConsole counters={counters} streamItems={streamItems} problemItems={[]} onContinue={vi.fn()} onFixProblem={vi.fn()} />);
    expect(screen.getByTestId("counter-agreements")).toHaveTextContent("8");
  });

  it("renders classification stream items", () => {
    render(<IngestConsole counters={counters} streamItems={streamItems} problemItems={[]} onContinue={vi.fn()} onFixProblem={vi.fn()} />);
    expect(screen.getByText("Veritax UK Local File FY2024.pdf")).toBeInTheDocument();
    expect(screen.getByText("IC Royalty Agreement US-UK.pdf")).toBeInTheDocument();
  });

  it("renders problem pile when problems exist", () => {
    render(<IngestConsole counters={counters} streamItems={streamItems} problemItems={problemItems} onContinue={vi.fn()} onFixProblem={vi.fn()} />);
    expect(screen.getByText("corrupt-file.pdf")).toBeInTheDocument();
    expect(screen.getByText("duplicate-policy.pdf")).toBeInTheDocument();
  });

  it("shows issue type label for each problem item", () => {
    render(<IngestConsole counters={counters} streamItems={streamItems} problemItems={problemItems} onContinue={vi.fn()} onFixProblem={vi.fn()} />);
    expect(screen.getByText("unreadable")).toBeInTheDocument();
    expect(screen.getByText("duplicate")).toBeInTheDocument();
  });

  it("calls onFixProblem with item id when fix action clicked", async () => {
    const onFixProblem = vi.fn();
    render(<IngestConsole counters={counters} streamItems={streamItems} problemItems={problemItems} onContinue={vi.fn()} onFixProblem={onFixProblem} />);
    const fixButtons = screen.getAllByRole("button", { name: /retry|skip|mark/i });
    await userEvent.click(fixButtons[0]);
    expect(onFixProblem).toHaveBeenCalledWith("p1", expect.any(String));
  });

  it("Continue to Teach button is present", () => {
    render(<IngestConsole counters={counters} streamItems={streamItems} problemItems={[]} onContinue={vi.fn()} onFixProblem={vi.fn()} />);
    expect(screen.getByRole("button", { name: /continue.*teach/i })).toBeInTheDocument();
  });
});
