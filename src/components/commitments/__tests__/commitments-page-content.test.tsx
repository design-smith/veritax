import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  clearRecordedFrontendTelemetryEvents,
  getRecordedFrontendTelemetryEvents,
} from "@/lib/telemetry/product-telemetry";
import { CommitmentsPageContent } from "../commitments-page-content";

describe("CommitmentsPageContent", () => {
  afterEach(() => {
    clearRecordedFrontendTelemetryEvents();
  });

  it("filters commitments and manages executable plans, external tasks, and chase-up drafts", async () => {
    const user = userEvent.setup();
    render(<CommitmentsPageContent />);

    expect(screen.getByRole("columnheader", { name: /commitment/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /plan-state/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^mine$/i }));
    expect(screen.getByRole("row", { name: /Refresh benchmark study/i })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Obtain executed renewal/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /by me/i }));
    expect(screen.getByRole("row", { name: /Request Germany payroll data/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^team$/i }));
    const executableRow = screen.getByRole("row", { name: /Refresh benchmark study/i });
    await user.click(within(executableRow).getByRole("button", { name: /open commitment/i }));

    const detail = screen.getByRole("complementary", { name: /commitment detail/i });
    expect(within(detail).getByText(/Quoted source span/i)).toBeInTheDocument();
    expect(within(detail).getByText(/Compiled step plan/i)).toBeInTheDocument();

    await user.click(within(detail).getByRole("button", { name: /edit plan/i }));
    await user.clear(within(detail).getByLabelText(/plan instructions/i));
    await user.type(within(detail).getByLabelText(/plan instructions/i), "Refresh CUT comparables and stage only citations tied to UK royalty findings.");
    await user.click(within(detail).getByRole("button", { name: /save plan edits/i }));
    expect(within(detail).getByText(/stage only citations tied to UK royalty findings/i)).toBeInTheDocument();

    await user.click(within(detail).getByRole("button", { name: /approve and run/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/commitment plan approved and run queued/i);
    expect(within(detail).getByText(/^approved$/i)).toBeInTheDocument();
    expect(getRecordedFrontendTelemetryEvents()).toMatchObject([
      {
        name: "adoption.commitment_plan_approved",
        surface: "commitments",
      },
    ]);

    await user.click(screen.getByRole("button", { name: /^team$/i }));
    const externalRow = screen.getByRole("row", { name: /Obtain executed renewal/i });
    await user.click(within(externalRow).getByRole("button", { name: /open commitment/i }));

    const externalDetail = screen.getByRole("complementary", { name: /commitment detail/i });
    expect(within(externalDetail).getByText(/External task controls/i)).toBeInTheDocument();
    await user.click(within(externalDetail).getByRole("button", { name: /draft chase-up/i }));
    expect(within(externalDetail).getByText(/Marcus, can you send a status update/i)).toBeInTheDocument();

    await user.click(within(externalDetail).getByRole("button", { name: /mark done/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/external commitment completed/i);
    expect(within(externalDetail).getByText(/^completed$/i)).toBeInTheDocument();
  });
});
