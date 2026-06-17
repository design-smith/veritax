import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BoardPackAction } from "../board-pack-action";
import { PermissionsProvider } from "@/contexts/permissions-context";

function wrap(role: "vp" | "manager" | "analyst" | "adjacent" | "admin", ui: React.ReactNode) {
  return render(<PermissionsProvider role={role}>{ui}</PermissionsProvider>);
}

describe("BoardPackAction", () => {
  it("renders the Generate board pack button for VP", () => {
    wrap("vp", <BoardPackAction onRequestPlan={vi.fn()} />);
    expect(screen.getByRole("button", { name: /generate board pack/i })).toBeInTheDocument();
  });

  it("renders the button for manager", () => {
    wrap("manager", <BoardPackAction onRequestPlan={vi.fn()} />);
    expect(screen.getByRole("button", { name: /generate board pack/i })).toBeInTheDocument();
  });

  it("hides the button for analyst", () => {
    wrap("analyst", <BoardPackAction onRequestPlan={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /generate board pack/i })).not.toBeInTheDocument();
  });

  it("hides the button for adjacent role", () => {
    wrap("adjacent", <BoardPackAction onRequestPlan={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /generate board pack/i })).not.toBeInTheDocument();
  });

  it("calls onRequestPlan when button clicked", async () => {
    const onRequestPlan = vi.fn();
    wrap("manager", <BoardPackAction onRequestPlan={onRequestPlan} />);
    await userEvent.click(screen.getByRole("button", { name: /generate board pack/i }));
    expect(onRequestPlan).toHaveBeenCalledOnce();
  });

  it("shows generating state while run is in progress", () => {
    wrap("vp", <BoardPackAction onRequestPlan={vi.fn()} isGenerating />);
    expect(screen.getByText(/generating/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generating/i })).toBeDisabled();
  });

  it("shows a link to the run when runRef is provided", () => {
    wrap("manager", <BoardPackAction onRequestPlan={vi.fn()} isGenerating runRef="/runs/r1" />);
    expect(screen.getByRole("link", { name: /view run/i })).toHaveAttribute("href", "/runs/r1");
  });
});
