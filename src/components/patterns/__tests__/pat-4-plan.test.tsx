import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanConfirmationModal } from "../pat-4-plan-confirmation";

const plan = {
  intent: "Re-scan all intercompany flows for FY2024 royalty rate compliance",
  steps: [
    { id: "s1", description: "Load corpus v.418", scope: "Full group" },
    { id: "s2", description: "Apply rulepack rp-2024.11", scope: "Royalty flows" },
    { id: "s3", description: "Score and rank findings", scope: "FY2024" },
  ],
  produces: ["Finding set: IC Scan FY2024"],
  invalidates: ["Previous finding set FY2024 (fn1–fn15)"],
  estimatedDuration: "~45 seconds",
  costClass: "standard" as const,
  instruction: "Focus on royalty rate deviations above 10% of benchmark",
  permissionCheck: "allowed" as const,
  tier: "run" as const,
};

describe("PlanConfirmationModal", () => {
  const base = {
    open: true,
    plan,
    onRun: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders the restated intent", () => {
    render(<PlanConfirmationModal {...base} />);
    expect(screen.getByText(/Re-scan all intercompany flows/)).toBeInTheDocument();
  });

  it("renders all steps in order", () => {
    render(<PlanConfirmationModal {...base} />);
    expect(screen.getByText("Load corpus v.418")).toBeInTheDocument();
    expect(screen.getByText("Score and rank findings")).toBeInTheDocument();
  });

  it("shows what will be produced and invalidated", () => {
    render(<PlanConfirmationModal {...base} />);
    expect(screen.getByText(/Finding set: IC Scan FY2024/)).toBeInTheDocument();
    expect(screen.getByText(/Previous finding set FY2024/)).toBeInTheDocument();
  });

  it("shows the instruction echo as editable", () => {
    render(<PlanConfirmationModal {...base} />);
    const instructionInput = screen.getByDisplayValue("Focus on royalty rate deviations above 10% of benchmark");
    expect(instructionInput).toBeInTheDocument();
  });

  it("calls onRun with the (possibly edited) instruction", async () => {
    const onRun = vi.fn();
    render(<PlanConfirmationModal {...base} onRun={onRun} />);
    await userEvent.click(screen.getByRole("button", { name: /^run$/i }));
    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({ instruction: plan.instruction })
    );
  });

  it("shows permission-check as green when allowed", () => {
    render(<PlanConfirmationModal {...base} />);
    expect(screen.getByText(/allowed/i)).toBeInTheDocument();
  });

  it("shows approval-required state for methodology-tier plan", () => {
    render(
      <PlanConfirmationModal
        {...base}
        plan={{ ...plan, tier: "methodology", permissionCheck: "requires-approval" }}
      />
    );
    expect(screen.getAllByText(/approval required/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^run$/i })).toBeDisabled();
  });

  it("calls onCancel when Cancel clicked", async () => {
    const onCancel = vi.fn();
    render(<PlanConfirmationModal {...base} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
