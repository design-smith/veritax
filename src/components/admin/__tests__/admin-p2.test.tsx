import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SensitivityAccessManager } from "../sensitivity-access-manager";
import { RetentionScheduleEditor } from "../retention-schedule-editor";
import { BreakGlassDialog } from "../break-glass-dialog";
import { mockUsers } from "@/lib/mock";

// ── SensitivityAccessManager ──────────────────────────────────────────────────

const namedUsers = [mockUsers[0], mockUsers[1]]; // u1 vp, u2 manager

describe("SensitivityAccessManager", () => {
  it("renders the current named-access list", () => {
    render(<SensitivityAccessManager tier="sensitive" namedUsers={namedUsers} allUsers={mockUsers} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("Alexandra Chen")).toBeInTheDocument();
    expect(screen.getByText("Marcus Webb")).toBeInTheDocument();
  });

  it("shows the tier label", () => {
    render(<SensitivityAccessManager tier="sensitive" namedUsers={namedUsers} allUsers={mockUsers} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getAllByText(/sensitive/i).length).toBeGreaterThan(0);
  });

  it("renders a remove button per user in the access list", () => {
    render(<SensitivityAccessManager tier="sensitive" namedUsers={namedUsers} allUsers={mockUsers} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(namedUsers.length);
  });

  it("calls onRemove with user id when Remove clicked", async () => {
    const onRemove = vi.fn();
    render(<SensitivityAccessManager tier="sensitive" namedUsers={namedUsers} allUsers={mockUsers} onAdd={vi.fn()} onRemove={onRemove} />);
    await userEvent.click(screen.getAllByRole("button", { name: /remove/i })[0]);
    expect(onRemove).toHaveBeenCalledWith(namedUsers[0].id);
  });

  it("renders an Add user picker and calls onAdd on submit", async () => {
    const onAdd = vi.fn();
    render(<SensitivityAccessManager tier="sensitive" namedUsers={namedUsers} allUsers={mockUsers} onAdd={onAdd} onRemove={vi.fn()} />);
    await userEvent.selectOptions(screen.getByRole("combobox"), "u3");
    await userEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(onAdd).toHaveBeenCalledWith("u3");
  });
});

// ── RetentionScheduleEditor ───────────────────────────────────────────────────

const schedules = [
  { id: "rs1", docClass: "local-file", jurisdiction: "GB", daysToRetain: 2555, legalHold: false },
  { id: "rs2", docClass: "master-file", jurisdiction: "US", daysToRetain: 2555, legalHold: true },
  { id: "rs3", docClass: "ica", jurisdiction: "DE", daysToRetain: 3650, legalHold: false },
];

describe("RetentionScheduleEditor", () => {
  it("renders all schedule rows", () => {
    render(<RetentionScheduleEditor schedules={schedules} onChange={vi.fn()} />);
    expect(screen.getByText("local-file")).toBeInTheDocument();
    expect(screen.getByText("master-file")).toBeInTheDocument();
    expect(screen.getByText("ica")).toBeInTheDocument();
  });

  it("shows legal-hold toggle for each row", () => {
    render(<RetentionScheduleEditor schedules={schedules} onChange={vi.fn()} />);
    const toggles = screen.getAllByRole("checkbox");
    expect(toggles.length).toBe(schedules.length);
  });

  it("marks legal-hold as checked when active", () => {
    render(<RetentionScheduleEditor schedules={schedules} onChange={vi.fn()} />);
    const toggles = screen.getAllByRole("checkbox");
    // rs2 has legalHold: true — should be checked
    expect(toggles[1]).toBeChecked();
  });

  it("calls onChange when legal-hold toggled", async () => {
    const onChange = vi.fn();
    render(<RetentionScheduleEditor schedules={schedules} onChange={onChange} />);
    const toggles = screen.getAllByRole("checkbox");
    await userEvent.click(toggles[0]);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "rs1", legalHold: true })
    );
  });

  it("shows overriding note when legal hold is active", () => {
    render(<RetentionScheduleEditor schedules={schedules} onChange={vi.fn()} />);
    expect(screen.getByText(/legal hold.*overrides/i)).toBeInTheDocument();
  });
});

// ── BreakGlassDialog ──────────────────────────────────────────────────────────

describe("BreakGlassDialog", () => {
  it("renders the break-glass dialog when open", () => {
    render(<BreakGlassDialog open onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getAllByText(/break.glass/i).length).toBeGreaterThan(0);
  });

  it("requires a reason text before first confirmation is enabled", () => {
    render(<BreakGlassDialog open onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
  });

  it("enables first-confirm after reason is entered", async () => {
    render(<BreakGlassDialog open onClose={vi.fn()} onConfirm={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/reason/i), "Security incident investigation");
    expect(screen.getByRole("button", { name: /confirm/i })).not.toBeDisabled();
  });

  it("requires supervisor acknowledgment checkbox before final confirm", async () => {
    render(<BreakGlassDialog open onClose={vi.fn()} onConfirm={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/reason/i), "Security incident");
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    // Second step — supervisor ack checkbox should be required
    const ackCheckbox = screen.getByRole("checkbox", { name: /supervisor/i });
    expect(ackCheckbox).not.toBeChecked();
    expect(screen.getByRole("button", { name: /initiate break.glass/i })).toBeDisabled();
  });

  it("calls onConfirm with reason after dual-confirm completed", async () => {
    const onConfirm = vi.fn();
    render(<BreakGlassDialog open onClose={vi.fn()} onConfirm={onConfirm} />);
    // Step 1: enter reason and first-confirm
    await userEvent.type(screen.getByPlaceholderText(/reason/i), "Security incident investigation");
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    // Step 2: supervisor ack + final confirm
    await userEvent.click(screen.getByRole("checkbox", { name: /supervisor/i }));
    await userEvent.click(screen.getByRole("button", { name: /initiate break.glass/i }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "Security incident investigation" })
    );
  });

  it("shows auto-review ticket notice after confirmation", async () => {
    render(<BreakGlassDialog open onClose={vi.fn()} onConfirm={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/reason/i), "Security incident");
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /supervisor/i }));
    await userEvent.click(screen.getByRole("button", { name: /initiate break.glass/i }));
    expect(screen.getByText(/auto-review ticket|review ticket created/i)).toBeInTheDocument();
  });
});
