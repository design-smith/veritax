import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FindingsWorkspace } from "../findings-workspace";
import { mockEntities, mockFindings, mockFlows, mockUsers } from "@/lib/mock";

const openFindings = mockFindings.filter(
  (finding) => finding.status !== "resolved" && finding.status !== "verify-next-cycle",
);

describe("FindingsWorkspace", () => {
  it("opens on the PRD default view with rollup provenance and complete table columns", () => {
    render(
      <FindingsWorkspace
        initialFindings={mockFindings}
        flows={mockFlows}
        entities={mockEntities}
        users={mockUsers}
      />,
    );

    expect(screen.getByTestId("rollup-open-count")).toHaveTextContent(String(openFindings.length));
    expect(screen.getByRole("button", { name: "provenance" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /finding trend sparkline/i })).toBeInTheDocument();

    for (const header of ["Flow", "Assignee", "Reviewer state"]) {
      expect(screen.getByText(header)).toBeInTheDocument();
    }

    expect(screen.queryByText("fn10")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("cell-severity")[0]).toHaveTextContent("critical");
  });

  it("handles bulk assignment, candidate triage, and explicit candidate promotion", async () => {
    const user = userEvent.setup();

    render(
      <FindingsWorkspace
        initialFindings={mockFindings}
        flows={mockFlows}
        entities={mockEntities}
        users={mockUsers}
      />,
    );

    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "Assign" }));

    expect(screen.getByRole("status")).toHaveTextContent(/assigned to ikaika choi/i);
    expect(screen.getAllByText("Ikaika Choi").length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("checkbox")[1]);
    await user.click(screen.getByRole("button", { name: /move to triage/i }));
    await user.type(screen.getByPlaceholderText(/reason/i), "Below manager threshold for now");
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(screen.getByRole("status")).toHaveTextContent(/moved to candidate triage/i);

    await user.click(screen.getByRole("tab", { name: /triage candidates/i }));
    await user.click(screen.getAllByRole("button", { name: /promote/i })[0]);
    await user.type(screen.getByPlaceholderText(/reason/i), "Reviewer confirmed this is material");
    await user.click(screen.getByRole("button", { name: /confirm promote/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/promoted to finding/i);
  });
});
