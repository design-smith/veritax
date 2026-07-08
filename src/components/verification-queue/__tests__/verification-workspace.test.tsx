import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerificationWorkspace } from "../verification-workspace";

describe("VerificationWorkspace", () => {
  it("answers queue cards, rotates skipped items, undoes the last answer, and routes unsure answers to the manager queue", async () => {
    const user = userEvent.setup();
    render(<VerificationWorkspace />);

    expect(screen.getByText(/queue depth by category/i)).toBeInTheDocument();
    expect(screen.getByText(/session streak/i)).toBeInTheDocument();
    expect(screen.getByText(/Are Veritax Corp \(US\) and Veritax Holdings Inc/i)).toBeInTheDocument();
    expect(screen.getByText(/side-by-side profiles/i)).toBeInTheDocument();

    await user.keyboard("s");
    expect(screen.getByText(/Is GL account 47200 an intercompany royalty payable account/i)).toBeInTheDocument();

    await user.keyboard("1");
    expect(screen.getByRole("status")).toHaveTextContent(/verification answer recorded/i);
    expect(screen.getByText(/answered assertions/i)).toHaveTextContent("1");

    await user.keyboard("u");
    expect(screen.getByRole("status")).toHaveTextContent(/last answer undone/i);
    expect(screen.getByText(/answered assertions/i)).toHaveTextContent("0");

    await user.click(screen.getByRole("button", { name: /4\. Unsure/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/routed to manager contested queue/i);

    await user.click(screen.getByRole("tab", { name: /contested/i }));
    expect(screen.getByText(/manager-only contested queue/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/audit note/i), "Need manager judgment on account labels.");
    await user.click(screen.getByRole("button", { name: /resolve as unsure/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/manager resolution recorded/i);
  });

  it("supports Mapping Studio account, entity-resolution, and allocation-key proposals", async () => {
    const user = userEvent.setup();
    render(<VerificationWorkspace />);

    await user.click(screen.getByRole("tab", { name: /mapping studio/i }));

    const accountPanel = screen.getByRole("region", { name: /chart of accounts mapping/i });
    expect(within(accountPanel).getByText(/GL 47200/i)).toBeInTheDocument();
    await user.type(within(accountPanel).getByLabelText(/mapping audit note/i), "Confirmed from recurring royalty labels.");
    await user.click(within(accountPanel).getByRole("button", { name: /submit mapping proposal/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/mapping proposal routed to manager gate/i);

    const entityPanel = screen.getByRole("region", { name: /entity resolution workbench/i });
    await user.type(within(entityPanel).getByLabelText(/entity audit note/i), "Same EIN and filing profile.");
    await user.click(within(entityPanel).getByRole("button", { name: /merge cluster/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/entity-resolution proposal routed to manager gate/i);

    const allocationPanel = screen.getByRole("region", { name: /allocation keys editor/i });
    expect(within(allocationPanel).getByRole("button", { name: /basis source/i })).toBeInTheDocument();
    await user.clear(within(allocationPanel).getByLabelText(/allocation key definition/i));
    await user.type(within(allocationPanel).getByLabelText(/allocation key definition/i), "Headcount weighted service center allocation");
    await user.click(within(allocationPanel).getByRole("button", { name: /submit allocation proposal/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/allocation-key proposal routed to manager gate/i);
    expect(screen.getByText(/pending mapping proposals/i)).toHaveTextContent("3");
  });
});
