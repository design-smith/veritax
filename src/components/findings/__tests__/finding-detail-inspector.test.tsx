import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FindingDetailInspector } from "../finding-detail-inspector";
import { mockFindings } from "@/lib/mock";

const finding = mockFindings[0]; // critical UK royalty finding

const exhibits = [
  { id: "ex1", docName: "UK Local File FY2024", section: "§4.2", snippet: "The royalty rate applied is 18%", confidence: 0.91, extractorVersion: "v2.4" },
  { id: "ex2", docName: "TP Policy FY2024", section: "§3.1", snippet: "Policy rate shall be 12%", confidence: 0.95, extractorVersion: "v2.4" },
];

describe("FindingDetailInspector", () => {
  it("renders finding id and severity chip in header", () => {
    render(<FindingDetailInspector finding={finding} exhibits={exhibits} onClose={vi.fn()} />);
    expect(screen.getByText(finding.id)).toBeInTheDocument();
    expect(screen.getByText(finding.severity)).toBeInTheDocument();
  });

  it("renders the finding title and summary narrative", () => {
    render(<FindingDetailInspector finding={finding} exhibits={exhibits} onClose={vi.fn()} />);
    expect(screen.getByText(finding.title)).toBeInTheDocument();
    expect(screen.getByText(finding.summary)).toBeInTheDocument();
  });

  it("renders the exposure amount in the exposure card", () => {
    render(<FindingDetailInspector finding={finding} exhibits={exhibits} onClose={vi.fn()} />);
    // Exposure is 3_200_000
    expect(screen.getByText(/3,200,000/)).toBeInTheDocument();
    expect(screen.getByText(finding.currency)).toBeInTheDocument();
  });

  it("renders all exhibit cards with doc name and section", () => {
    render(<FindingDetailInspector finding={finding} exhibits={exhibits} onClose={vi.fn()} />);
    expect(screen.getByText("UK Local File FY2024")).toBeInTheDocument();
    expect(screen.getByText("TP Policy FY2024")).toBeInTheDocument();
    expect(screen.getByText("§4.2")).toBeInTheDocument();
  });

  it("renders watch toggle and copy-link in header", () => {
    render(<FindingDetailInspector finding={finding} exhibits={exhibits} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /watch/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
  });

  it("shows Open all in Viewer button when exhibits are present", () => {
    render(<FindingDetailInspector finding={finding} exhibits={exhibits} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /open all in viewer/i })).toBeInTheDocument();
  });
});
