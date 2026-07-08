import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SettingsPageContent } from "../settings-page-content";

describe("SettingsPageContent", () => {
  it("lets a manager review all settings tabs and approve a scoped standing instruction with conflict precedence visible", async () => {
    const user = userEvent.setup();
    render(<SettingsPageContent />);

    for (const tab of [
      "Standing Instructions",
      "Materiality & thresholds",
      "Templates & Brand",
      "My connections",
      "Delegation",
      "Notifications",
    ]) {
      expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument();
    }

    await user.selectOptions(screen.getByLabelText("Instruction tier"), "methodology");
    await user.selectOptions(screen.getByLabelText("Jurisdiction"), "Singapore");
    await user.selectOptions(screen.getByLabelText("Document type"), "Local file");
    await user.selectOptions(screen.getByLabelText("Section"), "Benchmark analysis");
    await user.type(
      screen.getByLabelText("Instruction text"),
      "Use operating-margin interquartile support for SG routine distributor runs."
    );
    await user.click(screen.getByRole("button", { name: "Propose instruction" }));

    expect(screen.getByText("Conflict inspector")).toBeInTheDocument();
    expect(screen.getByText(/More specific methodology instruction takes precedence/i)).toBeInTheDocument();

    const proposedInstruction = screen.getByRole("article", {
      name: /Use operating-margin interquartile support/i,
    });
    expect(within(proposedInstruction).getByText("Pending manager approval")).toBeInTheDocument();

    await user.click(within(proposedInstruction).getByRole("button", { name: "Approve instruction" }));

    expect(within(proposedInstruction).getByText("Approved")).toBeInTheDocument();
    expect(
      within(proposedInstruction).getByText(/Applies to Singapore \/ Local file \/ Benchmark analysis/i)
    ).toBeInTheDocument();
  });

  it("lets a manager save materiality thresholds for the workspace", async () => {
    const user = userEvent.setup();
    render(<SettingsPageContent />);

    await user.click(screen.getByRole("tab", { name: "Materiality & thresholds" }));

    await user.selectOptions(screen.getByLabelText("Default currency"), "USD");
    await user.clear(screen.getByLabelText("Flow materiality threshold"));
    await user.type(screen.getByLabelText("Flow materiality threshold"), "500000");
    await user.clear(screen.getByLabelText("Finding escalation threshold"));
    await user.type(screen.getByLabelText("Finding escalation threshold"), "75000");
    await user.click(screen.getByRole("button", { name: "Save thresholds" }));

    expect(screen.getByText("Saved materiality policy")).toBeInTheDocument();
    expect(screen.getByText("USD 500,000 flow threshold")).toBeInTheDocument();
    expect(screen.getByText("USD 75,000 finding escalation")).toBeInTheDocument();
  });

  it("lets a manager attach template masters and render a brand preview", async () => {
    const user = userEvent.setup();
    render(<SettingsPageContent />);

    await user.click(screen.getByRole("tab", { name: "Templates & Brand" }));

    await user.upload(
      screen.getByLabelText("Word master"),
      new File(["word master"], "Global TP Local File Master.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    );
    await user.upload(
      screen.getByLabelText("PPT master"),
      new File(["ppt master"], "Board Pack Master.pptx", {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      })
    );
    await user.type(screen.getByLabelText("Letterhead name"), "Veritax Tax Office letterhead");
    await user.type(screen.getByLabelText("Approved term"), "intercompany agreement");
    await user.type(screen.getByLabelText("Preferred wording"), "ICA");
    await user.click(screen.getByRole("button", { name: "Add terminology" }));
    await user.click(screen.getByRole("button", { name: "Render preview" }));

    expect(screen.getByText("Global TP Local File Master.docx")).toBeInTheDocument();
    expect(screen.getByText("Board Pack Master.pptx")).toBeInTheDocument();
    expect(screen.getByText("Veritax Tax Office letterhead")).toBeInTheDocument();
    expect(screen.getByText("intercompany agreement -> ICA")).toBeInTheDocument();
    expect(screen.getByText("Preview render ready")).toBeInTheDocument();
  });

  it("lets a user update personal connection consent states", async () => {
    const user = userEvent.setup();
    render(<SettingsPageContent />);

    await user.click(screen.getByRole("tab", { name: "My connections" }));

    expect(screen.getByText("IT permits label-scoped read-only intake")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Calendar meeting intake consent" }));
    await user.click(screen.getByRole("button", { name: "Save connection consent" }));

    expect(screen.getByText("Calendar meeting intake: consent enabled")).toBeInTheDocument();
    expect(screen.getByText("Mailbox OAuth: consent paused")).toBeInTheDocument();
  });

  it("lets a user save a time-boxed gate delegate", async () => {
    const user = userEvent.setup();
    render(<SettingsPageContent />);

    await user.click(screen.getByRole("tab", { name: "Delegation" }));

    await user.selectOptions(screen.getByLabelText("Gate delegate"), "Marcus Webb");
    await user.clear(screen.getByLabelText("Delegation expires on"));
    await user.type(screen.getByLabelText("Delegation expires on"), "2026-07-31");
    await user.click(screen.getByRole("button", { name: "Save delegation" }));

    expect(screen.getByText("Active delegate: Marcus Webb")).toBeInTheDocument();
    expect(screen.getByText("Ends 2026-07-31")).toBeInTheDocument();
    expect(screen.getByText("Gate requests route to this delegate until the time box ends.")).toBeInTheDocument();
  });

  it("lets a user save digest cadence by notification category", async () => {
    const user = userEvent.setup();
    render(<SettingsPageContent />);

    await user.click(screen.getByRole("tab", { name: "Notifications" }));

    await user.selectOptions(screen.getByLabelText("Findings cadence"), "daily");
    await user.selectOptions(screen.getByLabelText("Commitments cadence"), "weekly");
    await user.click(screen.getByRole("button", { name: "Save notification cadence" }));

    expect(screen.getByText("Findings digest: daily")).toBeInTheDocument();
    expect(screen.getByText("Commitments digest: weekly")).toBeInTheDocument();
    expect(screen.getByText("Gate requests stay realtime")).toBeInTheDocument();
  });
});
