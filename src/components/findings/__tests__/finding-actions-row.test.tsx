import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FindingActionsRow } from "../finding-actions-row";

describe("FindingActionsRow", () => {
  const base = {
    findingId: "fn1",
    findingType: "exception" as const,
    reviewerState: "unreviewed" as const,
    onConfirm: vi.fn(),
    onDismiss: vi.fn(),
    onAssign: vi.fn(),
    onComment: vi.fn(),
    onExportMemo: vi.fn(),
  };

  it("renders Confirm, Dismiss, Assign, Comment, and Export memo buttons", () => {
    render(<FindingActionsRow {...base} />);
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /assign/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /comment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export memo/i })).toBeInTheDocument();
  });

  it("calls onConfirm when Confirm clicked", async () => {
    const onConfirm = vi.fn();
    render(<FindingActionsRow {...base} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledWith("fn1");
  });

  it("shows Confirm as disabled when already confirmed", () => {
    render(<FindingActionsRow {...base} reviewerState="confirmed" />);
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
  });

  it("requires a reason before Dismiss can submit", async () => {
    render(<FindingActionsRow {...base} />);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    const confirmDismiss = screen.getByRole("button", { name: /confirm dismiss/i });
    expect(confirmDismiss).toBeDisabled();
  });

  it("calls onDismiss with reason when dismiss form submitted", async () => {
    const onDismiss = vi.fn();
    render(<FindingActionsRow {...base} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "Not a finding");
    await userEvent.click(screen.getByRole("button", { name: /confirm dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith("fn1", "Not a finding");
  });

  it("shows Create data request button only for gap-type findings", () => {
    const { rerender } = render(<FindingActionsRow {...base} findingType="gap" />);
    expect(screen.getByRole("button", { name: /data request/i })).toBeInTheDocument();
    rerender(<FindingActionsRow {...base} findingType="exception" />);
    expect(screen.queryByRole("button", { name: /data request/i })).not.toBeInTheDocument();
  });
});
