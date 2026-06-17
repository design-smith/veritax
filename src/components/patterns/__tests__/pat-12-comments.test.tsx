import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommentThread } from "../pat-12-comments";
import { mockUsers } from "@/lib/mock";

const comments = [
  {
    id: "c1",
    authorId: "u3",
    authorName: "Ikaika Choi",
    text: "This rate looks significantly above the upper quartile.",
    timestamp: "2025-11-20T14:00:00Z",
    resolved: false,
  },
  {
    id: "c2",
    authorId: "u2",
    authorName: "Marcus Webb",
    text: "Agreed — flagging for remediation path review.",
    timestamp: "2025-11-20T15:00:00Z",
    resolved: false,
  },
];

describe("CommentThread", () => {
  it("renders all comments with author names", () => {
    render(
      <CommentThread
        objectRef="findings/fn1"
        comments={comments}
        users={mockUsers}
        onAdd={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />
    );
    expect(screen.getByText("Ikaika Choi")).toBeInTheDocument();
    expect(screen.getByText("Marcus Webb")).toBeInTheDocument();
    expect(screen.getByText(/significantly above/)).toBeInTheDocument();
  });

  it("calls onAdd with text when new comment submitted", async () => {
    const onAdd = vi.fn();
    render(
      <CommentThread
        objectRef="findings/fn1"
        comments={comments}
        users={mockUsers}
        onAdd={onAdd}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />
    );
    await userEvent.type(screen.getByPlaceholderText(/add a comment/i), "Needs further investigation");
    await userEvent.click(screen.getByRole("button", { name: /post/i }));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Needs further investigation" })
    );
  });

  it("calls onResolve when resolve button clicked", async () => {
    const onResolve = vi.fn();
    render(
      <CommentThread
        objectRef="findings/fn1"
        comments={comments}
        users={mockUsers}
        onAdd={vi.fn()}
        onResolve={onResolve}
        onUnresolve={vi.fn()}
      />
    );
    const resolveButtons = screen.getAllByRole("button", { name: /resolve/i });
    await userEvent.click(resolveButtons[0]);
    expect(onResolve).toHaveBeenCalledWith("c1");
  });

  it("collapses resolved threads but keeps them accessible", () => {
    const resolvedComments = [
      { ...comments[0], resolved: true },
      comments[1],
    ];
    render(
      <CommentThread
        objectRef="findings/fn1"
        comments={resolvedComments}
        users={mockUsers}
        onAdd={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />
    );
    expect(screen.getByText(/1 resolved/i)).toBeInTheDocument();
    expect(screen.queryByText(/significantly above/)).not.toBeInTheDocument();
  });
});
