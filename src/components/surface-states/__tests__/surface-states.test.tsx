import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  EmptyState,
  LoadingState,
  DegradedState,
  DeniedState,
  ErrorState,
} from "../index";

describe("EmptyState", () => {
  it("renders heading, description, and primary action", () => {
    render(
      <EmptyState
        heading="No findings yet"
        description="Run an IC scan to surface exceptions."
        action={<button>Run IC Scan</button>}
      />
    );
    expect(screen.getByText("No findings yet")).toBeInTheDocument();
    expect(screen.getByText("Run an IC scan to surface exceptions.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run IC Scan" })).toBeInTheDocument();
  });

  it("renders without an action when none provided", () => {
    render(<EmptyState heading="Empty" description="Nothing here." />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("LoadingState", () => {
  it("renders skeleton placeholders, not a spinner", () => {
    const { container } = render(<LoadingState rows={3} />);
    const skeletons = container.querySelectorAll("[data-testid='skeleton']");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("DegradedState", () => {
  it("renders a source-down banner with affected scope", () => {
    render(
      <DegradedState affectedSources={["SAP ERP", "Payroll System"]}>
        <p>Stale data shown below</p>
      </DegradedState>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/SAP ERP/)).toBeInTheDocument();
    expect(screen.getByText(/Payroll System/)).toBeInTheDocument();
    expect(screen.getByText("Stale data shown below")).toBeInTheDocument();
  });
});

describe("DeniedState", () => {
  it("renders tier message and request-access action", async () => {
    const onRequest = vi.fn();
    render(
      <DeniedState
        tierName="Sensitive"
        reason="This object requires named access to the Sensitive tier."
        onRequestAccess={onRequest}
      />
    );
    expect(screen.getAllByText(/Sensitive/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/named access/)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /request access/i });
    await userEvent.click(btn);
    expect(onRequest).toHaveBeenCalledOnce();
  });

  it("hides request-access when no handler provided (existence leaked)", () => {
    render(
      <DeniedState
        tierName="Privileged"
        reason="Contact counsel."
      />
    );
    expect(screen.queryByRole("button", { name: /request access/i })).not.toBeInTheDocument();
  });
});

describe("ErrorState", () => {
  it("renders a retry button and incident reference", async () => {
    const onRetry = vi.fn();
    render(<ErrorState incidentId="INC-20251122-004" onRetry={onRetry} />);
    expect(screen.getByText(/INC-20251122-004/)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
