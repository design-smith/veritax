import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScreeningCascade } from "../screening-cascade";
import { BenchmarkSetTable } from "../benchmark-set-table";
import { RangePanel } from "../range-panel";

// ── ScreeningCascade ──────────────────────────────────────────────────────────

const stages = [
  { id: "universe", label: "Universe", totalIn: 1200, totalOut: 1200, criteria: "All public software companies" },
  { id: "revenue",  label: "Revenue filter", totalIn: 1200, totalOut: 480, criteria: "Revenue $50M–$5B" },
  { id: "segment",  label: "Segment filter", totalIn: 480,  totalOut: 82,  criteria: "Software licensing segment" },
  { id: "final",    label: "Final set",      totalIn: 82,   totalOut: 12,  criteria: "Geographic comparability" },
];

describe("ScreeningCascade", () => {
  it("renders all cascade stages in order", () => {
    render(<ScreeningCascade stages={stages} onSelectStage={vi.fn()} />);
    stages.forEach((s) => expect(screen.getByText(s.label)).toBeInTheDocument());
  });

  it("shows in/out counts for each stage", () => {
    render(<ScreeningCascade stages={stages} onSelectStage={vi.fn()} />);
    expect(screen.getByText(/480.*in|480 in/i)).toBeInTheDocument();
  });

  it("calls onSelectStage when a stage is clicked", async () => {
    const onSelectStage = vi.fn();
    render(<ScreeningCascade stages={stages} onSelectStage={onSelectStage} />);
    await userEvent.click(screen.getByText("Revenue filter"));
    expect(onSelectStage).toHaveBeenCalledWith("revenue");
  });

  it("shows criteria text for the active stage", async () => {
    render(<ScreeningCascade stages={stages} onSelectStage={vi.fn()} />);
    await userEvent.click(screen.getByText("Revenue filter"));
    expect(screen.getByText(/Revenue \$50M/)).toBeInTheDocument();
  });
});

// ── BenchmarkSetTable ─────────────────────────────────────────────────────────

const comparables = [
  { id: "c1", name: "Acme Software Inc", pli: 0.142, status: "accepted" as const, delistedFlag: false },
  { id: "c2", name: "Beta Tech Corp",    pli: 0.089, status: "accepted" as const, delistedFlag: false },
  { id: "c3", name: "Gamma Systems",     pli: 0.201, status: "rejected" as const, rejectionReason: "Segment mismatch", delistedFlag: false },
  { id: "c4", name: "Delta Analytics",   pli: 0.156, status: "accepted" as const, delistedFlag: true },
];

describe("BenchmarkSetTable", () => {
  it("renders all comparables", () => {
    render(<BenchmarkSetTable comparables={comparables} onToggleStatus={vi.fn()} />);
    comparables.forEach((c) => expect(screen.getByText(c.name)).toBeInTheDocument());
  });

  it("shows accepted/rejected status chips", () => {
    render(<BenchmarkSetTable comparables={comparables} onToggleStatus={vi.fn()} />);
    expect(screen.getAllByText("accepted").length).toBeGreaterThan(0);
    expect(screen.getByText("rejected")).toBeInTheDocument();
  });

  it("shows rejection reason for rejected comparables", () => {
    render(<BenchmarkSetTable comparables={comparables} onToggleStatus={vi.fn()} />);
    expect(screen.getByText(/Segment mismatch/)).toBeInTheDocument();
  });

  it("flags delisted companies", () => {
    render(<BenchmarkSetTable comparables={comparables} onToggleStatus={vi.fn()} />);
    expect(screen.getByText(/delisted/i)).toBeInTheDocument();
  });

  it("calls onToggleStatus when accept/reject toggled", async () => {
    const onToggleStatus = vi.fn();
    render(<BenchmarkSetTable comparables={comparables} onToggleStatus={onToggleStatus} />);
    const toggleBtns = screen.getAllByRole("button", { name: /reject|accept/i });
    await userEvent.click(toggleBtns[0]);
    expect(onToggleStatus).toHaveBeenCalledWith(comparables[0].id, expect.any(String));
  });
});

// ── RangePanel ────────────────────────────────────────────────────────────────

describe("RangePanel", () => {
  const rangeProps = {
    pliOptions: ["CUT — royalty rate", "Operating margin", "TNMM — cost plus"],
    selectedPli: "CUT — royalty rate",
    onSelectPli: vi.fn(),
    iqrLow: 0.10,   // 10%
    iqrHigh: 0.14,  // 14% — tested party at 18% is above this
    median: 0.12,
    weightedAverage: 0.121,
    testedPartyRate: 0.18, // 18% > 14% IQR high → out of range
    onRefresh: vi.fn(),
  };

  it("renders the PLI selector with all options", () => {
    render(<RangePanel {...rangeProps} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Operating margin")).toBeInTheDocument();
  });

  it("renders IQR boundaries", () => {
    render(<RangePanel {...rangeProps} />);
    expect(screen.getByText(/10\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/14\.0%/)).toBeInTheDocument();
  });

  it("shows tested party rate and whether it is in or out of range", () => {
    render(<RangePanel {...rangeProps} />);
    expect(screen.getByText(/18\.?0?%/)).toBeInTheDocument();
    expect(screen.getAllByText(/out of range|above upper/i).length).toBeGreaterThan(0);
  });

  it("renders Refresh from license button", () => {
    render(<RangePanel {...rangeProps} />);
    expect(screen.getByRole("button", { name: /refresh from license/i })).toBeInTheDocument();
  });

  it("calls onRefresh when button clicked", async () => {
    const onRefresh = vi.fn();
    render(<RangePanel {...rangeProps} onRefresh={onRefresh} />);
    await userEvent.click(screen.getByRole("button", { name: /refresh from license/i }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
