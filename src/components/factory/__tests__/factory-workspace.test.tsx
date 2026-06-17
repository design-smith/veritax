import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FactoryWorkspace } from "../factory-workspace";

const sections = [
  {
    id: "s1",
    title: "1. Introduction",
    status: "generated" as const,
    content: "This local file describes the transfer pricing policies of Veritax UK Ltd.",
    inputChips: [{ label: "Entity profile", ref: "e2" }, { label: "FAR summary", ref: "d1" }],
  },
  {
    id: "s2",
    title: "2. Transfer Pricing Analysis",
    status: "stale" as const,
    content: "The royalty rate applied is 18%, tested against the CUT benchmark.",
    inputChips: [{ label: "Benchmark study", ref: "d5" }],
  },
  {
    id: "s3",
    title: "3. Conclusions",
    status: "blocked" as const,
    content: "Pending resolution of finding fn1.",
    inputChips: [],
  },
];

describe("FactoryWorkspace", () => {
  it("renders all section titles in the outline panel", () => {
    render(<FactoryWorkspace sections={sections} onSectionSelect={vi.fn()} />);
    // Each title may appear in outline + canvas — at least one occurrence is sufficient
    sections.forEach((s) => expect(screen.getAllByText(s.title).length).toBeGreaterThan(0));
  });

  it("renders status dots with correct test ids", () => {
    render(<FactoryWorkspace sections={sections} onSectionSelect={vi.fn()} />);
    expect(screen.getByTestId("status-dot-s1")).toHaveClass("generated");
    expect(screen.getByTestId("status-dot-s2")).toHaveClass("stale");
    expect(screen.getByTestId("status-dot-s3")).toHaveClass("blocked");
  });

  it("renders first section content in canvas by default", () => {
    render(<FactoryWorkspace sections={sections} onSectionSelect={vi.fn()} />);
    expect(screen.getByText(/describes the transfer pricing policies/)).toBeInTheDocument();
  });

  it("switches canvas content when outline section is clicked", async () => {
    render(<FactoryWorkspace sections={sections} onSectionSelect={vi.fn()} />);
    await userEvent.click(screen.getByText("2. Transfer Pricing Analysis"));
    expect(screen.getByText(/royalty rate applied is 18%/)).toBeInTheDocument();
  });

  it("renders input chips for the active section", async () => {
    render(<FactoryWorkspace sections={sections} onSectionSelect={vi.fn()} />);
    expect(screen.getByText("Entity profile")).toBeInTheDocument();
    expect(screen.getByText("FAR summary")).toBeInTheDocument();
  });

  it("renders context panel with Sources, Comments, and Checks tabs", () => {
    render(<FactoryWorkspace sections={sections} onSectionSelect={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Sources" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Comments" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Checks" })).toBeInTheDocument();
  });

  it("calls onSectionSelect when a section in outline is clicked", async () => {
    const onSectionSelect = vi.fn();
    render(<FactoryWorkspace sections={sections} onSectionSelect={onSectionSelect} />);
    await userEvent.click(screen.getByText("3. Conclusions"));
    expect(onSectionSelect).toHaveBeenCalledWith("s3");
  });
});
