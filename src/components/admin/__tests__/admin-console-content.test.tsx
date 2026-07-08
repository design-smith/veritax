import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdminConsoleContent } from "../admin-console-content";

describe("AdminConsoleContent", () => {
  it("lets an admin save a manual role override from the SCIM-read members view", async () => {
    const user = userEvent.setup();
    render(<AdminConsoleContent />);

    for (const tab of ["Members & roles", "Connector policy", "Audit log", "Pending requests"]) {
      expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument();
    }

    const ikaikaRow = screen.getByRole("row", { name: /Ikaika Choi/i });
    expect(within(ikaikaRow).getByText("SCIM read")).toBeInTheDocument();
    expect(within(ikaikaRow).getAllByText("analyst").length).toBeGreaterThan(0);

    await user.selectOptions(within(ikaikaRow).getByLabelText("Manual role override for Ikaika Choi"), "manager");
    await user.click(within(ikaikaRow).getByRole("button", { name: "Save role override for Ikaika Choi" }));

    expect(within(ikaikaRow).getByText("manual override")).toBeInTheDocument();
    expect(within(ikaikaRow).getAllByText("manager").length).toBeGreaterThan(0);
    expect(screen.getByText("Role override saved: Ikaika Choi -> manager")).toBeInTheDocument();
  });

  it("lets an admin update connector policy state, ceiling, and destination permissions", async () => {
    const user = userEvent.setup();
    render(<AdminConsoleContent />);

    await user.click(screen.getByRole("tab", { name: "Connector policy" }));

    const messagingRow = screen.getByRole("row", { name: /Messaging/i });
    expect(within(messagingRow).getAllByText("Disabled").length).toBeGreaterThan(0);

    await user.selectOptions(within(messagingRow).getByLabelText("Policy state for Messaging"), "request");
    await user.selectOptions(
      within(messagingRow).getByLabelText("Scope ceiling for Messaging"),
      "Label-scoped read-only"
    );
    await user.click(within(messagingRow).getByRole("checkbox", { name: "Allow SharePoint write for Messaging" }));
    await user.click(within(messagingRow).getByRole("button", { name: "Save connector policy for Messaging" }));

    expect(within(messagingRow).getAllByText("Request").length).toBeGreaterThan(0);
    expect(within(messagingRow).getAllByText("Label-scoped read-only").length).toBeGreaterThan(0);
    expect(within(messagingRow).getByText("SharePoint write allowed")).toBeInTheDocument();
    expect(screen.getByText("Connector policy saved: Messaging")).toBeInTheDocument();
  });

  it("lets an admin search audit metadata without rendering event content", async () => {
    const user = userEvent.setup();
    render(<AdminConsoleContent />);

    await user.click(screen.getByRole("tab", { name: "Audit log" }));

    expect(screen.getByText("Admin metadata only. Record content is never rendered here.")).toBeInTheDocument();
    expect(screen.getByText("/library/d2")).toBeInTheDocument();
    expect(screen.queryByText("Review requested for Veritax UK Local File FY2024 v2")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Search audit metadata"), "gate");

    expect(screen.getAllByText("gate_requested").length).toBeGreaterThan(0);
    expect(screen.queryByText("document_ingested")).not.toBeInTheDocument();
  });

  it("lets an admin approve and deny pending access and connector requests", async () => {
    const user = userEvent.setup();
    render(<AdminConsoleContent />);

    await user.click(screen.getByRole("tab", { name: "Pending requests" }));

    expect(screen.getByText("Analyst Ikaika Choi requests Sensitive-tier named access")).toBeInTheDocument();
    expect(screen.getByText("Sarah Kimura requests connection to Workday HRIS")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Approve request pr1" }));
    await user.click(screen.getByRole("button", { name: "Deny request pr2" }));

    expect(screen.getByText("pr1 approved")).toBeInTheDocument();
    expect(screen.getByText("pr2 denied")).toBeInTheDocument();
    expect(screen.getByText("Pending queue clear")).toBeInTheDocument();
  });
});
