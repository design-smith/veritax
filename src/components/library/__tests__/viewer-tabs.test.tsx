import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewerOutlineTab } from "../viewer-outline-tab";
import { ViewerExtractionsTab } from "../viewer-extractions-tab";
import { ViewerVersionsTab } from "../viewer-versions-tab";

// ── Outline ──────────────────────────────────────────────────────────────────

const sections = [
  { id: "s1", title: "Introduction", level: 1 },
  { id: "s2", title: "Transfer Pricing Overview", level: 1 },
  { id: "s3", title: "Royalty Analysis", level: 2 },
  { id: "s4", title: "Benchmarking", level: 2 },
];

describe("ViewerOutlineTab", () => {
  it("renders all section headings", () => {
    render(<ViewerOutlineTab sections={sections} onSectionClick={vi.fn()} />);
    sections.forEach((s) => expect(screen.getByText(s.title)).toBeInTheDocument());
  });

  it("indents subsections based on level", () => {
    render(<ViewerOutlineTab sections={sections} onSectionClick={vi.fn()} />);
    const royalty = screen.getByText("Royalty Analysis").closest("button")!;
    expect(royalty.className).toMatch(/pl-[468]/); // indented
  });

  it("calls onSectionClick with section id when clicked", async () => {
    const onSectionClick = vi.fn();
    render(<ViewerOutlineTab sections={sections} onSectionClick={onSectionClick} />);
    await userEvent.click(screen.getByText("Royalty Analysis"));
    expect(onSectionClick).toHaveBeenCalledWith("s3");
  });
});

// ── Extractions ──────────────────────────────────────────────────────────────

const extractions = [
  { id: "ex1", fieldName: "Royalty rate", value: "18%", confidence: 0.91, spanId: "span-r1", sourceSection: "§4.2" },
  { id: "ex2", fieldName: "Policy rate", value: "12%", confidence: 0.95, spanId: "span-r2", sourceSection: "§3.1" },
  { id: "ex3", fieldName: "Effective date", value: "2024-01-01", confidence: 0.99, spanId: "span-r3", sourceSection: "§1.2" },
];

describe("ViewerExtractionsTab", () => {
  it("renders all extraction fields with values", () => {
    render(<ViewerExtractionsTab extractions={extractions} onFieldClick={vi.fn()} onCorrect={vi.fn()} />);
    expect(screen.getByText("Royalty rate")).toBeInTheDocument();
    expect(screen.getByText("18%")).toBeInTheDocument();
    expect(screen.getByText("Policy rate")).toBeInTheDocument();
  });

  it("shows confidence percentage for each field", () => {
    render(<ViewerExtractionsTab extractions={extractions} onFieldClick={vi.fn()} onCorrect={vi.fn()} />);
    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(screen.getByText("95%")).toBeInTheDocument();
  });

  it("calls onFieldClick with spanId when field row clicked", async () => {
    const onFieldClick = vi.fn();
    render(<ViewerExtractionsTab extractions={extractions} onFieldClick={onFieldClick} onCorrect={vi.fn()} />);
    await userEvent.click(screen.getByText("Royalty rate").closest("button")!);
    expect(onFieldClick).toHaveBeenCalledWith("span-r1");
  });

  it("renders Correct action on each field", () => {
    render(<ViewerExtractionsTab extractions={extractions} onFieldClick={vi.fn()} onCorrect={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /correct/i })).toHaveLength(extractions.length);
  });
});

// ── Versions ─────────────────────────────────────────────────────────────────

const versions = [
  { id: "v3", number: 3, createdAt: "2025-11-20T14:00:00Z", author: "Ikaika Choi", isExecuted: false },
  { id: "v2", number: 2, createdAt: "2025-10-15T09:00:00Z", author: "Sarah Kimura", isExecuted: false },
  { id: "v1", number: 1, createdAt: "2025-09-01T10:00:00Z", author: "Marcus Webb", isExecuted: true },
];

describe("ViewerVersionsTab", () => {
  it("renders all version entries", () => {
    render(<ViewerVersionsTab versions={versions} currentVersionId="v3" onSelectVersion={vi.fn()} />);
    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
  });

  it("marks the executed version with a badge", () => {
    render(<ViewerVersionsTab versions={versions} currentVersionId="v3" onSelectVersion={vi.fn()} />);
    expect(screen.getByText(/executed/i)).toBeInTheDocument();
  });

  it("calls onSelectVersion when a version is clicked", async () => {
    const onSelectVersion = vi.fn();
    render(<ViewerVersionsTab versions={versions} currentVersionId="v3" onSelectVersion={onSelectVersion} />);
    await userEvent.click(screen.getByText("v2").closest("button")!);
    expect(onSelectVersion).toHaveBeenCalledWith("v2");
  });

  it("highlights the current version", () => {
    render(<ViewerVersionsTab versions={versions} currentVersionId="v3" onSelectVersion={vi.fn()} />);
    const v3Btn = screen.getByText("v3").closest("button")!;
    expect(v3Btn).toHaveAttribute("aria-current", "true");
  });
});
