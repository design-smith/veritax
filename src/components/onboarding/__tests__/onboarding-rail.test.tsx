import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OnboardingRail } from "../onboarding-rail";

const STAGES = ["Connect", "Ingest", "Teach", "Reveal"] as const;

describe("OnboardingRail", () => {
  it("renders all four stage labels", () => {
    render(<OnboardingRail currentStage="Connect" completedStages={[]} onReplay={undefined} />);
    STAGES.forEach((s) => expect(screen.getByText(s)).toBeInTheDocument());
  });

  it("marks the active stage with aria-current='step'", () => {
    render(<OnboardingRail currentStage="Ingest" completedStages={["Connect"]} onReplay={undefined} />);
    expect(screen.getByTestId("stage-Ingest")).toHaveAttribute("aria-current", "step");
  });

  it("marks completed stages with a completed class", () => {
    render(<OnboardingRail currentStage="Teach" completedStages={["Connect", "Ingest"]} onReplay={undefined} />);
    expect(screen.getByTestId("stage-Connect")).toHaveClass("completed");
    expect(screen.getByTestId("stage-Ingest")).toHaveClass("completed");
    expect(screen.getByTestId("stage-Teach")).not.toHaveClass("completed");
  });

  it("does not mark future stages as completed", () => {
    render(<OnboardingRail currentStage="Connect" completedStages={[]} onReplay={undefined} />);
    expect(screen.getByTestId("stage-Reveal")).not.toHaveClass("completed");
  });

  it("shows Replay button when onReplay is provided (admin flag)", () => {
    render(
      <OnboardingRail currentStage="Reveal" completedStages={["Connect","Ingest","Teach"]} onReplay={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /replay/i })).toBeInTheDocument();
  });

  it("does not show Replay button when onReplay is undefined", () => {
    render(<OnboardingRail currentStage="Connect" completedStages={[]} onReplay={undefined} />);
    expect(screen.queryByRole("button", { name: /replay/i })).not.toBeInTheDocument();
  });

  it("calls onReplay when Replay clicked", async () => {
    const onReplay = vi.fn();
    render(
      <OnboardingRail currentStage="Reveal" completedStages={["Connect","Ingest","Teach"]} onReplay={onReplay} />
    );
    await userEvent.click(screen.getByRole("button", { name: /replay/i }));
    expect(onReplay).toHaveBeenCalledOnce();
  });
});
