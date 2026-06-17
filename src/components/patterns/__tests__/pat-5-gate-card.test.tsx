import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GateCard } from "../pat-5-gate-card";
import { mockGateRequests, mockUsers } from "@/lib/mock";

const gate = mockGateRequests[0]; // UK Local File review

describe("GateCard", () => {
  const base = {
    gate,
    objectSummary: "Veritax UK Local File FY2024 v2 — 42 pages, 3 sections pending sign-off",
    requester: mockUsers[2],
    onApprove: vi.fn(),
    onRequestChanges: vi.fn(),
    onReject: vi.fn(),
    onDelegate: vi.fn(),
  };

  it("renders object name and requester", () => {
    render(<GateCard {...base} />);
    expect(screen.getByText(gate.objectName)).toBeInTheDocument();
    expect(screen.getByText(/Ikaika Choi/i)).toBeInTheDocument();
  });

  it("renders SLA information", () => {
    render(<GateCard {...base} />);
    expect(screen.getByText(/48/)).toBeInTheDocument();
  });

  it("renders escalation path", () => {
    render(<GateCard {...base} />);
    expect(screen.getByText(/Manager → VP/i)).toBeInTheDocument();
  });

  it("calls onApprove when Approve & promote clicked", async () => {
    const onApprove = vi.fn();
    render(<GateCard {...base} onApprove={onApprove} />);
    await userEvent.click(screen.getByRole("button", { name: /approve/i }));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("requires a non-empty comment before Request changes can submit", async () => {
    render(<GateCard {...base} />);
    await userEvent.click(screen.getByRole("button", { name: /request changes/i }));
    // Comment input appears
    const submitBtn = screen.getByRole("button", { name: /send/i });
    expect(submitBtn).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText(/comment/i), "Please fix section 4.2");
    expect(submitBtn).not.toBeDisabled();
  });

  it("requires a reason before Reject can submit", async () => {
    render(<GateCard {...base} />);
    await userEvent.click(screen.getByRole("button", { name: /reject/i }));
    expect(screen.getByRole("button", { name: /confirm reject/i })).toBeDisabled();
  });

  it("calls onRequestChanges with comment text", async () => {
    const onRequestChanges = vi.fn();
    render(<GateCard {...base} onRequestChanges={onRequestChanges} />);
    await userEvent.click(screen.getByRole("button", { name: /request changes/i }));
    await userEvent.type(screen.getByPlaceholderText(/comment/i), "Needs more detail");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onRequestChanges).toHaveBeenCalledWith("Needs more detail");
  });
});
