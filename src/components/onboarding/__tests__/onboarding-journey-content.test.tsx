import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  clearRecordedFrontendTelemetryEvents,
  getRecordedFrontendTelemetryEvents,
} from "@/lib/telemetry/product-telemetry";
import { OnboardingJourneyContent } from "../onboarding-journey-content";

describe("OnboardingJourneyContent", () => {
  afterEach(() => {
    clearRecordedFrontendTelemetryEvents();
  });

  it("moves from Connect to Ingest with uploaded files feeding the classification stream", async () => {
    const user = userEvent.setup();
    render(<OnboardingJourneyContent />);

    expect(screen.getByText("Connect")).toBeInTheDocument();
    expect(screen.getByText("ingest-abc123@veritax.io")).toBeInTheDocument();

    fireEvent.drop(screen.getByTestId("upload-zone"), {
      dataTransfer: {
        files: [new File(["local file"], "France Local File FY2024.pdf", { type: "application/pdf" })],
        types: ["Files"],
      },
    });

    await user.click(screen.getByRole("button", { name: /continue to ingest/i }));

    expect(screen.getByTestId("stage-Ingest")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("counter-docs")).toHaveTextContent("25");
    expect(screen.getByText("France Local File FY2024.pdf")).toBeInTheDocument();
    expect(screen.getByText("Problem pile")).toBeInTheDocument();

    const problemCard = screen.getByText("corrupt-scan.pdf").closest("div");
    expect(problemCard).not.toBeNull();
    expect(within(problemCard as HTMLElement).getByText("unreadable")).toBeInTheDocument();
  });

  it("lets the user fix ingest problems and continue into Teach", async () => {
    const user = userEvent.setup();
    render(<OnboardingJourneyContent />);

    fireEvent.drop(screen.getByTestId("upload-zone"), {
      dataTransfer: {
        files: [new File(["agreement"], "US UK Agreement.pdf", { type: "application/pdf" })],
        types: ["Files"],
      },
    });
    await user.click(screen.getByRole("button", { name: /continue to ingest/i }));

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Latest fix: p1:retry")).toBeInTheDocument();
    expect(screen.queryByText("corrupt-scan.pdf")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /continue to teach/i }));

    expect(screen.getByTestId("stage-Teach")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/answer ~40 questions to unlock cross-referencing/i)).toBeInTheDocument();
    expect(screen.getByText(/Is GL account 47200/)).toBeInTheDocument();
  });

  it("answers Teach questions, unlocks Reveal, and fires the seeded record state", async () => {
    const user = userEvent.setup();
    render(<OnboardingJourneyContent />);

    fireEvent.drop(screen.getByTestId("upload-zone"), {
      dataTransfer: {
        files: [new File(["master"], "Group Master File FY2024.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })],
        types: ["Files"],
      },
    });
    await user.click(screen.getByRole("button", { name: /continue to ingest/i }));
    await user.click(screen.getByRole("button", { name: /continue to teach/i }));

    await user.click(screen.getByText("1. Yes"));
    expect(screen.getByText(/Are Veritax Corp/)).toBeInTheDocument();

    await user.click(screen.getByText("1. Same entity"));
    expect(screen.getByText(/Is the UK subsidiary/)).toBeInTheDocument();

    await user.click(screen.getByText("1. Yes"));
    expect(screen.getByText(/3 of 3 questions answered/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /continue to reveal/i }));

    expect(screen.getByTestId("stage-Reveal")).toHaveAttribute("aria-current", "step");
    expect(screen.getByTestId("reveal-locked-card")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /unlock results/i }));

    expect(screen.getByTestId("reveal-unlocked")).toBeInTheDocument();
    expect(screen.getByText(/15 findings/i)).toBeInTheDocument();
    expect(screen.getByText("Findings seeded and Briefing fired into life.")).toBeInTheDocument();

    expect(getRecordedFrontendTelemetryEvents().map((event) => event.name)).toEqual([
      "activation.first_upload_received",
      "activation.onboarding_reveal_reached",
    ]);
  });

  it("replays the demo journey back to a clean Connect stage", async () => {
    const user = userEvent.setup();
    render(<OnboardingJourneyContent />);

    fireEvent.drop(screen.getByTestId("upload-zone"), {
      dataTransfer: {
        files: [new File(["policy"], "TP Policy FY2024.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })],
        types: ["Files"],
      },
    });
    await user.click(screen.getByRole("button", { name: /continue to ingest/i }));
    await user.click(screen.getByRole("button", { name: /continue to teach/i }));

    await user.click(screen.getByRole("button", { name: /replay journey/i }));

    expect(screen.getByTestId("stage-Connect")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("ingest-abc123@veritax.io")).toBeInTheDocument();
    expect(screen.queryByText("TP Policy FY2024.docx")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue to ingest/i })).toBeDisabled();
  });
});
