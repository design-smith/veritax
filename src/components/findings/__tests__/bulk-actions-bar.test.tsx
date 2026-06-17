import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkActionsBar } from "../bulk-actions-bar";
import { mockFindings } from "@/lib/mock";

const selected = mockFindings.slice(0, 3);

describe("BulkActionsBar", () => {
  const base = {
    selected,
    onAssign: vi.fn(),
    onWatch: vi.fn(),
    onExportList: vi.fn(),
    onMoveToTriage: vi.fn(),
  };

  it("shows the selection count", () => {
    render(<BulkActionsBar {...base} />);
    expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
  });

  it("renders Assign, Watch, Export list, and Move to triage actions", () => {
    render(<BulkActionsBar {...base} />);
    expect(screen.getByRole("button", { name: /assign/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /watch/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export list/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move to triage/i })).toBeInTheDocument();
  });

  it("does not render a Dismiss action (no bulk dismiss)", () => {
    render(<BulkActionsBar {...base} />);
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it("calls onAssign with selected findings when Assign clicked", async () => {
    const onAssign = vi.fn();
    render(<BulkActionsBar {...base} onAssign={onAssign} />);
    await userEvent.click(screen.getByRole("button", { name: /assign/i }));
    expect(onAssign).toHaveBeenCalledWith(selected);
  });

  it("calls onWatch with selected findings when Watch clicked", async () => {
    const onWatch = vi.fn();
    render(<BulkActionsBar {...base} onWatch={onWatch} />);
    await userEvent.click(screen.getByRole("button", { name: /watch/i }));
    expect(onWatch).toHaveBeenCalledWith(selected);
  });

  it("calls onMoveToTriage when Move to triage clicked after confirming with reason", async () => {
    const onMoveToTriage = vi.fn();
    render(<BulkActionsBar {...base} onMoveToTriage={onMoveToTriage} />);
    await userEvent.click(screen.getByRole("button", { name: /move to triage/i }));
    await userEvent.type(screen.getByPlaceholderText(/reason/i), "Below materiality threshold");
    await userEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onMoveToTriage).toHaveBeenCalledWith(selected, "Below materiality threshold");
  });
});
