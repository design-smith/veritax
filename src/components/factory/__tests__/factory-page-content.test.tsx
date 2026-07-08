import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FactoryPageContent } from "../factory-page-content";

describe("FactoryPageContent", () => {
  it("moves documents through legal stage actions and opens the selected workspace", async () => {
    const user = userEvent.setup();

    render(<FactoryPageContent />);

    await user.click(screen.getByRole("tab", { name: /pipeline/i }));
    await user.dblClick(screen.getByTestId("pipeline-card-pd2"));

    expect(screen.getByRole("heading", { name: /veritax gmbh local file fy2024/i })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /pipeline/i }));
    await user.click(screen.getByTestId("pipeline-card-pd1"));
    await user.click(screen.getByRole("button", { name: /send to external review/i }));

    const externalReviewColumn = screen.getByTestId("pipeline-col-external-review");
    expect(within(externalReviewColumn).getByText(/veritax uk local file fy2024/i)).toBeInTheDocument();
  });

  it("queues inline directives into self-check and blocks export when checks fail", async () => {
    const user = userEvent.setup();

    render(<FactoryPageContent />);

    await user.click(screen.getByText("2. Transfer Pricing Analysis"));
    await user.click(screen.getByRole("button", { name: /select text/i }));
    await user.click(screen.getByRole("button", { name: /^instruct$/i }));
    await user.type(screen.getByRole("textbox"), "Align the range discussion to the latest benchmark.");
    await user.click(screen.getByRole("button", { name: /submit instruction/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/run created for inline directive/i);
    expect(screen.getByTestId("self-check-indicator")).toHaveClass("pending");

    await user.click(screen.getByRole("tab", { name: /pipeline/i }));
    await user.dblClick(screen.getByTestId("pipeline-card-pd3"));
    await user.click(screen.getByRole("button", { name: /^export$/i }));

    expect(screen.getByText(/export blocked until all claims have resolvable citations/i)).toBeInTheDocument();
  });

  it("itemizes internal-approved batch moves before sending to external review", async () => {
    const user = userEvent.setup();

    render(<FactoryPageContent />);

    await user.click(screen.getByRole("tab", { name: /pipeline/i }));
    await user.click(screen.getByRole("button", { name: /send all internal-approved to external review/i }));

    const dialog = screen.getByRole("dialog", { name: /batch stage confirmation/i });
    expect(within(dialog).getByText(/veritax uk local file fy2024/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /confirm batch move/i }));

    const externalReviewColumn = screen.getByTestId("pipeline-col-external-review");
    expect(within(externalReviewColumn).getByText(/veritax uk local file fy2024/i)).toBeInTheDocument();
  });

  it("routes request sign-off through a gate instead of silently signing", async () => {
    const user = userEvent.setup();

    render(<FactoryPageContent />);

    await user.click(screen.getByRole("tab", { name: /pipeline/i }));
    const card = screen.getByTestId("pipeline-card-pd1");
    await user.click(card);
    await user.click(within(card).getByRole("button", { name: /send to external review/i }));
    await user.click(screen.getAllByRole("button", { name: /request sign-off/i })[0]);

    expect(screen.getByRole("status")).toHaveTextContent(/sign-off gate requested/i);
    const externalReviewColumn = screen.getByTestId("pipeline-col-external-review");
    expect(within(externalReviewColumn).getByText(/veritax uk local file fy2024/i)).toBeInTheDocument();
  });
});
