import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { computeDiff, type DiffChange } from "../redline-diff";
import { RedlineToggle } from "../redline-toggle";

// ── Pure diff computation ─────────────────────────────────────────────────────

describe("computeDiff", () => {
  it("returns no changes for identical texts", () => {
    const changes = computeDiff("hello world", "hello world");
    expect(changes).toHaveLength(0);
  });

  it("returns an insert for new text", () => {
    const changes = computeDiff("hello world", "hello beautiful world");
    const inserts = changes.filter((c) => c.type === "insert");
    expect(inserts.length).toBeGreaterThan(0);
    inserts.forEach((c) => expect(c.text).toBeTruthy());
  });

  it("returns a delete for removed text", () => {
    const changes = computeDiff("hello beautiful world", "hello world");
    const deletes = changes.filter((c) => c.type === "delete");
    expect(deletes.length).toBeGreaterThan(0);
  });

  it("correctly identifies the inserted word", () => {
    const changes = computeDiff("The rate is 12%", "The rate is 18%");
    const inserts = changes.filter((c) => c.type === "insert");
    expect(inserts.some((c) => c.text.includes("18"))).toBe(true);
    const deletes = changes.filter((c) => c.type === "delete");
    expect(deletes.some((c) => c.text.includes("12"))).toBe(true);
  });
});

// ── RedlineToggle component ───────────────────────────────────────────────────

const sections = [
  {
    id: "s1",
    title: "Introduction",
    currentText: "The royalty rate applied to Veritax UK Ltd is 18%.",
    priorText: "The royalty rate applied to Veritax UK Ltd is 12%.",
  },
  {
    id: "s2",
    title: "Benchmarking",
    currentText: "The CUT benchmark range is 10-14%.",
    priorText: "The CUT benchmark range is 10-14%.",
  },
];

describe("RedlineToggle", () => {
  it("renders a toggle button to activate redline", () => {
    render(<RedlineToggle sections={sections} />);
    expect(screen.getByRole("button", { name: /redline/i })).toBeInTheDocument();
  });

  it("shows change count in toolbar when redline is active", async () => {
    render(<RedlineToggle sections={sections} />);
    await userEvent.click(screen.getByRole("button", { name: /redline/i }));
    expect(screen.getByText(/changes/i)).toBeInTheDocument();
  });

  it("renders insert marks when redline is active", async () => {
    render(<RedlineToggle sections={sections} />);
    await userEvent.click(screen.getByRole("button", { name: /redline/i }));
    expect(screen.getAllByTestId("redline-insert").length).toBeGreaterThan(0);
  });

  it("renders delete marks when redline is active", async () => {
    render(<RedlineToggle sections={sections} />);
    await userEvent.click(screen.getByRole("button", { name: /redline/i }));
    expect(screen.getAllByTestId("redline-delete").length).toBeGreaterThan(0);
  });

  it("does not render diff marks when redline is inactive", () => {
    render(<RedlineToggle sections={sections} />);
    expect(screen.queryByTestId("redline-insert")).not.toBeInTheDocument();
    expect(screen.queryByTestId("redline-delete")).not.toBeInTheDocument();
  });

  it("n/p navigation buttons appear when redline is active", async () => {
    render(<RedlineToggle sections={sections} />);
    await userEvent.click(screen.getByRole("button", { name: /redline/i }));
    expect(screen.getByRole("button", { name: /next change/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /prev change/i })).toBeInTheDocument();
  });

  it("deactivates redline cleanly when toggled off", async () => {
    render(<RedlineToggle sections={sections} />);
    await userEvent.click(screen.getByRole("button", { name: /redline/i }));
    await userEvent.click(screen.getByRole("button", { name: /redline/i }));
    expect(screen.queryByTestId("redline-insert")).not.toBeInTheDocument();
  });
});
