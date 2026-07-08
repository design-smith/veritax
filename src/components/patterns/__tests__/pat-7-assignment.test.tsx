import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssignControl } from "../pat-7-assignment";
import { mockUsers } from "@/lib/mock";

const eligibleUsers = mockUsers.filter((u) => u.role === "analyst" || u.role === "manager");

interface AssignmentHarnessProps {
  objectScope?: string;
  currentAssigneeId?: string;
  enableUnassign?: boolean;
}

function OpenAssignmentHarness({
  objectScope = "Veritax UK Ltd subgraph",
  currentAssigneeId,
  enableUnassign = false,
}: AssignmentHarnessProps) {
  const [assignment, setAssignment] = useState("Not assigned");

  return (
    <>
      <AssignControl
        open
        users={eligibleUsers}
        objectScope={objectScope}
        currentAssigneeId={currentAssigneeId}
        onAssign={(payload) =>
          setAssignment(
            JSON.stringify({
              userId: payload.userId,
              dueDate: payload.dueDate ?? null,
              note: payload.note ?? null,
            }),
          )
        }
        onUnassign={enableUnassign ? () => setAssignment("Access revoked") : undefined}
        onClose={() => setAssignment("Closed")}
      />
      <p aria-label="assignment result">{assignment}</p>
    </>
  );
}

describe("AssignControl", () => {
  it("shows a list of eligible users", async () => {
    render(<OpenAssignmentHarness />);
    expect(screen.getByText("Marcus Webb")).toBeInTheDocument();
    expect(screen.getByText("Ikaika Choi")).toBeInTheDocument();
  });

  it("renders the access consequence statement", () => {
    render(<OpenAssignmentHarness />);
    expect(screen.getByText(/grants/i)).toBeInTheDocument();
    expect(screen.getByText(/Veritax UK Ltd subgraph/i)).toBeInTheDocument();
  });

  it("requires confirmation before assigning access", async () => {
    render(<OpenAssignmentHarness objectScope="Finding fn1" />);

    await userEvent.click(screen.getByRole("radio", { name: /Ikaika Choi/i }));
    await userEvent.click(screen.getByRole("button", { name: /assign/i }));

    expect(screen.getByText(/confirm access grant/i)).toBeInTheDocument();
    expect(screen.getByLabelText("assignment result")).toHaveTextContent("Not assigned");

    await userEvent.click(screen.getByRole("button", { name: /confirm assignment/i }));

    expect(screen.getByLabelText("assignment result")).toHaveTextContent('"userId":"u3"');
  });

  it("requires confirmation before unassigning and revoking access", async () => {
    render(
      <OpenAssignmentHarness
        objectScope="Finding fn1"
        currentAssigneeId="u3"
        enableUnassign
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /unassign/i }));

    expect(screen.getByText(/confirm access revoke/i)).toBeInTheDocument();
    expect(screen.getByLabelText("assignment result")).toHaveTextContent("Not assigned");

    await userEvent.click(screen.getByRole("button", { name: /confirm unassign/i }));

    expect(screen.getByLabelText("assignment result")).toHaveTextContent("Access revoked");
  });

  it("passes due date and note after assignment confirmation", async () => {
    render(<OpenAssignmentHarness objectScope="Finding fn1" />);

    await userEvent.click(screen.getByRole("radio", { name: /Ikaika Choi/i }));
    await userEvent.type(screen.getByLabelText(/due date/i), "2026-06-30");
    await userEvent.type(screen.getByLabelText(/note/i), "Review record citations");
    await userEvent.click(screen.getByRole("button", { name: /assign/i }));
    await userEvent.click(screen.getByRole("button", { name: /confirm assignment/i }));

    expect(screen.getByLabelText("assignment result")).toHaveTextContent('"userId":"u3"');
    expect(screen.getByLabelText("assignment result")).toHaveTextContent('"dueDate":"2026-06-30"');
    expect(screen.getByLabelText("assignment result")).toHaveTextContent(
      '"note":"Review record citations"',
    );
  });

  it("disables Assign button until a user is selected", () => {
    render(<OpenAssignmentHarness objectScope="Finding fn1" />);
    expect(screen.getByRole("button", { name: /assign/i })).toBeDisabled();
  });
});
