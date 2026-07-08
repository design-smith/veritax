import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ExportDialogP2 } from "../export-dialog-p2";

type ExportSummary = "none" | `${string}:${string}`;

function ExportDialogHarness({
  isSigned = true,
  permittedDestinations = ["download", "sharepoint"],
  blockedDestinations = [],
  uncitedClaimCount = 0,
}: {
  isSigned?: boolean;
  permittedDestinations?: Array<"download" | "sharepoint" | "email">;
  blockedDestinations?: Array<"download" | "sharepoint" | "email">;
  uncitedClaimCount?: number;
}) {
  const [exportSummary, setExportSummary] = useState<ExportSummary>("none");
  const [open, setOpen] = useState(true);

  return (
    <>
      <ExportDialogP2
        open={open}
        artifactClass="record"
        artifactName="Veritax UK Local File FY2024"
        isSigned={isSigned}
        verificationHash="sha256:a1b2c3d4e5f6a7b8c9d0e1f2"
        permittedDestinations={permittedDestinations}
        blockedDestinations={blockedDestinations}
        uncitedClaimCount={uncitedClaimCount}
        onExport={(payload) => setExportSummary(`${payload.format}:${payload.destination}`)}
        onClose={() => setOpen(false)}
      />
      <p>Export summary: {exportSummary}</p>
      <p>Export dialog open: {open ? "yes" : "no"}</p>
    </>
  );
}

describe("ExportDialogP2", () => {
  it("renders record export controls, hash, permitted destinations, and audit notice", () => {
    render(<ExportDialogHarness />);

    expect(screen.getByText("Veritax UK Local File FY2024")).toBeInTheDocument();
    expect(screen.getByText(/sha256:a1b2c3d4/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy hash/i })).toBeInTheDocument();
    expect(screen.getByText(/download/i)).toBeInTheDocument();
    expect(screen.getByText(/sharepoint/i)).toBeInTheDocument();
    expect(screen.getByText(/export will be logged/i)).toBeInTheDocument();
    expect(screen.queryByText(/not for reliance/i)).not.toBeInTheDocument();
  });

  it("shows blocked destinations through a request path", () => {
    render(<ExportDialogHarness permittedDestinations={["download"]} blockedDestinations={["email"]} />);

    expect(screen.getByText(/download/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/email draft/i)).not.toBeInTheDocument();
    expect(screen.getByText(/request.*email|email.*request/i)).toBeInTheDocument();
  });

  it("shows draft watermark notice for unsigned artifacts and blocks uncited exports", () => {
    render(<ExportDialogHarness isSigned={false} uncitedClaimCount={4} />);

    expect(screen.getByText(/not for reliance/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^export$/i })).toBeDisabled();
    expect(screen.getByText(/4 uncited/i)).toBeInTheDocument();
  });

  it("exports the selected format and destination through real harness state", async () => {
    const user = userEvent.setup();
    render(<ExportDialogHarness />);

    await user.click(screen.getByRole("button", { name: /^export$/i }));

    expect(screen.getByText("Export summary: PDF:download")).toBeInTheDocument();
  });
});
