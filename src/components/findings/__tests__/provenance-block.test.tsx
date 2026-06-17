import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProvenanceBlock } from "../provenance-block";

const props = {
  ruleId: "R-IC-001",
  ruleDescription: "Royalty rate materially exceeds benchmark upper quartile",
  extractorVersion: "v2.4.1",
  modelVersion: "claude-sonnet-4-6",
  confidence: 0.92,
  calibrationNote: "Well-calibrated on IC royalty comparisons (n=847)",
  comparisonSpans: [
    { label: "Policy rate", text: "The applicable royalty rate is 12%", docName: "TP Policy FY2024", section: "§3.1" },
    { label: "Observed rate", text: "Royalty charged to UK sub: 18%", docName: "UK Local File FY2024", section: "§4.2" },
  ],
};

describe("ProvenanceBlock", () => {
  it("renders rule id and plain-language description", () => {
    render(<ProvenanceBlock {...props} />);
    expect(screen.getByText("R-IC-001")).toBeInTheDocument();
    expect(screen.getByText(/exceeds benchmark upper quartile/i)).toBeInTheDocument();
  });

  it("renders extractor and model version chips", () => {
    render(<ProvenanceBlock {...props} />);
    expect(screen.getByText("v2.4.1")).toBeInTheDocument();
    expect(screen.getByText("claude-sonnet-4-6")).toBeInTheDocument();
  });

  it("renders confidence score and calibration note", () => {
    render(<ProvenanceBlock {...props} />);
    expect(screen.getByText(/92%/)).toBeInTheDocument();
    expect(screen.getByText(/well-calibrated/i)).toBeInTheDocument();
  });

  it("hides comparison spans by default", () => {
    render(<ProvenanceBlock {...props} />);
    expect(screen.queryByText(/The applicable royalty rate/)).not.toBeInTheDocument();
  });

  it("shows comparison spans side-by-side when Why expander is clicked", async () => {
    render(<ProvenanceBlock {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /why am i seeing this/i }));
    expect(screen.getByText(/The applicable royalty rate/)).toBeInTheDocument();
    expect(screen.getByText(/Royalty charged to UK sub/)).toBeInTheDocument();
  });
});
