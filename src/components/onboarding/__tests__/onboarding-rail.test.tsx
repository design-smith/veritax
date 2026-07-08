import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { OnboardingRail, type OnboardingStage } from "../onboarding-rail";

const STAGES = ["Connect", "Ingest", "Teach", "Reveal"] as const;

function RailHarness({ replayEnabled = true }: { replayEnabled?: boolean }) {
  const [currentStage] = useState<OnboardingStage>("Reveal");
  const [completedStages] = useState<OnboardingStage[]>(["Connect", "Ingest", "Teach"]);
  const [replayed, setReplayed] = useState(false);

  return (
    <>
      <OnboardingRail
        currentStage={currentStage}
        completedStages={completedStages}
        onReplay={replayEnabled ? () => setReplayed(true) : undefined}
      />
      <p>Replay requested: {replayed ? "yes" : "no"}</p>
    </>
  );
}

describe("OnboardingRail", () => {
  it("renders all stages with active and completed state", () => {
    render(<RailHarness />);

    STAGES.forEach((stage) => expect(screen.getByText(stage)).toBeInTheDocument());
    expect(screen.getByTestId("stage-Reveal")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("stage-Connect")).toHaveClass("completed");
    expect(screen.getByTestId("stage-Ingest")).toHaveClass("completed");
    expect(screen.getByTestId("stage-Teach")).toHaveClass("completed");
    expect(screen.getByTestId("stage-Reveal")).not.toHaveClass("completed");
  });

  it("does not mark future stages as completed", () => {
    render(
      <OnboardingRail
        currentStage="Connect"
        completedStages={[]}
        onReplay={undefined}
      />,
    );

    expect(screen.getByTestId("stage-Reveal")).not.toHaveClass("completed");
  });

  it("shows no replay control when replay is not available", () => {
    render(<RailHarness replayEnabled={false} />);

    expect(screen.queryByRole("button", { name: /replay/i })).not.toBeInTheDocument();
  });

  it("requests replay through the visible replay control", async () => {
    const user = userEvent.setup();
    render(<RailHarness />);

    await user.click(screen.getByRole("button", { name: /replay journey/i }));

    expect(screen.getByText("Replay requested: yes")).toBeInTheDocument();
  });
});
