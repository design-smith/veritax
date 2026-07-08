import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectorsPageContent } from "../connectors-page-content";

describe("ConnectorsPageContent", () => {
  it("manages active source actions with custody, scope ceilings, logs, and consequences", async () => {
    const user = userEvent.setup();
    render(<ConnectorsPageContent />);

    expect(screen.getByRole("columnheader", { name: /source/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /custody/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /scope summary/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /owner/i })).toBeInTheDocument();

    const sapRow = screen.getByRole("row", { name: /SAP ERP/i });
    expect(sapRow).toHaveTextContent(/shared/i);
    expect(sapRow).toHaveTextContent(/IT permits: GL read-only/i);

    await user.click(within(sapRow).getByRole("button", { name: /open sync log/i }));
    expect(screen.getByRole("region", { name: /sync log/i })).toHaveTextContent(/06:00 sync completed/i);

    const payrollRow = screen.getByRole("row", { name: /Payroll System/i });
    await user.click(within(payrollRow).getByRole("button", { name: /pause/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/Payroll System paused/i);
    expect(payrollRow).toHaveTextContent(/paused/i);

    await user.click(within(sapRow).getByRole("button", { name: /edit scope/i }));
    const scopePanel = screen.getByRole("region", { name: /edit source scope/i });
    expect(scopePanel).toHaveTextContent(/IT permits: GL read-only/i);
    await user.clear(within(scopePanel).getByLabelText(/scope summary/i));
    await user.type(within(scopePanel).getByLabelText(/scope summary/i), "GL FY2024 read-only");
    await user.click(within(scopePanel).getByRole("button", { name: /save scope/i }));
    expect(sapRow).toHaveTextContent(/GL FY2024 read-only/i);

    await user.click(within(sapRow).getByRole("button", { name: /request backfill/i }));
    const backfillPanel = screen.getByRole("region", { name: /historical backfill/i });
    expect(backfillPanel).toHaveTextContent(/manager approval required/i);
    await user.selectOptions(within(backfillPanel).getByLabelText(/backfill scope/i), "FY2022-FY2024");
    await user.click(within(backfillPanel).getByRole("button", { name: /submit backfill request/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/backfill request routed for manager approval/i);
    expect(screen.getByRole("region", { name: /backfill status/i })).toHaveTextContent(/FY2022-FY2024/i);

    const emailRow = screen.getByRole("row", { name: /email forward/i });
    await user.click(within(emailRow).getByRole("button", { name: /disconnect/i }));
    const disconnectPanel = screen.getByRole("region", { name: /disconnect consequence/i });
    expect(disconnectPanel).toHaveTextContent(/47 documents become reference-orphaned/i);
    await user.click(within(disconnectPanel).getByRole("button", { name: /confirm disconnect/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/email forward disconnected/i);
    expect(screen.queryByRole("row", { name: /email forward/i })).not.toBeInTheDocument();
  });

  it("handles add-source policy paths, IT request tracking, and personal email ladder", async () => {
    const user = userEvent.setup();
    render(<ConnectorsPageContent />);

    await user.click(screen.getByRole("tab", { name: /add source/i }));

    const licenseCard = screen.getByRole("article", { name: /License Database/i });
    expect(licenseCard).toHaveTextContent(/Self-serve/i);
    await user.click(within(licenseCard).getByRole("button", { name: /^connect$/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/License Database connected/i);

    await user.click(screen.getByRole("tab", { name: /active sources/i }));
    expect(screen.getByRole("row", { name: /License Database/i })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /add source/i }));
    const workdayCard = screen.getByRole("article", { name: /Workday HRIS/i });
    expect(workdayCard).toHaveTextContent(/Request/i);
    await user.click(within(workdayCard).getByRole("button", { name: /request access/i }));
    const requestForm = screen.getByRole("region", { name: /source request form/i });
    await user.type(within(requestForm).getByLabelText(/business justification/i), "Need payroll support for Germany substance testing.");
    await user.click(within(requestForm).getByRole("button", { name: /submit source request/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/Workday HRIS request routed to IT/i);
    expect(screen.getByRole("region", { name: /source request status/i })).toHaveTextContent(/pending IT/i);

    const slackCard = screen.getByRole("article", { name: /Slack/i });
    expect(slackCard).toHaveTextContent(/Disabled/i);
    expect(within(slackCard).getByRole("button", { name: /disabled by IT/i })).toBeDisabled();

    const emailLadder = screen.getByRole("region", { name: /personal email ladder/i });
    expect(emailLadder).toHaveTextContent(/ingest-abc123@veritax\.io/i);
    await user.click(within(emailLadder).getByRole("button", { name: /copy forward address/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/Forward address copied/i);

    await user.click(within(emailLadder).getByRole("button", { name: /connect mailbox OAuth/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/Mailbox OAuth connected/i);

    await user.click(screen.getByRole("tab", { name: /active sources/i }));
    expect(screen.getByRole("row", { name: /Mailbox OAuth/i })).toBeInTheDocument();
  });
});
