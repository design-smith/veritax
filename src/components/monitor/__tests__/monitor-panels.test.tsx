import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonitorPeriodHeader } from "../monitor-period-header";
import { Pillar2Panel } from "../pillar2-panel";
import { RangeWatchPanel } from "../range-watch-panel";

// ── PeriodHeader ──────────────────────────────────────────────────────────────

const periodProps = {
  fiscalYear: "FY2024",
  quarter: "Q4",
  daysToClose: 12,
  checklistTotal: 8,
  checklistDone: 5,
};

describe("MonitorPeriodHeader", () => {
  it("renders fiscal year and quarter", () => {
    render(<MonitorPeriodHeader {...periodProps} />);
    expect(screen.getByText("FY2024")).toBeInTheDocument();
    expect(screen.getByText("Q4")).toBeInTheDocument();
  });

  it("renders days to close count", () => {
    render(<MonitorPeriodHeader {...periodProps} />);
    expect(screen.getByText(/12/)).toBeInTheDocument();
    expect(screen.getByText(/days to close/i)).toBeInTheDocument();
  });

  it("renders checklist progress fraction", () => {
    render(<MonitorPeriodHeader {...periodProps} />);
    expect(screen.getByText(/5.*8|5\/8/)).toBeInTheDocument();
  });

  it("renders a progress bar for checklist", () => {
    render(<MonitorPeriodHeader {...periodProps} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});

// ── Pillar2Panel ──────────────────────────────────────────────────────────────

const pillar2Rows = [
  {
    jurisdictionCode: "DE",
    jurisdiction: "Germany",
    globeETR: 0.124,
    safeharbourTests: [
      { name: "De Minimis", passed: true },
      { name: "ETR Test", passed: false },
      { name: "Substance Based Income", passed: true },
    ],
    qdmttAccrual: 240_000,
    currency: "EUR",
  },
  {
    jurisdictionCode: "GB",
    jurisdiction: "United Kingdom",
    globeETR: 0.25,
    safeharbourTests: [
      { name: "De Minimis", passed: true },
      { name: "ETR Test", passed: true },
      { name: "Substance Based Income", passed: true },
    ],
    qdmttAccrual: 0,
    currency: "GBP",
  },
];

describe("Pillar2Panel", () => {
  it("renders each jurisdiction row", () => {
    render(<Pillar2Panel rows={pillar2Rows} />);
    expect(screen.getByText("DE")).toBeInTheDocument();
    expect(screen.getByText("GB")).toBeInTheDocument();
  });

  it("renders GloBE ETR for each jurisdiction", () => {
    render(<Pillar2Panel rows={pillar2Rows} />);
    expect(screen.getByText("12.4%")).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
  });

  it("renders safe harbour test pass/fail chips", () => {
    render(<Pillar2Panel rows={pillar2Rows} />);
    expect(screen.getAllByText("pass").length).toBeGreaterThan(0);
    expect(screen.getAllByText("fail").length).toBeGreaterThan(0);
  });

  it("shows QDMTT accrual amount when non-zero", () => {
    render(<Pillar2Panel rows={pillar2Rows} />);
    expect(screen.getByText(/240,000/)).toBeInTheDocument();
  });

  it("shows Why expander on failed tests", async () => {
    render(<Pillar2Panel rows={pillar2Rows} />);
    const whyButton = screen.getByRole("button", { name: /why/i });
    expect(whyButton).toBeInTheDocument();
    await userEvent.click(whyButton);
    expect(screen.getByText(/etr test math/i)).toBeInTheDocument();
  });
});

// ── RangeWatchPanel ───────────────────────────────────────────────────────────

const rangeRows = [
  {
    id: "rw1",
    testedParty: "Veritax UK Ltd",
    flowId: "f1",
    iqrLow: 0.10,
    iqrHigh: 0.14,
    ytdRate: 0.18,
    projectedLanding: 0.18,
    trueUpAmount: -180_000,
    currency: "USD",
  },
  {
    id: "rw2",
    testedParty: "Veritax GmbH",
    flowId: "f2",
    iqrLow: 0.10,
    iqrHigh: 0.14,
    ytdRate: 0.135,
    projectedLanding: 0.135,
    trueUpAmount: -35_000,
    currency: "EUR",
  },
];

describe("RangeWatchPanel", () => {
  it("renders each tested-party row", () => {
    render(<RangeWatchPanel rows={rangeRows} onRetest={vi.fn()} />);
    expect(screen.getByText("Veritax UK Ltd")).toBeInTheDocument();
    expect(screen.getByText("Veritax GmbH")).toBeInTheDocument();
  });

  it("shows out-of-range indicator when ytdRate is outside IQR", () => {
    render(<RangeWatchPanel rows={rangeRows} onRetest={vi.fn()} />);
    // UK Ltd is 18% vs 10-14% IQR — should be flagged
    expect(screen.getByTestId("range-status-rw1")).toHaveClass("out-of-range");
  });

  it("shows in-range indicator when ytdRate is within IQR", () => {
    render(<RangeWatchPanel rows={rangeRows} onRetest={vi.fn()} />);
    // GmbH is 13.5% within 10-14%
    expect(screen.getByTestId("range-status-rw2")).toHaveClass("in-range");
  });

  it("shows negative true-up amounts", () => {
    render(<RangeWatchPanel rows={rangeRows} onRetest={vi.fn()} />);
    expect(screen.getByText(/-180,000/)).toBeInTheDocument();
  });

  it("calls onRetest with row id when Re-test clicked", async () => {
    const onRetest = vi.fn();
    render(<RangeWatchPanel rows={rangeRows} onRetest={onRetest} />);
    const retestButtons = screen.getAllByRole("button", { name: /re-test/i });
    await userEvent.click(retestButtons[0]);
    expect(onRetest).toHaveBeenCalledWith("rw1");
  });
});
