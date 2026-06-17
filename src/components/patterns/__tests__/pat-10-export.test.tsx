import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExportDialog } from "../pat-10-export";

describe("ExportDialog", () => {
  const base = {
    open: true,
    artifactName: "Veritax UK Local File FY2024",
    onClose: vi.fn(),
    onExport: vi.fn(),
  };

  it("shows record-class formats for record artifacts", () => {
    render(<ExportDialog {...base} artifactClass="record" />);
    expect(screen.getByText(/pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/verification hash/i)).toBeInTheDocument();
  });

  it("shows communication-class formats for communication artifacts", () => {
    render(<ExportDialog {...base} artifactClass="communication" />);
    expect(screen.getByText(/pptx/i)).toBeInTheDocument();
    expect(screen.queryByText(/verification hash/i)).not.toBeInTheDocument();
  });

  it("blocks export and shows guard when uncited claims exist", () => {
    render(<ExportDialog {...base} artifactClass="record" uncitedClaimCount={3} />);
    expect(screen.getByText(/3 uncited claims/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export/i })).toBeDisabled();
  });

  it("allows export when no uncited claims", () => {
    render(<ExportDialog {...base} artifactClass="record" uncitedClaimCount={0} />);
    expect(screen.getByRole("button", { name: /export/i })).not.toBeDisabled();
  });

  it("shows DRAFT watermark notice for unsigned record artifacts", () => {
    render(<ExportDialog {...base} artifactClass="record" isSigned={false} />);
    expect(screen.getByText("DRAFT — not for reliance")).toBeInTheDocument();
  });

  it("does not show watermark notice for signed artifacts", () => {
    render(<ExportDialog {...base} artifactClass="record" isSigned />);
    expect(screen.queryByText(/not for reliance/i)).not.toBeInTheDocument();
  });

  it("calls onExport with format and destination on submit", async () => {
    const onExport = vi.fn();
    render(<ExportDialog {...base} artifactClass="communication" onExport={onExport} />);
    await userEvent.click(screen.getByRole("button", { name: /export/i }));
    expect(onExport).toHaveBeenCalledWith(
      expect.objectContaining({ format: expect.any(String), destination: expect.any(String) })
    );
  });
});
