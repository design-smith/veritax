import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { filterDocuments, retentionDaysRemaining } from "../library-data";
import { LibraryList } from "../library-list";
import { mockDocuments } from "@/lib/mock";

// ── Pure filter function ─────────────────────────────────────────────────────

describe("filterDocuments", () => {
  it("returns all documents with empty facets", () => {
    const result = filterDocuments(mockDocuments, {});
    expect(result).toHaveLength(mockDocuments.length);
  });

  it("filters by document type", () => {
    const result = filterDocuments(mockDocuments, { type: "local-file" });
    result.forEach((d) => expect(d.type).toBe("local-file"));
  });

  it("filters by jurisdiction", () => {
    const result = filterDocuments(mockDocuments, { jurisdiction: "GB" });
    result.forEach((d) => expect(d.jurisdiction).toBe("GB"));
  });

  it("filters by fiscal year", () => {
    const result = filterDocuments(mockDocuments, { fy: "2024" });
    result.forEach((d) => expect(d.fy).toBe("2024"));
  });

  it("filters by custody class", () => {
    const result = filterDocuments(mockDocuments, { custody: "materialized" });
    result.forEach((d) => expect(d.custody).toBe("materialized"));
  });

  it("filters by sensitivity", () => {
    const result = filterDocuments(mockDocuments, { sensitivity: "sensitive" });
    result.forEach((d) => expect(d.sensitivity).toBe("sensitive"));
  });

  it("stacks multiple facets (AND logic)", () => {
    const result = filterDocuments(mockDocuments, { type: "local-file", jurisdiction: "GB" });
    result.forEach((d) => {
      expect(d.type).toBe("local-file");
      expect(d.jurisdiction).toBe("GB");
    });
  });
});

describe("retentionDaysRemaining", () => {
  it("returns positive days for a future date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 90);
    expect(retentionDaysRemaining(future.toISOString().split("T")[0])).toBeGreaterThan(0);
  });

  it("returns negative or zero for a past date", () => {
    const past = new Date();
    past.setDate(past.getDate() - 10);
    expect(retentionDaysRemaining(past.toISOString().split("T")[0])).toBeLessThanOrEqual(0);
  });
});

// ── LibraryList component ────────────────────────────────────────────────────

describe("LibraryList", () => {
  it("renders all documents as rows", () => {
    render(<LibraryList documents={mockDocuments} onOpen={vi.fn()} onDownload={vi.fn()} />);
    mockDocuments.forEach((d) => expect(screen.getByText(d.name)).toBeInTheDocument());
  });

  it("renders custody badge on each row", () => {
    render(<LibraryList documents={mockDocuments} onOpen={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getAllByText("materialized").length).toBeGreaterThan(0);
  });

  it("renders facet chips for type, jurisdiction, FY", () => {
    render(<LibraryList documents={mockDocuments} onOpen={vi.fn()} onDownload={vi.fn()} />);
    expect(screen.getByRole("button", { name: /local-file/i })).toBeInTheDocument();
  });

  it("filters documents when a facet chip is clicked", async () => {
    render(<LibraryList documents={mockDocuments} onOpen={vi.fn()} onDownload={vi.fn()} />);
    const localFileBtn = screen.getByRole("button", { name: /local-file/i });
    await userEvent.click(localFileBtn);
    // Only local-file docs should show
    const localFileDocs = mockDocuments.filter((d) => d.type === "local-file");
    const otherDocs = mockDocuments.filter((d) => d.type !== "local-file");
    localFileDocs.forEach((d) => expect(screen.getByText(d.name)).toBeInTheDocument());
    otherDocs.forEach((d) => expect(screen.queryByText(d.name)).not.toBeInTheDocument());
  });

  it("calls onOpen when a row is clicked", async () => {
    const onOpen = vi.fn();
    render(<LibraryList documents={mockDocuments} onOpen={onOpen} onDownload={vi.fn()} />);
    await userEvent.click(screen.getByText(mockDocuments[0].name));
    expect(onOpen).toHaveBeenCalledWith(mockDocuments[0]);
  });
});
