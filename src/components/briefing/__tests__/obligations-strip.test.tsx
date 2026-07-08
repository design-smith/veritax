import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ObligationsStrip } from "../obligations-strip";
import type { Obligation } from "@/lib/mock/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/briefing",
}));

const makeObligation = (id: string, daysFromNow: number, status: Obligation["status"] = "upcoming"): Obligation => {
  const due = new Date();
  due.setDate(due.getDate() + daysFromNow);
  return {
    id,
    name: `Obligation ${id}`,
    entityId: "e1",
    jurisdiction: "GB",
    due: due.toISOString().split("T")[0],
    status,
    ownerId: "u2",
  };
};

const obligations = [
  makeObligation("ob1", 40), // success, more than 30 days
  makeObligation("ob2", 20), // warning, 8 to 30 days
  makeObligation("ob3", 5), // danger, 7 days or fewer
  makeObligation("ob4", 3), // danger
  makeObligation("ob5", 12), // warning
  makeObligation("ob6", 60), // success, would be 6th, should be trimmed
];

describe("ObligationsStrip", () => {
  it("renders exactly 5 obligations ordered by urgency (days-remaining ascending)", () => {
    render(<ObligationsStrip obligations={obligations} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    // first item should be the soonest (3 days)
    expect(items[0]).toHaveTextContent("Obligation ob4");
  });

  it("shows a success chip for obligations more than 30 days away", () => {
    render(<ObligationsStrip obligations={[makeObligation("ob-green", 40)]} />);
    const chip = screen.getByTestId("day-chip-ob-green");
    expect(chip).toHaveClass("bg-success-soft");
  });

  it("shows a warning chip for obligations 8 to 30 days away", () => {
    render(<ObligationsStrip obligations={[makeObligation("ob-amber", 15)]} />);
    const chip = screen.getByTestId("day-chip-ob-amber");
    expect(chip).toHaveClass("bg-warning-soft");
  });

  it("shows a danger chip for obligations 7 days or fewer away", () => {
    render(<ObligationsStrip obligations={[makeObligation("ob-red", 5)]} />);
    const chip = screen.getByTestId("day-chip-ob-red");
    expect(chip).toHaveClass("bg-danger-soft");
  });

  it("navigates to /calendar?obligation=[id] on click", async () => {
    const onNavigate = vi.fn();
    render(<ObligationsStrip obligations={obligations} onNavigate={onNavigate} />);
    await userEvent.click(screen.getAllByRole("listitem")[0]);
    expect(onNavigate).toHaveBeenCalledWith("/calendar?obligation=ob4");
  });
});
