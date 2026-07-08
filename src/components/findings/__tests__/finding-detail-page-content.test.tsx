import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FindingDetailPageContent } from "../finding-detail-page-content";
import { mockDocuments, mockEntities, mockFindings, mockFlows, mockUsers } from "@/lib/mock";

const finding = mockFindings[0];
const gapFinding = mockFindings[2];

describe("FindingDetailPageContent", () => {
  it("records confirmation, comments, and dismissal details in the visible history", async () => {
    const user = userEvent.setup();

    render(
      <FindingDetailPageContent
        finding={finding}
        flows={mockFlows}
        entities={mockEntities}
        documents={mockDocuments}
        users={mockUsers}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(screen.getByRole("status")).toHaveTextContent(/confirmed by alexandra chen/i);
    expect(screen.getByTestId("stage-reviewed")).toHaveAttribute("aria-current", "step");

    await user.click(screen.getByRole("button", { name: "Comment" }));
    await user.type(
      screen.getByPlaceholderText(/add a comment/i),
      "Please verify the UK ledger span @Ikaika",
    );
    await user.click(screen.getByRole("button", { name: "Post" }));

    expect(screen.getAllByText(/please verify the uk ledger span/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await user.selectOptions(screen.getByRole("combobox"), "Data quality issue");
    await user.type(screen.getByRole("textbox", { name: /dismissal note/i }), "Ledger source was mapped to the wrong counterparty.");
    await user.click(screen.getByRole("button", { name: /confirm dismiss/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/dismissed as data quality issue/i);

    const history = screen.getByRole("tabpanel", { name: /history/i });
    expect(within(history).getAllByText(/data quality issue/i).length).toBeGreaterThan(0);
    expect(within(history).getByText(/wrong counterparty/i)).toBeInTheDocument();
  });

  it("renders cited narrative claims and exposure provenance", () => {
    render(
      <FindingDetailPageContent
        finding={finding}
        flows={mockFlows}
        entities={mockEntities}
        documents={mockDocuments}
        users={mockUsers}
      />,
    );

    expect(screen.getAllByRole("button", { name: "citation" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "provenance" })).toBeInTheDocument();
  });

  it("creates remediation runs, assignments, data requests, and memo exports from detail actions", async () => {
    const user = userEvent.setup();

    render(
      <FindingDetailPageContent
        finding={gapFinding}
        flows={mockFlows}
        entities={mockEntities}
        documents={mockDocuments}
        users={mockUsers}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: /select path/i })[0]);

    const planDialog = screen.getByRole("dialog", { name: /confirm action/i });
    expect(within(planDialog).getByText(/cascade preview/i)).toBeInTheDocument();

    await user.click(within(planDialog).getByRole("button", { name: "Run" }));
    expect(screen.getByRole("link", { name: /open run remediation-fn3-path-document-defend/i })).toHaveAttribute(
      "href",
      "/demo/gathering?run=remediation-fn3-path-document-defend",
    );
    expect(screen.getByRole("status")).toHaveTextContent(/remediation run created/i);
    await user.click(within(planDialog).getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: "Assign" }));
    const assignSheet = screen.getByRole("dialog", { name: "Assign" });
    await user.click(within(assignSheet).getByLabelText(/Marcus Webb/i));
    await user.click(within(assignSheet).getByRole("button", { name: "Assign" }));

    expect(within(assignSheet).getByText(/confirm access grant/i)).toBeInTheDocument();
    await user.click(within(assignSheet).getByRole("button", { name: /confirm assignment/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/assigned to marcus webb/i);

    await user.click(screen.getByRole("button", { name: /data request/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/data request created/i);

    await user.click(screen.getByRole("button", { name: /export memo/i }));
    const exportDialog = screen.getByRole("dialog", { name: "Export" });
    await user.click(within(exportDialog).getByRole("button", { name: "Export" }));

    expect(screen.getByRole("status")).toHaveTextContent(/memo exported as pdf/i);
  });
});
