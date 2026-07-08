import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { RevealMoment } from "../reveal-moment";

function RevealHarness({ isAdmin = false }: { isAdmin?: boolean }) {
  const [unlockedExternally, setUnlockedExternally] = useState(false);
  const [replayed, setReplayed] = useState(false);

  return (
    <>
      <RevealMoment
        findingCount={15}
        exposureRollup="$4.2M"
        isAdmin={isAdmin}
        onUnlock={() => setUnlockedExternally(true)}
        onReplay={() => setReplayed(true)}
      />
      <p>Record unlocked: {unlockedExternally ? "yes" : "no"}</p>
      <p>Replay requested: {replayed ? "yes" : "no"}</p>
    </>
  );
}

describe("RevealMoment", () => {
  it("shows the locked examination card with findings, exposure, and unlock control", () => {
    render(<RevealHarness />);

    expect(screen.getByTestId("reveal-locked-card")).toBeInTheDocument();
    expect(screen.getByText(/examination complete/i)).toBeInTheDocument();
    expect(screen.getByText(/15 findings/i)).toBeInTheDocument();
    expect(screen.getByText(/\$4\.2M/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /unlock results/i })).toBeInTheDocument();
  });

  it("unlocks the record and reveals the seeded findings state", async () => {
    const user = userEvent.setup();
    render(<RevealHarness />);

    await user.click(screen.getByRole("button", { name: /unlock results/i }));

    expect(screen.getByText("Record unlocked: yes")).toBeInTheDocument();
    expect(screen.getByTestId("reveal-unlocked")).toBeInTheDocument();
    expect(screen.getByText(/15 findings/i)).toBeInTheDocument();
  });

  it("lets an admin replay the journey back to the locked state", async () => {
    const user = userEvent.setup();
    render(<RevealHarness isAdmin />);

    await user.click(screen.getByRole("button", { name: /unlock results/i }));
    await user.click(screen.getByRole("button", { name: /replay journey/i }));

    expect(screen.getByText("Replay requested: yes")).toBeInTheDocument();
    expect(screen.getByTestId("reveal-locked-card")).toBeInTheDocument();
  });
});
