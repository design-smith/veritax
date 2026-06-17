import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RevealMoment } from "../reveal-moment";

describe("RevealMoment", () => {
  it("renders the locked card with blurred finding count", () => {
    render(<RevealMoment findingCount={15} exposureRollup="$4.2M" onUnlock={vi.fn()} />);
    expect(screen.getByTestId("reveal-locked-card")).toBeInTheDocument();
    expect(screen.getByText(/examination complete/i)).toBeInTheDocument();
  });

  it("shows finding count on the locked card", () => {
    render(<RevealMoment findingCount={15} exposureRollup="$4.2M" onUnlock={vi.fn()} />);
    expect(screen.getByText(/15 findings/i)).toBeInTheDocument();
  });

  it("shows exposure rollup on the locked card", () => {
    render(<RevealMoment findingCount={15} exposureRollup="$4.2M" onUnlock={vi.fn()} />);
    expect(screen.getByText(/\$4\.2M/)).toBeInTheDocument();
  });

  it("renders the Unlock button", () => {
    render(<RevealMoment findingCount={15} exposureRollup="$4.2M" onUnlock={vi.fn()} />);
    expect(screen.getByRole("button", { name: /unlock/i })).toBeInTheDocument();
  });

  it("calls onUnlock when the Unlock button is clicked", async () => {
    const onUnlock = vi.fn();
    render(<RevealMoment findingCount={15} exposureRollup="$4.2M" onUnlock={onUnlock} />);
    await userEvent.click(screen.getByRole("button", { name: /unlock/i }));
    expect(onUnlock).toHaveBeenCalledOnce();
  });

  it("shows unlocked state after unlock with findings revealed", async () => {
    render(<RevealMoment findingCount={15} exposureRollup="$4.2M" onUnlock={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /unlock/i }));
    expect(screen.getByTestId("reveal-unlocked")).toBeInTheDocument();
    expect(screen.getByText(/15 findings/i)).toBeInTheDocument();
  });

  it("shows a Replay button when isAdmin is true", () => {
    render(<RevealMoment findingCount={15} exposureRollup="$4.2M" onUnlock={vi.fn()} isAdmin />);
    expect(screen.getByRole("button", { name: /replay/i })).toBeInTheDocument();
  });

  it("calls onReplay when Replay clicked and resets to locked state", async () => {
    const onReplay = vi.fn();
    render(<RevealMoment findingCount={15} exposureRollup="$4.2M" onUnlock={vi.fn()} onReplay={onReplay} isAdmin />);
    // First unlock
    await userEvent.click(screen.getByRole("button", { name: /unlock/i }));
    // Then replay
    await userEvent.click(screen.getByRole("button", { name: /replay/i }));
    expect(onReplay).toHaveBeenCalledOnce();
    // Should return to locked state
    expect(screen.getByTestId("reveal-locked-card")).toBeInTheDocument();
  });
});
