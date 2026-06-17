import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FindingLifecycleIndicator } from "../finding-lifecycle-indicator";

const STAGES = [
  "detected",
  "triaged",
  "in-remediation",
  "reviewed",
  "resolved",
  "verify-next-cycle",
] as const;

describe("FindingLifecycleIndicator", () => {
  it("renders all 6 lifecycle stage labels", () => {
    render(<FindingLifecycleIndicator status="detected" />);
    expect(screen.getByText(/detected/i)).toBeInTheDocument();
    expect(screen.getByText(/triaged/i)).toBeInTheDocument();
    expect(screen.getByText(/reviewed/i)).toBeInTheDocument();
    expect(screen.getByText(/resolved/i)).toBeInTheDocument();
  });

  it("marks the current stage as active", () => {
    render(<FindingLifecycleIndicator status="triaged" />);
    const active = screen.getByTestId("stage-triaged");
    expect(active).toHaveAttribute("aria-current", "step");
  });

  it("marks completed stages before the active one", () => {
    render(<FindingLifecycleIndicator status="reviewed" />);
    expect(screen.getByTestId("stage-detected")).toHaveClass("completed");
    expect(screen.getByTestId("stage-triaged")).toHaveClass("completed");
    expect(screen.getByTestId("stage-in-remediation")).toHaveClass("completed");
  });

  it("does not mark future stages as completed", () => {
    render(<FindingLifecycleIndicator status="triaged" />);
    expect(screen.getByTestId("stage-reviewed")).not.toHaveClass("completed");
    expect(screen.getByTestId("stage-resolved")).not.toHaveClass("completed");
  });

  it("shows next-cycle verification date when status is resolved", () => {
    render(
      <FindingLifecycleIndicator
        status="resolved"
        nextCycleDate="2025-06-30"
      />
    );
    expect(screen.getByTestId("next-cycle-notice")).toHaveTextContent("2025-06-30");
  });
});
