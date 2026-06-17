import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssignControl } from "../pat-7-assignment";
import { mockUsers } from "@/lib/mock";

const eligibleUsers = mockUsers.filter((u) => u.role === "analyst" || u.role === "manager");

describe("AssignControl", () => {
  it("shows a list of eligible users", async () => {
    render(
      <AssignControl
        open
        users={eligibleUsers}
        objectScope="Veritax UK Ltd subgraph"
        onAssign={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Marcus Webb")).toBeInTheDocument();
    expect(screen.getByText("Ikaika Choi")).toBeInTheDocument();
  });

  it("renders the access consequence statement", () => {
    render(
      <AssignControl
        open
        users={eligibleUsers}
        objectScope="Veritax UK Ltd subgraph"
        onAssign={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/grants/i)).toBeInTheDocument();
    expect(screen.getByText(/Veritax UK Ltd subgraph/i)).toBeInTheDocument();
  });

  it("calls onAssign with userId and optional due date on submit", async () => {
    const onAssign = vi.fn();
    render(
      <AssignControl
        open
        users={eligibleUsers}
        objectScope="Finding fn1"
        onAssign={onAssign}
        onClose={vi.fn()}
      />
    );
    // select a user
    await userEvent.click(screen.getByRole("radio", { name: /Ikaika Choi/i }));
    await userEvent.click(screen.getByRole("button", { name: /assign/i }));
    expect(onAssign).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u3" }),
    );
  });

  it("disables Assign button until a user is selected", () => {
    render(
      <AssignControl
        open
        users={eligibleUsers}
        objectScope="Finding fn1"
        onAssign={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: /assign/i })).toBeDisabled();
  });
});
