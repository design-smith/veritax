import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { mockUsers } from "@/lib/mock";
import { BreakGlassDialog } from "../break-glass-dialog";
import { RetentionScheduleEditor } from "../retention-schedule-editor";
import { SensitivityAccessManager } from "../sensitivity-access-manager";
import type { RetentionSchedule } from "../retention-schedule-editor";
import type { User } from "@/lib/mock";

const namedUsers = [mockUsers[0], mockUsers[1]];

const schedules: RetentionSchedule[] = [
  { id: "rs1", docClass: "local-file", jurisdiction: "GB", daysToRetain: 2555, legalHold: false },
  { id: "rs2", docClass: "master-file", jurisdiction: "US", daysToRetain: 2555, legalHold: true },
  { id: "rs3", docClass: "ica", jurisdiction: "DE", daysToRetain: 3650, legalHold: false },
];

function SensitivityAccessHarness() {
  const [usersWithAccess, setUsersWithAccess] = useState<User[]>(namedUsers);
  const [lastAccessChange, setLastAccessChange] = useState("none");

  return (
    <>
      <SensitivityAccessManager
        tier="sensitive"
        namedUsers={usersWithAccess}
        allUsers={mockUsers}
        onAdd={(userId) => {
          const user = mockUsers.find((candidate) => candidate.id === userId);
          if (!user) return;
          setUsersWithAccess((current) => [...current, user]);
          setLastAccessChange(`added:${userId}`);
        }}
        onRemove={(userId) => {
          setUsersWithAccess((current) => current.filter((user) => user.id !== userId));
          setLastAccessChange(`removed:${userId}`);
        }}
      />
      <p>Last access change: {lastAccessChange}</p>
    </>
  );
}

function RetentionScheduleHarness() {
  const [lastChange, setLastChange] = useState("none");

  return (
    <>
      <RetentionScheduleEditor
        schedules={schedules}
        onChange={(updated) => setLastChange(`${updated.id}:${updated.legalHold ? "hold" : "clear"}`)}
      />
      <p>Last retention change: {lastChange}</p>
    </>
  );
}

function BreakGlassHarness() {
  const [lastConfirmation, setLastConfirmation] = useState("none");
  const [open, setOpen] = useState(true);

  return (
    <>
      <BreakGlassDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={(payload) => setLastConfirmation(payload.reason)}
      />
      <p>Break-glass confirmation: {lastConfirmation}</p>
      <p>Dialog open: {open ? "yes" : "no"}</p>
    </>
  );
}

describe("SensitivityAccessManager", () => {
  it("renders current named access, removes a user, and adds an eligible user", async () => {
    const user = userEvent.setup();
    render(<SensitivityAccessHarness />);

    expect(screen.getByText("Alexandra Chen")).toBeInTheDocument();
    expect(screen.getByText("Marcus Webb")).toBeInTheDocument();
    expect(screen.getAllByText(/sensitive/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(namedUsers.length);

    await user.click(screen.getByRole("button", { name: /remove Alexandra Chen/i }));

    expect(screen.queryByText("Alexandra Chen")).not.toBeInTheDocument();
    expect(screen.getByText("Last access change: removed:u1")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "u3");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByText("Ikaika Choi")).toBeInTheDocument();
    expect(screen.getByText("Last access change: added:u3")).toBeInTheDocument();
  });
});

describe("RetentionScheduleEditor", () => {
  it("renders schedules and reports legal-hold changes through state", async () => {
    const user = userEvent.setup();
    render(<RetentionScheduleHarness />);

    expect(screen.getByText("local-file")).toBeInTheDocument();
    expect(screen.getByText("master-file")).toBeInTheDocument();
    expect(screen.getByText("ica")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(schedules.length);
    expect(screen.getAllByRole("checkbox")[1]).toBeChecked();
    expect(screen.getByText(/legal hold.*overrides/i)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /Legal hold for local-file GB/i }));

    expect(screen.getByText("Last retention change: rs1:hold")).toBeInTheDocument();
  });
});

describe("BreakGlassDialog", () => {
  it("requires reason and supervisor acknowledgment before confirmation", async () => {
    const user = userEvent.setup();
    render(<BreakGlassHarness />);

    expect(screen.getAllByText(/break.glass/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/reason/i), "Security incident investigation");
    expect(screen.getByRole("button", { name: /confirm/i })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: /confirm/i }));
    const ackCheckbox = screen.getByRole("checkbox", { name: /supervisor/i });
    expect(ackCheckbox).not.toBeChecked();
    expect(screen.getByRole("button", { name: /initiate break.glass/i })).toBeDisabled();

    await user.click(ackCheckbox);
    await user.click(screen.getByRole("button", { name: /initiate break.glass/i }));

    expect(screen.getByText("Break-glass confirmation: Security incident investigation")).toBeInTheDocument();
    expect(screen.getByText(/auto-review ticket|review ticket created/i)).toBeInTheDocument();
  });
});
