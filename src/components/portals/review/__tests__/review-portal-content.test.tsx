import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ReviewPortalContent } from "../review-portal-content";

describe("ReviewPortalContent", () => {
  it("opens an assigned document into the reviewer workspace with scoped evidence", async () => {
    const user = userEvent.setup();
    render(<ReviewPortalContent />);

    expect(screen.getByRole("heading", { name: /review queue/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /veritax uk local file fy2024/i }));

    expect(screen.getByRole("tab", { name: /workspace/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: /workspace lite/i })).toBeInTheDocument();
    expect(screen.getAllByText(/scoped document canvas/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/3 redlines/i)).toBeInTheDocument();
    expect(screen.getAllByText(/evidence on demand/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/limited to shared scope/i)).toBeInTheDocument();
  });

  it("records reviewer comments and moves the assignment to changes requested", async () => {
    const user = userEvent.setup();
    render(<ReviewPortalContent />);

    await user.click(screen.getByRole("button", { name: /veritax uk local file fy2024/i }));
    await user.type(screen.getByLabelText(/add reviewer comment/i), "Clarify tested-party margin support.");
    await user.click(screen.getByRole("button", { name: /add comment/i }));

    expect(screen.getByText("Clarify tested-party margin support.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /request changes/i }));
    await user.click(screen.getByRole("tab", { name: /queue/i }));

    expect(screen.getByText("changes-requested")).toBeInTheDocument();
  });

  it("seals a reviewed document and leaves a manifest receipt", async () => {
    const user = userEvent.setup();
    render(<ReviewPortalContent />);

    await user.click(screen.getByRole("button", { name: /group master file fy2024/i }));
    await user.click(screen.getByRole("button", { name: /open sign ceremony/i }));
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /seal.*sign|sign.*seal/i }));

    expect(screen.getByTestId("manifest-receipt")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /queue/i }));
    expect(screen.getAllByText("signed").length).toBeGreaterThan(1);
  });

  it("logs reviewer hours against the selected document", async () => {
    const user = userEvent.setup();
    render(<ReviewPortalContent />);

    await user.click(screen.getByRole("button", { name: /veritax uk local file fy2024/i }));
    await user.click(screen.getByRole("tab", { name: /hours log/i }));
    await user.type(screen.getByRole("spinbutton", { name: /hours/i }), "1.5");
    await user.click(screen.getByRole("button", { name: /log hours/i }));

    expect(screen.getByText(/4\.0h/)).toBeInTheDocument();
    expect(screen.getAllByText("Veritax UK Local File FY2024").length).toBeGreaterThan(1);
  });
});
