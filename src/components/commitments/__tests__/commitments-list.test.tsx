import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitmentsListView } from "../commitments-list-view";
import { mockCommitments, mockUsers } from "@/lib/mock";

const ME = mockUsers[2]; // Ikaika Choi — u3

describe("CommitmentsListView", () => {
  it("renders all commitments", () => {
    render(<CommitmentsListView commitments={mockCommitments} currentUserId={ME.id} onOpen={vi.fn()} />);
    mockCommitments.forEach((c) => expect(screen.getByText(c.text)).toBeInTheDocument());
  });

  it("shows source type chip (meeting / email) on each row", () => {
    render(<CommitmentsListView commitments={mockCommitments} currentUserId={ME.id} onOpen={vi.fn()} />);
    expect(screen.getAllByText(/meeting/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/email/i).length).toBeGreaterThan(0);
  });

  it("shows plan-state badge on each row", () => {
    render(<CommitmentsListView commitments={mockCommitments} currentUserId={ME.id} onOpen={vi.fn()} />);
    expect(screen.getAllByText(/pending|approved|external/i).length).toBeGreaterThan(0);
  });

  it("Mine filter shows only commitments owned by currentUserId", async () => {
    render(<CommitmentsListView commitments={mockCommitments} currentUserId={ME.id} onOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^mine$/i }));
    const mineCommitments = mockCommitments.filter((c) => c.ownerId === ME.id);
    const otherCommitments = mockCommitments.filter((c) => c.ownerId !== ME.id);
    mineCommitments.forEach((c) => expect(screen.getByText(c.text)).toBeInTheDocument());
    otherCommitments.forEach((c) => expect(screen.queryByText(c.text)).not.toBeInTheDocument());
  });

  it("All filter restores full list", async () => {
    render(<CommitmentsListView commitments={mockCommitments} currentUserId={ME.id} onOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /^mine$/i }));
    await userEvent.click(screen.getByRole("button", { name: /^all$/i }));
    mockCommitments.forEach((c) => expect(screen.getByText(c.text)).toBeInTheDocument());
  });

  it("calls onOpen with commitment id when row clicked", async () => {
    const onOpen = vi.fn();
    render(<CommitmentsListView commitments={mockCommitments} currentUserId={ME.id} onOpen={onOpen} />);
    await userEvent.click(screen.getByText(mockCommitments[0].text));
    expect(onOpen).toHaveBeenCalledWith(mockCommitments[0].id);
  });

  it("shows due date on rows that have one", () => {
    render(<CommitmentsListView commitments={mockCommitments} currentUserId={ME.id} onOpen={vi.fn()} />);
    // mockCommitments[0] has due: "2025-12-15"
    expect(screen.getByText(/Dec 15/)).toBeInTheDocument();
  });
});
