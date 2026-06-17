import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { computeScenario, type ScenarioParameters, type BaseResult } from "../scenario-compute";
import { ScenarioSandbox } from "../scenario-sandbox";

// ── Pure compute function ─────────────────────────────────────────────────────

const base: BaseResult = {
  globeETR: 0.124,
  qdmttAccrual: 240_000,
  trueUpAmount: -180_000,
  currency: "EUR",
};

describe("computeScenario", () => {
  it("returns unchanged values when parameters equal current actuals", () => {
    const params: ScenarioParameters = { adjustedRate: 0.124, qdmttElection: false, trueUpOffset: 0 };
    const result = computeScenario(base, params);
    expect(result.globeETR).toBe(0.124);
  });

  it("raises GloBE ETR when adjustedRate is higher", () => {
    const params: ScenarioParameters = { adjustedRate: 0.18, qdmttElection: false, trueUpOffset: 0 };
    const result = computeScenario(base, params);
    expect(result.globeETR).toBeGreaterThan(base.globeETR);
  });

  it("reduces QDMTT accrual to 0 when QDMTT election is set", () => {
    const params: ScenarioParameters = { adjustedRate: 0.124, qdmttElection: true, trueUpOffset: 0 };
    const result = computeScenario(base, params);
    expect(result.qdmttAccrual).toBe(0);
  });

  it("adjusts true-up by the offset", () => {
    const params: ScenarioParameters = { adjustedRate: 0.124, qdmttElection: false, trueUpOffset: 50_000 };
    const result = computeScenario(base, params);
    expect(result.trueUpAmount).toBe(-180_000 + 50_000);
  });

  it("includes a diff vs base for each metric", () => {
    const params: ScenarioParameters = { adjustedRate: 0.18, qdmttElection: false, trueUpOffset: 0 };
    const result = computeScenario(base, params);
    expect(result.diff.globeETR).toBeDefined();
    expect(result.diff.qdmttAccrual).toBeDefined();
    expect(result.diff.trueUpAmount).toBeDefined();
  });
});

// ── ScenarioSandbox component ─────────────────────────────────────────────────

describe("ScenarioSandbox", () => {
  it("renders parameter inputs (rate, QDMTT election, true-up offset)", () => {
    render(<ScenarioSandbox base={base} onExportMemo={vi.fn()} />);
    expect(screen.getByLabelText(/adjusted rate/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/qdmtt election/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/true-up offset/i)).toBeInTheDocument();
  });

  it("renders a Compute button", () => {
    render(<ScenarioSandbox base={base} onExportMemo={vi.fn()} />);
    expect(screen.getByRole("button", { name: /compute/i })).toBeInTheDocument();
  });

  it("shows results diff after Compute clicked", async () => {
    render(<ScenarioSandbox base={base} onExportMemo={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /compute/i }));
    expect(screen.getByTestId("scenario-results")).toBeInTheDocument();
  });

  it("Save scenario button appears after computing", async () => {
    render(<ScenarioSandbox base={base} onExportMemo={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /compute/i }));
    expect(screen.getByRole("button", { name: /save scenario/i })).toBeInTheDocument();
  });

  it("can save up to 3 scenarios", async () => {
    render(<ScenarioSandbox base={base} onExportMemo={vi.fn()} />);
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole("button", { name: /compute/i }));
      await userEvent.click(screen.getByRole("button", { name: /save scenario/i }));
    }
    expect(screen.getAllByTestId(/saved-scenario/).length).toBe(3);
  });

  it("does not allow saving a 4th scenario", async () => {
    render(<ScenarioSandbox base={base} onExportMemo={vi.fn()} />);
    for (let i = 0; i < 3; i++) {
      await userEvent.click(screen.getByRole("button", { name: /compute/i }));
      await userEvent.click(screen.getByRole("button", { name: /save scenario/i }));
    }
    // 4th compute — Save should be disabled
    await userEvent.click(screen.getByRole("button", { name: /compute/i }));
    expect(screen.getByRole("button", { name: /save scenario/i })).toBeDisabled();
  });

  it("scenarios never write to Record — no Record-mutation button visible", async () => {
    render(<ScenarioSandbox base={base} onExportMemo={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /compute/i }));
    expect(screen.queryByRole("button", { name: /apply to record|write|commit/i })).not.toBeInTheDocument();
  });

  it("renders Export memo button", async () => {
    render(<ScenarioSandbox base={base} onExportMemo={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /compute/i }));
    expect(screen.getByRole("button", { name: /export memo/i })).toBeInTheDocument();
  });
});
