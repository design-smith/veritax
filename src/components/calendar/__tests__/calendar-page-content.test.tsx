import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarPageContent } from "../calendar-page-content";

describe("CalendarPageContent", () => {
  it("manages obligation views, rulepack proposals, and manual entries", async () => {
    const user = userEvent.setup();
    render(<CalendarPageContent />);

    await user.click(screen.getByRole("tab", { name: /year wheel/i }));
    expect(screen.getByRole("region", { name: /year wheel/i })).toHaveTextContent(/jurisdiction rings/i);

    await user.click(screen.getByRole("tab", { name: /gantt/i }));
    expect(screen.getByRole("region", { name: /gantt/i })).toHaveTextContent(/hard deadlines/i);

    await user.click(screen.getByRole("tab", { name: /table/i }));

    await user.click(screen.getByRole("button", { name: /accept Brazil adds 3 obligations/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/Brazil rulepack proposal accepted/i);
    expect(screen.getByRole("row", { name: /Brazil ECF Filing FY2025/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add manual obligation/i }));
    await user.type(screen.getByLabelText(/obligation name/i), "India TP accountant engagement letter");
    await user.type(screen.getByLabelText(/entity/i), "Veritax India Services");
    await user.type(screen.getByLabelText(/jurisdiction/i), "IN");
    await user.type(screen.getByLabelText(/due date/i), "2025-04-15");
    await user.selectOptions(screen.getByLabelText(/owner/i), "u2");
    await user.click(screen.getByRole("button", { name: /save manual obligation/i }));

    const manualRow = screen.getByRole("row", { name: /India TP accountant engagement letter/i });
    expect(within(manualRow).getByText(/customer-defined/i)).toBeInTheDocument();
    expect(within(manualRow).getByText(/Marcus Webb/i)).toBeInTheDocument();
  });

  it("updates filing evidence, owner assignment, and snooze reasons", async () => {
    const user = userEvent.setup();
    render(<CalendarPageContent />);

    const franceRow = screen.getByRole("row", { name: /France CbCR Notification/i });
    await user.click(within(franceRow).getByRole("button", { name: /attach filing evidence/i }));
    await user.type(screen.getByLabelText(/evidence reference/i), "receipt-fr-cbcr-2025.pdf");
    await user.click(screen.getByRole("button", { name: /save filing evidence/i }));
    expect(within(franceRow).getByText(/^filed$/i)).toBeInTheDocument();
    expect(within(franceRow).getByText(/receipt-fr-cbcr-2025\.pdf/i)).toBeInTheDocument();

    const germanyRow = screen.getByRole("row", { name: /Germany Transfer Pricing Documentation Deadline/i });
    await user.click(within(germanyRow).getByRole("button", { name: /assign owner/i }));
    await user.selectOptions(screen.getByLabelText(/new owner/i), "u1");
    await user.click(screen.getByRole("button", { name: /save owner/i }));
    expect(within(germanyRow).getByText(/Alexandra Chen/i)).toBeInTheDocument();

    const singaporeRow = screen.getByRole("row", { name: /Singapore TP Documentation/i });
    await user.click(within(singaporeRow).getByRole("button", { name: /snooze with reason/i }));
    await user.type(screen.getByLabelText(/snooze reason/i), "Awaiting signed filing receipt from local advisor");
    await user.click(screen.getByRole("button", { name: /save snooze/i }));
    expect(within(singaporeRow).getByText(/^snoozed$/i)).toBeInTheDocument();
    expect(within(singaporeRow).getByText(/Awaiting signed filing receipt/i)).toBeInTheDocument();
  });
});
