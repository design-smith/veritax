import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlowPageContent } from "../flow-page-content";
import { mockFlows, mockEntities, mockDocuments } from "@/lib/mock";

vi.mock("next/link", () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...p}>{children}</a>
  ),
}));

const flow = mockFlows[0]; // US→UK royalty, exception
const fromEntity = mockEntities.find((e) => e.id === flow.fromEntityId)!;
const toEntity = mockEntities.find((e) => e.id === flow.toEntityId)!;

const coverageByJurisdiction = [
  { jurisdiction: "United Kingdom", jurisdictionCode: "GB", hasLocalFile: true, documentId: "d2" },
  { jurisdiction: "United States", jurisdictionCode: "US", hasLocalFile: true, documentId: "d1" },
  { jurisdiction: "Germany", jurisdictionCode: "DE", hasLocalFile: false },
];

const props = {
  flow,
  fromEntity,
  toEntity,
  coverageByJurisdiction,
  onRetest: vi.fn(),
  onOpenInFactory: vi.fn(),
  onProposePolicyChange: vi.fn(),
};

describe("FlowPageContent", () => {
  it("renders party names in the header", () => {
    render(<FlowPageContent {...props} />);
    expect(screen.getByText(fromEntity.name)).toBeInTheDocument();
    expect(screen.getByText(toEntity.name)).toBeInTheDocument();
  });

  it("renders flow kind and method chips", () => {
    render(<FlowPageContent {...props} />);
    expect(screen.getByText(flow.kind)).toBeInTheDocument();
    expect(screen.getByText(flow.method)).toBeInTheDocument();
  });

  it("renders policy vs observed rate panel", () => {
    render(<FlowPageContent {...props} />);
    expect(screen.getAllByText(/policy/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/observed/i).length).toBeGreaterThan(0);
  });

  it("shows the agreement card with ICA status", () => {
    render(<FlowPageContent {...props} />);
    expect(screen.getByText(/agreement/i)).toBeInTheDocument();
    expect(screen.getByText(flow.agreementId!)).toBeInTheDocument();
  });

  it("renders documentation coverage table with jurisdiction rows", () => {
    render(<FlowPageContent {...props} />);
    expect(screen.getByText("GB")).toBeInTheDocument();
    expect(screen.getByText("DE")).toBeInTheDocument();
  });

  it("flags missing coverage jurisdictions as flagged", () => {
    render(<FlowPageContent {...props} />);
    expect(screen.getByText(/missing/i)).toBeInTheDocument();
  });

  it("renders Re-test range and Open in Factory action buttons", () => {
    render(<FlowPageContent {...props} />);
    expect(screen.getByRole("button", { name: /re-test/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open in factory/i })).toBeInTheDocument();
  });

  it("renders Propose policy change button (never edits inline)", () => {
    render(<FlowPageContent {...props} />);
    expect(screen.getByRole("button", { name: /propose policy change/i })).toBeInTheDocument();
  });
});
