import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CitationChip } from "../pat-1-citation-chip";

describe("CitationChip", () => {
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
});
