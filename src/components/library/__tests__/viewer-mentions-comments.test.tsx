import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewerMentionsTab } from "../viewer-mentions-tab";
import { ViewerCommentsTab } from "../viewer-comments-tab";
import { mockUsers } from "@/lib/mock";

// ── Mentions ─────────────────────────────────────────────────────────────────

const mentions = [
  { id: "m1", objectType: "finding" as const, objectId: "fn1", objectTitle: "UK royalty rate exceeds benchmark", href: "/findings/fn1" },
  { id: "m2", objectType: "finding" as const, objectId: "fn2", objectTitle: "France royalty rate breach", href: "/findings/fn2" },
  { id: "m3", objectType: "run" as const, objectId: "r1", objectTitle: "IC Scan FY2024", href: "/runs/r1" },
];

describe("ViewerMentionsTab", () => {
  it("renders all citing objects", () => {
    render(<ViewerMentionsTab mentions={mentions} />);
    expect(screen.getByText("UK royalty rate exceeds benchmark")).toBeInTheDocument();
    expect(screen.getByText("France royalty rate breach")).toBeInTheDocument();
    expect(screen.getByText("IC Scan FY2024")).toBeInTheDocument();
  });

  it("renders object type chips", () => {
    render(<ViewerMentionsTab mentions={mentions} />);
    expect(screen.getAllByText("finding").length).toBeGreaterThan(0);
    expect(screen.getByText("run")).toBeInTheDocument();
  });

  it("renders links to the citing objects", () => {
    render(<ViewerMentionsTab mentions={mentions} />);
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "/findings/fn1")).toBe(true);
    expect(links.some((l) => l.getAttribute("href") === "/runs/r1")).toBe(true);
  });

  it("shows empty state when no mentions", () => {
    render(<ViewerMentionsTab mentions={[]} />);
    expect(screen.getByText(/no objects cite this document/i)).toBeInTheDocument();
  });
});

// ── Comments ─────────────────────────────────────────────────────────────────

const comments = [
  { id: "c1", authorId: "u3", authorName: "Ikaika Choi", text: "Section 4.2 needs revision — rate is wrong.", timestamp: "2025-11-21T10:00:00Z", resolved: false },
  { id: "c2", authorId: "u2", authorName: "Marcus Webb", text: "Agreed, escalating.", timestamp: "2025-11-21T11:00:00Z", resolved: false },
];

describe("ViewerCommentsTab", () => {
  it("renders all comment threads", () => {
    render(
      <ViewerCommentsTab
        comments={comments}
        users={mockUsers}
        objectRef="library/d1"
        onAdd={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />
    );
    expect(screen.getByText(/Section 4\.2 needs revision/)).toBeInTheDocument();
    expect(screen.getByText(/Agreed, escalating/)).toBeInTheDocument();
  });

  it("renders a comment input area", () => {
    render(
      <ViewerCommentsTab
        comments={[]}
        users={mockUsers}
        objectRef="library/d1"
        onAdd={vi.fn()}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument();
  });

  it("calls onAdd with text when comment is submitted", async () => {
    const onAdd = vi.fn();
    render(
      <ViewerCommentsTab
        comments={[]}
        users={mockUsers}
        objectRef="library/d1"
        onAdd={onAdd}
        onResolve={vi.fn()}
        onUnresolve={vi.fn()}
      />
    );
    await userEvent.type(screen.getByPlaceholderText(/add a comment/i), "Needs update");
    await userEvent.click(screen.getByRole("button", { name: /post/i }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ text: "Needs update" }));
  });
});
