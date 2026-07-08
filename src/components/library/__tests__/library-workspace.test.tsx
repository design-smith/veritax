import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibraryWorkspace } from "../library-workspace";
import { mockDocuments, mockEntities, mockFlows } from "@/lib/mock";

describe("LibraryWorkspace", () => {
  it("filters the corpus with PRD facets and hands uploads to ingestion", async () => {
    const user = userEvent.setup();
    render(<LibraryWorkspace documents={mockDocuments} entities={mockEntities} flows={mockFlows} />);

    expect(screen.getByRole("columnheader", { name: /custody/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /retention/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reference/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reference/i }));
    expect(screen.getByText("CUT Benchmark Study — Software Royalties FY2022")).toBeInTheDocument();
    expect(screen.queryByText("Veritax UK Local File FY2024")).not.toBeInTheDocument();

    await user.upload(
      screen.getByLabelText(/upload documents/i),
      new File(["policy memo"], "LATAM policy memo.pdf", { type: "application/pdf" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(/ingestion run created/i);
    expect(screen.getByRole("link", { name: /view gathering run/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/demo/gathering?run=ingest-"),
    );
    expect(screen.getByText("LATAM policy memo.pdf")).toBeInTheDocument();
  });

  it("promotes reference custody and routes ICA register actions through plans or requests", async () => {
    const user = userEvent.setup();
    render(<LibraryWorkspace documents={mockDocuments} entities={mockEntities} flows={mockFlows} />);

    await user.click(screen.getByRole("button", { name: /reference/i }));
    const benchmarkRow = screen.getByTestId("row-d5");
    await user.click(within(benchmarkRow).getByRole("button", { name: /promote to materialized/i }));
    expect(screen.getByText(/creates a managed materialized copy/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm promotion/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/promoted to materialized custody/i);
    await user.click(screen.getByRole("button", { name: /clear/i }));
    expect(screen.getByTestId("row-d5")).toHaveTextContent(/materialized/i);

    await user.click(screen.getByRole("tab", { name: /ica register/i }));
    expect(screen.getByRole("columnheader", { name: /linked flows/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create agreement draft/i }));
    expect(screen.getByRole("dialog", { name: /confirm action/i })).toHaveTextContent(/create agreement draft/i);
    await user.click(screen.getByRole("button", { name: /^run$/i }));
    expect(screen.getByRole("dialog", { name: /confirm action/i })).toHaveTextContent(/run created/i);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    await user.click(screen.getByRole("button", { name: /request execution/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/data request routed to legal/i);
  });
});
