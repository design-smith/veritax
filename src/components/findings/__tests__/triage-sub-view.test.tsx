import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TriageSubView } from "../triage-sub-view";
import { mockFindings } from "@/lib/mock";

// Use some findings as triage candidates
const candidates = mockFindings.slice(0, 3);

describe("TriageSubView", () => {
  it("renders the Candidates — not yet findings banner", () => {
    render(<TriageSubView candidates={candidates} onPromote={vi.fn()} />);
    expect(screen.getByText(/candidates — not yet findings/i)).toBeInTheDocument();
  });

  it("renders all candidate rows", () => {
    render(<TriageSubView candidates={candidates} onPromote={vi.fn()} />);
    candidates.forEach((c) => {
      expect(screen.getByText(c.id)).toBeInTheDocument();
    });
  });

  it("shows Promote to finding button for each candidate", () => {
    render(<TriageSubView candidates={candidates} onPromote={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /promote/i })).toHaveLength(candidates.length);
  });

  it("requires a reason before Promote can submit", async () => {
    render(<TriageSubView candidates={[candidates[0]]} onPromote={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /promote/i }));
    expect(screen.getByRole("button", { name: /confirm promote/i })).toBeDisabled();
  });

  it("calls onPromote with id and reason on confirm", async () => {
    const onPromote = vi.fn();
    render(<TriageSubView candidates={[candidates[0]]} onPromote={onPromote} />);
    await userEvent.click(screen.getByRole("button", { name: /promote/i }));
    await userEvent.type(screen.getByPlaceholderText(/reason/i), "Rate clearly exceeds range");
    await userEvent.click(screen.getByRole("button", { name: /confirm promote/i }));
    expect(onPromote).toHaveBeenCalledWith(candidates[0].id, "Rate clearly exceeds range");
  });
});
