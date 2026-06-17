import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunModePanel } from "../run-mode-panel";

const STAGES = [
  { id: "ic-scan", name: "IC Scan", description: "Scan all intercompany flows for TP issues", tier: "run" as const },
  { id: "local-file-generate", name: "Local File Generate", description: "Generate local file for an entity", tier: "run" as const },
  { id: "benchmark-refresh", name: "Benchmark Refresh", description: "Refresh comparable set from license database", tier: "methodology" as const },
];

describe("RunModePanel", () => {
  it("renders all stage suggestions for empty payload", () => {
    render(<RunModePanel payload="" stages={STAGES} onSelectStage={vi.fn()} />);
    expect(screen.getByText("IC Scan")).toBeInTheDocument();
    expect(screen.getByText("Local File Generate")).toBeInTheDocument();
    expect(screen.getByText("Benchmark Refresh")).toBeInTheDocument();
  });

  it("filters stages as user types the payload", async () => {
    render(<RunModePanel payload="local" stages={STAGES} onSelectStage={vi.fn()} />);
    expect(screen.getByText("Local File Generate")).toBeInTheDocument();
    expect(screen.queryByText("IC Scan")).not.toBeInTheDocument();
  });

  it("shows methodology-tier badge on methodology stages", () => {
    render(<RunModePanel payload="" stages={STAGES} onSelectStage={vi.fn()} />);
    expect(screen.getByText("methodology")).toBeInTheDocument();
  });

  it("calls onSelectStage with stage id when a stage row clicked", async () => {
    const onSelectStage = vi.fn();
    render(<RunModePanel payload="" stages={STAGES} onSelectStage={onSelectStage} />);
    await userEvent.click(screen.getByText("IC Scan"));
    expect(onSelectStage).toHaveBeenCalledWith("ic-scan");
  });

  it("shows No matching stages when payload matches nothing", () => {
    render(<RunModePanel payload="ZZZNOMATCH" stages={STAGES} onSelectStage={vi.fn()} />);
    expect(screen.getByText(/no matching stages/i)).toBeInTheDocument();
  });
});
