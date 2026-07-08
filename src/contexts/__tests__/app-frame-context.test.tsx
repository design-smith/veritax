import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AppFrameProvider,
  createDefaultAppFrameState,
  useAppFrame,
} from "@/contexts/app-frame-context";

function AppFrameHarness() {
  const frame = useAppFrame();
  const unreadCount = frame.digestItems.filter((item) => !item.read).length;

  return (
    <div>
      <p>Workspace: {frame.activeWorkspace.name}</p>
      <p>Subgroup: {frame.activeSubgroup.name}</p>
      <p>Unread: {unreadCount}</p>
      <p>Gates: {frame.pendingGates.length}</p>
      <p>Cadence: {frame.digestCadence.find((item) => item.category === "findings")?.cadence}</p>
      <button type="button" onClick={() => frame.setWorkspace("workspace-emea")}>
        Switch workspace
      </button>
      <button type="button" onClick={() => frame.setSubgroup("subgroup-fr")}>
        Switch subgroup
      </button>
      <button type="button" onClick={() => frame.markDigestRead(frame.digestItems[0].id)}>
        Read latest
      </button>
      <button type="button" onClick={() => frame.setDigestCadence("findings", "daily")}>
        Daily findings digest
      </button>
      <button type="button" onClick={() => frame.approveGate(frame.pendingGates[0].id)}>
        Approve first gate
      </button>
    </div>
  );
}

describe("AppFrameProvider", () => {
  it("keeps shell workspace, digest, and gate queue state real and mutable", async () => {
    const user = userEvent.setup();
    render(
      <AppFrameProvider initialState={createDefaultAppFrameState()}>
        <AppFrameHarness />
      </AppFrameProvider>,
    );

    expect(screen.getByText("Workspace: Veritax Group")).toBeInTheDocument();
    expect(screen.getByText("Subgroup: Global transfer pricing")).toBeInTheDocument();
    expect(screen.getByText("Unread: 4")).toBeInTheDocument();
    expect(screen.getByText("Gates: 3")).toBeInTheDocument();
    expect(screen.getByText("Cadence: immediate")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch workspace" }));
    await user.click(screen.getByRole("button", { name: "Switch subgroup" }));
    await user.click(screen.getByRole("button", { name: "Read latest" }));
    await user.click(screen.getByRole("button", { name: "Daily findings digest" }));
    await user.click(screen.getByRole("button", { name: "Approve first gate" }));

    expect(screen.getByText("Workspace: EMEA transfer pricing")).toBeInTheDocument();
    expect(screen.getByText("Subgroup: France local file")).toBeInTheDocument();
    expect(screen.getByText("Unread: 3")).toBeInTheDocument();
    expect(screen.getByText("Gates: 2")).toBeInTheDocument();
    expect(screen.getByText("Cadence: daily")).toBeInTheDocument();
  });
});
