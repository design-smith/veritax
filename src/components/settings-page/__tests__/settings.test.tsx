import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StandingInstructionsList } from "../standing-instructions-list";
import { NotificationsSettings } from "../notifications-settings";
import { DelegationSettings } from "../delegation-settings";
import { mockUsers } from "@/lib/mock";

// ── Standing Instructions ────────────────────────────────────────────────────

const instructions = [
  { id: "si1", text: "Always use bullet points for lists", tier: "style" as const, scope: "global", createdBy: "u2" },
  { id: "si2", text: "Run IC scan after any source sync", tier: "run" as const, scope: "global", createdBy: "u2" },
  { id: "si3", text: "Use TNMM for all service flows", tier: "methodology" as const, scope: "Veritax UK Ltd", createdBy: "u1" },
];

describe("StandingInstructionsList", () => {
  it("renders all instructions", () => {
    render(<StandingInstructionsList instructions={instructions} onDelete={vi.fn()} />);
    instructions.forEach((i) => expect(screen.getByText(i.text)).toBeInTheDocument());
  });

  it("renders tier badge on each instruction", () => {
    render(<StandingInstructionsList instructions={instructions} onDelete={vi.fn()} />);
    expect(screen.getByText("style")).toBeInTheDocument();
    expect(screen.getByText("run")).toBeInTheDocument();
    expect(screen.getByText("methodology")).toBeInTheDocument();
  });

  it("renders scope label", () => {
    render(<StandingInstructionsList instructions={instructions} onDelete={vi.fn()} />);
    expect(screen.getByText("Veritax UK Ltd")).toBeInTheDocument();
  });

  it("calls onDelete when delete button clicked", async () => {
    const onDelete = vi.fn();
    render(<StandingInstructionsList instructions={instructions} onDelete={onDelete} />);
    const deleteButtons = screen.getAllByRole("button", { name: /delete|remove/i });
    await userEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith("si1");
  });
});

// ── Notifications ────────────────────────────────────────────────────────────

const categories = [
  { id: "findings", label: "Findings", cadence: "realtime" as const },
  { id: "runs", label: "Runs", cadence: "daily" as const },
  { id: "gates", label: "Gate requests", cadence: "realtime" as const },
  { id: "obligations", label: "Obligations", cadence: "weekly" as const },
];

describe("NotificationsSettings", () => {
  it("renders all notification categories", () => {
    render(<NotificationsSettings categories={categories} onChange={vi.fn()} />);
    categories.forEach((c) => expect(screen.getByText(c.label)).toBeInTheDocument());
  });

  it("renders cadence selector for each category", () => {
    render(<NotificationsSettings categories={categories} onChange={vi.fn()} />);
    expect(screen.getAllByRole("combobox").length).toBe(categories.length);
  });

  it("calls onChange with category id and new cadence when selector changes", async () => {
    const onChange = vi.fn();
    render(<NotificationsSettings categories={categories} onChange={onChange} />);
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[1], "weekly");
    expect(onChange).toHaveBeenCalledWith("runs", "weekly");
  });
});

// ── Delegation ───────────────────────────────────────────────────────────────

describe("DelegationSettings", () => {
  it("renders current delegate or 'None set' message", () => {
    render(<DelegationSettings users={mockUsers} currentDelegateId={null} expiresAt={null} onSave={vi.fn()} />);
    expect(screen.getByText(/none set|no delegate/i)).toBeInTheDocument();
  });

  it("renders delegate name when set", () => {
    render(<DelegationSettings users={mockUsers} currentDelegateId="u2" expiresAt="2025-12-31" onSave={vi.fn()} />);
    // Name appears in current-delegate display and select options
    expect(screen.getAllByText(/Marcus Webb/).length).toBeGreaterThan(0);
  });

  it("renders an expiry date when delegate is set", () => {
    render(<DelegationSettings users={mockUsers} currentDelegateId="u2" expiresAt="2025-12-31" onSave={vi.fn()} />);
    // format("2025-12-31") → "31 Dec 2025"
    expect(screen.getByText(/31 Dec 2025/)).toBeInTheDocument();
  });

  it("calls onSave with userId and expiresAt on form submit", async () => {
    const onSave = vi.fn();
    render(<DelegationSettings users={mockUsers} currentDelegateId={null} expiresAt={null} onSave={onSave} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /delegate/i }), "u3");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ userId: "u3" }));
  });
});
