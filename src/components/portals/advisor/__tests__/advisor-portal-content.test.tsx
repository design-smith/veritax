import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdvisorPortalContent } from "../advisor-portal-content";

describe("AdvisorPortalContent", () => {
  it("opens an assigned request and submits a complete response with an uploaded file", async () => {
    const user = userEvent.setup();
    render(<AdvisorPortalContent />);

    await user.click(screen.getByRole("button", { name: /provide payroll headcount data/i }));

    expect(screen.getByRole("heading", { name: /provide payroll headcount data/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit response/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/total headcount/i), "42");
    await user.type(screen.getByLabelText(/payroll total/i), "1200000");
    fireEvent.drop(screen.getByTestId("upload-slot"), {
      dataTransfer: {
        files: [new File(["payroll"], "germany-payroll.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })],
        types: ["Files"],
      },
    });

    await user.click(screen.getByRole("button", { name: /submit response/i }));

    expect(screen.getByText(/response submitted/i)).toBeInTheDocument();
    expect(screen.getAllByText(/germany-payroll.xlsx/i).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /back to queue/i }));
    expect(screen.getAllByText("submitted").length).toBeGreaterThan(1);
  });

  it("keeps the request form in pending state until required fields are complete", async () => {
    const user = userEvent.setup();
    render(<AdvisorPortalContent />);

    await user.click(screen.getByRole("button", { name: /provide payroll headcount data/i }));
    await user.type(screen.getByLabelText(/total headcount/i), "42");

    expect(screen.getByRole("button", { name: /submit response/i })).toBeDisabled();
    expect(screen.queryByText(/response submitted/i)).not.toBeInTheDocument();
  });
});
