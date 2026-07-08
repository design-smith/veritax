import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { mockUsers } from "@/lib/mock";
import { DelegationSettings } from "../delegation-settings";
import { NotificationsSettings } from "../notifications-settings";
import { StandingInstructionsList } from "../standing-instructions-list";
import type { NotificationCategory } from "../notifications-settings";

const instructions = [
  { id: "si1", text: "Always use bullet points for lists", tier: "style" as const, scope: "global", createdBy: "u2" },
  { id: "si2", text: "Run IC scan after any source sync", tier: "run" as const, scope: "global", createdBy: "u2" },
  { id: "si3", text: "Use TNMM for all service flows", tier: "methodology" as const, scope: "Veritax UK Ltd", createdBy: "u1" },
];

const categories: NotificationCategory[] = [
  { id: "findings", label: "Findings", cadence: "realtime" },
  { id: "runs", label: "Runs", cadence: "daily" },
  { id: "gates", label: "Gate requests", cadence: "realtime" },
  { id: "obligations", label: "Obligations", cadence: "weekly" },
];

function StandingInstructionsHarness() {
  const [deletedInstructionId, setDeletedInstructionId] = useState("none");

  return (
    <>
      <StandingInstructionsList instructions={instructions} onDelete={setDeletedInstructionId} />
      <p>Deleted instruction: {deletedInstructionId}</p>
    </>
  );
}

function NotificationsHarness() {
  const [lastChange, setLastChange] = useState("none");

  return (
    <>
      <NotificationsSettings
        categories={categories}
        onChange={(categoryId, cadence) => setLastChange(`${categoryId}:${cadence}`)}
      />
      <p>Last cadence change: {lastChange}</p>
    </>
  );
}

function DelegationHarness() {
  const [savedDelegate, setSavedDelegate] = useState("none");

  return (
    <>
      <DelegationSettings
        users={mockUsers}
        currentDelegateId={null}
        expiresAt={null}
        onSave={(payload) => setSavedDelegate(payload.userId)}
      />
      <p>Saved delegate: {savedDelegate}</p>
    </>
  );
}

describe("StandingInstructionsList", () => {
  it("renders all instructions", () => {
    render(<StandingInstructionsList instructions={instructions} onDelete={() => undefined} />);
    instructions.forEach((instruction) => expect(screen.getByText(instruction.text)).toBeInTheDocument());
  });

  it("renders tier badges and scoped labels", () => {
    render(<StandingInstructionsList instructions={instructions} onDelete={() => undefined} />);
    expect(screen.getByText("style")).toBeInTheDocument();
    expect(screen.getByText("run")).toBeInTheDocument();
    expect(screen.getByText("methodology")).toBeInTheDocument();
    expect(screen.getByText("Veritax UK Ltd")).toBeInTheDocument();
  });

  it("emits the deleted instruction through the public callback", async () => {
    const user = userEvent.setup();
    render(<StandingInstructionsHarness />);

    await user.click(screen.getAllByRole("button", { name: /delete|remove/i })[0]);

    expect(screen.getByText("Deleted instruction: si1")).toBeInTheDocument();
  });
});

describe("NotificationsSettings", () => {
  it("renders all notification categories and cadence selectors", () => {
    render(<NotificationsSettings categories={categories} onChange={() => undefined} />);
    categories.forEach((category) => expect(screen.getByText(category.label)).toBeInTheDocument());
    expect(screen.getAllByRole("combobox").length).toBe(categories.length);
  });

  it("emits category id and cadence through the public callback", async () => {
    const user = userEvent.setup();
    render(<NotificationsHarness />);

    await user.selectOptions(screen.getAllByRole("combobox")[1], "weekly");

    expect(screen.getByText("Last cadence change: runs:weekly")).toBeInTheDocument();
  });
});

describe("DelegationSettings", () => {
  it("renders the empty and active delegate states", () => {
    const { rerender } = render(
      <DelegationSettings users={mockUsers} currentDelegateId={null} expiresAt={null} onSave={() => undefined} />
    );
    expect(screen.getByText(/none set|no delegate/i)).toBeInTheDocument();

    rerender(
      <DelegationSettings users={mockUsers} currentDelegateId="u2" expiresAt="2025-12-31" onSave={() => undefined} />
    );
    expect(screen.getAllByText(/Marcus Webb/).length).toBeGreaterThan(0);
    expect(screen.getByText(/31 Dec 2025/)).toBeInTheDocument();
  });

  it("emits the saved delegate through the public callback", async () => {
    const user = userEvent.setup();
    render(<DelegationHarness />);

    await user.selectOptions(screen.getByRole("combobox", { name: /delegate/i }), "u3");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(screen.getByText("Saved delegate: u3")).toBeInTheDocument();
  });
});
