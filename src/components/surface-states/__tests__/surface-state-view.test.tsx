import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SurfaceStateView } from "../index";

describe("SurfaceStateView", () => {
  it("renders the five PRD surface states through one public interface", async () => {
    const onRetry = vi.fn();
    const onRequestAccess = vi.fn();

    const { rerender } = render(
      <SurfaceStateView
        state={{ kind: "empty", heading: "No findings", description: "Mirror findings will appear here." }}
      />,
    );
    expect(screen.getByText("No findings")).toBeInTheDocument();

    rerender(<SurfaceStateView state={{ kind: "loading", rows: 2 }} />);
    expect(screen.getByLabelText("Loading")).toHaveAttribute("aria-busy", "true");

    rerender(
      <SurfaceStateView state={{ kind: "degraded", affectedSources: ["SharePoint"] }}>
        <div>Stale data still renders</div>
      </SurfaceStateView>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("SharePoint");
    expect(screen.getByText("Stale data still renders")).toBeInTheDocument();

    rerender(
      <SurfaceStateView
        state={{
          kind: "denied",
          tierName: "Sensitive",
          reason: "Named access is required.",
          onRequestAccess,
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /request access/i }));
    expect(onRequestAccess).toHaveBeenCalledOnce();

    rerender(<SurfaceStateView state={{ kind: "error", incidentId: "inc-1", onRetry }} />);
    expect(screen.getByText("Ref: inc-1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
