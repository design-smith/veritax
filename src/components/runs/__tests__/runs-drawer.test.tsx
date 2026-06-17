import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunsDrawer } from "../runs-drawer";
import { mockRuns, mockUsers } from "@/lib/mock";

const run = mockRuns[0]; // IC scan, done

describe("RunsDrawer", () => {
  it("renders stage name and scope in header", () => {
    render(<RunsDrawer run={run} onRerun={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(run.stage)).toBeInTheDocument();
    expect(screen.getByText(run.scope)).toBeInTheDocument();
  });

  it("renders version chips for corpus, rulepack, and model", () => {
    render(<RunsDrawer run={run} onRerun={vi.fn()} onClose={vi.fn()} />);
    // Each version appears inside a combined badge label like "corpus v.418"
    expect(screen.getByText(new RegExp(run.corpusVersion.replace(".", "\\.")))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(run.rulepackVersion.replace(".", "\\.")))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(run.modelVersion))).toBeInTheDocument();
  });

  it("renders all steps in the timeline", () => {
    render(<RunsDrawer run={run} onRerun={vi.fn()} onClose={vi.fn()} />);
    run.steps.forEach((step) => {
      expect(screen.getByText(step.name)).toBeInTheDocument();
    });
  });

  it("shows duration for completed steps", () => {
    render(<RunsDrawer run={run} onRerun={vi.fn()} onClose={vi.fn()} />);
    // First step has durationMs: 4200 → should show "4.2s" or "4200ms"
    expect(screen.getByText(/4[.,]?2/)).toBeInTheDocument();
  });

  it("renders status chip on each step", () => {
    render(<RunsDrawer run={run} onRerun={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByText("done").length).toBeGreaterThan(0);
  });

  it("renders output cards with name and Review link", () => {
    render(<RunsDrawer run={run} onRerun={vi.fn()} onClose={vi.fn()} />);
    run.outputs.forEach((output) => {
      expect(screen.getByText(output.name)).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /review/i })).toBeInTheDocument();
  });

  it("renders Re-run with edits button", () => {
    render(<RunsDrawer run={run} onRerun={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /re-run with edits/i })).toBeInTheDocument();
  });

  it("calls onRerun with run id when Re-run clicked", async () => {
    const onRerun = vi.fn();
    render(<RunsDrawer run={run} onRerun={onRerun} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /re-run with edits/i }));
    expect(onRerun).toHaveBeenCalledWith(run.id);
  });

  it("shows cost class chip", () => {
    render(<RunsDrawer run={run} onRerun={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(run.costClass)).toBeInTheDocument();
  });
});
