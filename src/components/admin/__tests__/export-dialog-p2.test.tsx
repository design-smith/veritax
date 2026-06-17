import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportDialogP2 } from "../export-dialog-p2";

const baseProps = {
  open: true,
  artifactClass: "record" as const,
  artifactName: "Veritax UK Local File FY2024",
  isSigned: true,
  verificationHash: "sha256:a1b2c3d4e5f6a7b8c9d0e1f2",
  permittedDestinations: ["download", "sharepoint"] as const,
  uncitedClaimCount: 0,
  onExport: vi.fn(),
  onClose: vi.fn(),
};

describe("ExportDialogP2", () => {
  it("renders the artifact name", () => {
    render(<ExportDialogP2 {...baseProps} />);
    expect(screen.getByText("Veritax UK Local File FY2024")).toBeInTheDocument();
  });

  it("displays the verification hash for record-class exports", () => {
    render(<ExportDialogP2 {...baseProps} />);
    expect(screen.getByText(/sha256:a1b2c3d4/)).toBeInTheDocument();
  });

  it("renders a copy button for the verification hash", () => {
    render(<ExportDialogP2 {...baseProps} />);
    expect(screen.getByRole("button", { name: /copy hash/i })).toBeInTheDocument();
  });

  it("shows only IT-permitted destinations", () => {
    render(<ExportDialogP2 {...baseProps} permittedDestinations={["download"]} />);
    expect(screen.getByText(/download/i)).toBeInTheDocument();
    expect(screen.queryByText(/sharepoint/i)).not.toBeInTheDocument();
  });

  it("shows Request path for a blocked destination when provided", () => {
    render(<ExportDialogP2 {...baseProps} blockedDestinations={["email"]} />);
    expect(screen.getByText(/request.*email|email.*request/i)).toBeInTheDocument();
  });

  it("renders an audit-trail notice", () => {
    render(<ExportDialogP2 {...baseProps} />);
    expect(screen.getByText(/export will be logged/i)).toBeInTheDocument();
  });

  it("does NOT show DRAFT watermark notice when artifact is signed", () => {
    render(<ExportDialogP2 {...baseProps} isSigned />);
    expect(screen.queryByText(/draft — not for reliance/i)).not.toBeInTheDocument();
  });

  it("shows DRAFT watermark notice when artifact is unsigned", () => {
    render(<ExportDialogP2 {...baseProps} isSigned={false} />);
    expect(screen.getByText(/DRAFT — not for reliance/i)).toBeInTheDocument();
  });

  it("blocks export when uncited claims exist", () => {
    render(<ExportDialogP2 {...baseProps} uncitedClaimCount={4} />);
    expect(screen.getByRole("button", { name: /export/i })).toBeDisabled();
    expect(screen.getByText(/4 uncited/i)).toBeInTheDocument();
  });

  it("calls onExport with format and destination when Export clicked", async () => {
    const onExport = vi.fn();
    render(<ExportDialogP2 {...baseProps} onExport={onExport} />);
    await userEvent.click(screen.getByRole("button", { name: /^export$/i }));
    expect(onExport).toHaveBeenCalledWith(
      expect.objectContaining({ format: expect.any(String), destination: expect.any(String) })
    );
  });
});
