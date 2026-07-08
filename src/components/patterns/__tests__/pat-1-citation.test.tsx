import { useState } from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  clearRecordedFrontendTelemetryEvents,
  getRecordedFrontendTelemetryEvents,
} from "@/lib/telemetry/product-telemetry";
import { CitationChip } from "../pat-1-citation-chip";

describe("CitationChip", () => {
  afterEach(() => {
    clearRecordedFrontendTelemetryEvents();
  });

  const base = {
    docName: "Veritax UK Local File FY2024",
    section: "§4.2",
    confidence: 0.91,
    extractorVersion: "v2.4.1",
    snippet: "The royalty rate applied to UK subsidiary is 18%...",
  };

  it("renders doc name and section reference inline", () => {
    render(<CitationChip {...base} />);
    expect(screen.getByText(/Veritax UK Local File FY2024/)).toBeInTheDocument();
    expect(screen.getByText(/§4\.2/)).toBeInTheDocument();
  });

  it("shows source preview on hover", async () => {
    render(<CitationChip {...base} />);
    await userEvent.hover(screen.getByRole("button", { name: /citation/i }));
    expect(await screen.findByText(/18%/)).toBeInTheDocument();
    expect(screen.getByText(/91%/)).toBeInTheDocument();
    expect(screen.getByText(/v2\.4\.1/)).toBeInTheDocument();
  });

  it("calls onNavigate when clicked", async () => {
    const onNavigate = vi.fn();
    render(<CitationChip {...base} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("button", { name: /citation/i }));
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("renders quarantine marker when isQuarantined is true", () => {
    render(<CitationChip {...base} isQuarantined />);
    expect(screen.getByTitle(/no source found/i)).toBeInTheDocument();
  });

  it("does not render hover preview when quarantined", async () => {
    render(<CitationChip {...base} isQuarantined />);
    await userEvent.hover(screen.getByTitle(/no source found/i));
    expect(screen.queryByText(/18%/)).not.toBeInTheDocument();
  });

  it("navigates to an anchored document span with back-to-context state", async () => {
    function CitationNavigationHarness() {
      const [target, setTarget] = useState("No target");

      return (
        <>
          <CitationChip
            {...base}
            documentId="doc-uk-local-file"
            spanId="span-royalty-rate"
            returnTo="/findings/fn1"
            onNavigate={(href) => setTarget(href ?? "Missing target")}
          />
          <p aria-label="citation target">{target}</p>
        </>
      );
    }

    render(<CitationNavigationHarness />);

    await userEvent.click(screen.getByRole("button", { name: /citation/i }));

    expect(screen.getByLabelText("citation target")).toHaveTextContent(
      "/library/doc-uk-local-file?span=span-royalty-rate&returnTo=%2Ffindings%2Ffn1",
    );
  });

  it("records citation-opened and quarantined-claim trust telemetry without source text", async () => {
    render(
      <>
        <CitationChip
          {...base}
          documentId="doc-uk-local-file"
          spanId="span-royalty-rate"
          telemetrySurface="findings"
          telemetryObjectRef={{ objectType: "finding", objectId: "fn1" }}
        />
        <CitationChip
          {...base}
          isQuarantined
          telemetrySurface="factory"
          telemetryObjectRef={{ objectType: "artifact", objectId: "draft-1" }}
        />
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: /citation/i }));

    await waitFor(() =>
      expect(getRecordedFrontendTelemetryEvents().map((event) => event.name)).toEqual([
        "trust.quarantined_claim_rendered",
        "trust.citation_opened",
      ]),
    );
    expect(JSON.stringify(getRecordedFrontendTelemetryEvents())).not.toContain("18%");
    expect(JSON.stringify(getRecordedFrontendTelemetryEvents())).not.toContain("Veritax UK Local File");
  });
});
