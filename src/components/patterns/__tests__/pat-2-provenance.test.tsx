import { afterEach, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  clearRecordedFrontendTelemetryEvents,
  getRecordedFrontendTelemetryEvents,
} from "@/lib/telemetry/product-telemetry";
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
  afterEach(() => {
    clearRecordedFrontendTelemetryEvents();
  });

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

  it("renders lineage hops as links when hrefs are available", async () => {
    render(
      <ProvenanceChip
        {...baseProps}
        hops={[
          { label: "GL 47200", type: "ledger-line", href: "/library/gl-47200" },
          { label: "IC royalties mapping", type: "mapping", href: "/graph/mapping/ic-royalties" },
          { label: "Royalty revenue metric", type: "metric", href: "/monitor/metrics/royalty-revenue" },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /provenance/i }));

    expect(await screen.findByRole("link", { name: /GL 47200/i })).toHaveAttribute(
      "href",
      "/library/gl-47200",
    );
    expect(screen.getByRole("link", { name: /Royalty revenue metric/i })).toHaveAttribute(
      "href",
      "/monitor/metrics/royalty-revenue",
    );
  });

  it("records provenance engagement without hop labels or source names", async () => {
    render(
      <ProvenanceChip
        {...baseProps}
        telemetrySurface="graph"
        telemetryObjectRef={{ objectType: "flow", objectId: "flow-1" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /provenance/i }));

    expect(getRecordedFrontendTelemetryEvents()).toMatchObject([
      {
        name: "trust.provenance_opened",
        surface: "graph",
        objectRef: { objectType: "flow", objectId: "flow-1" },
        metadata: { hopCount: 4 },
      },
    ]);
    expect(JSON.stringify(getRecordedFrontendTelemetryEvents())).not.toContain("SAP ERP");
    expect(JSON.stringify(getRecordedFrontendTelemetryEvents())).not.toContain("GL 47200");
  });
});
