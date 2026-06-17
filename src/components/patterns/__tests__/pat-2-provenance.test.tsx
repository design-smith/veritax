import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvenanceChip } from "../pat-2-provenance";

const baseProps = {
  asOf: "2024-12-31",
  source: "SAP ERP",
  hops: [
    { label: "GL 47200", type: "ledger-line" },
    { label: "IC royalties mapping", type: "mapping" },
    { label: "Veritax UK P&L", type: "entity-pl" },
    { label: "Royalty revenue metric", type: "metric" },
  ],
};

describe("ProvenanceChip", () => {
  it("renders as-of date and source name", () => {
    render(<ProvenanceChip {...baseProps} />);
    expect(screen.getByText(/2024-12-31/)).toBeInTheDocument();
    expect(screen.getByText(/SAP ERP/)).toBeInTheDocument();
  });

  it("opens lineage drawer on click showing all hops", async () => {
    render(<ProvenanceChip {...baseProps} />);
    await userEvent.click(screen.getByRole("button", { name: /provenance/i }));
    expect(await screen.findByText("GL 47200")).toBeInTheDocument();
    expect(screen.getByText("IC royalties mapping")).toBeInTheDocument();
    expect(screen.getByText("Royalty revenue metric")).toBeInTheDocument();
  });

  it("renders amber staleness marker when isStale is true", () => {
    render(<ProvenanceChip {...baseProps} isStale staleReason="Last synced 3 days ago" />);
    expect(screen.getByTitle(/3 days ago/i)).toBeInTheDocument();
  });

  it("does not render staleness marker when not stale", () => {
    render(<ProvenanceChip {...baseProps} />);
    expect(screen.queryByTitle(/stale/i)).not.toBeInTheDocument();
  });
});
