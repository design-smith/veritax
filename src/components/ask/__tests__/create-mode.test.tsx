import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateModePanel } from "../create-mode-panel";
import { mockUsers } from "@/lib/mock";

describe("CreateModePanel", () => {
  it("renders three creation options: Data Request, Commitment, Note", () => {
    render(<CreateModePanel users={mockUsers} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /data request/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /commitment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /note/i })).toBeInTheDocument();
  });

  it("shows data request form when Data Request selected", async () => {
    render(<CreateModePanel users={mockUsers} onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /data request/i }));
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
  });

  it("shows commitment form when Commitment selected", async () => {
    render(<CreateModePanel users={mockUsers} onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /commitment/i }));
    expect(screen.getByLabelText(/commitment text/i)).toBeInTheDocument();
  });

  it("shows note form when Note selected", async () => {
    render(<CreateModePanel users={mockUsers} onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /note/i }));
    expect(screen.getByLabelText(/note/i)).toBeInTheDocument();
  });

  it("calls onSubmit with type='data-request' and text on submit", async () => {
    const onSubmit = vi.fn();
    render(<CreateModePanel users={mockUsers} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: /data request/i }));
    await userEvent.type(screen.getByLabelText(/description/i), "Provide payroll data for DE entity");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: "data-request", text: "Provide payroll data for DE entity" })
    );
  });

  it("disables Create button until required field is filled", async () => {
    render(<CreateModePanel users={mockUsers} onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /data request/i }));
    expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
  });
});
