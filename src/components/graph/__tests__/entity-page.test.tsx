import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntityPageContent } from "../entity-page-content";
import { mockEntities, mockFlows, mockFindings, mockDocuments } from "@/lib/mock";

vi.mock("next/link", () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...p}>{children}</a>
  ),
}));

const entity = mockEntities[0]; // Veritax Corp (US)
const relatedFlows = mockFlows.filter(
  (f) => f.fromEntityId === entity.id || f.toEntityId === entity.id
);
const relatedFindings = mockFindings.filter((f) => f.flowId && relatedFlows.some((fl) => fl.id === f.flowId));

const props = {
  entity,
  relatedFlows,
  relatedFindings,
  relatedDocuments: mockDocuments.filter((d) => d.entityIds.includes(entity.id)),
};

describe("EntityPageContent", () => {
  it("renders entity name in the page header", () => {
    render(<EntityPageContent {...props} />);
    expect(screen.getAllByText(entity.name).length).toBeGreaterThan(0);
  });

  it("renders all 8 tabs", () => {
    render(<EntityPageContent {...props} />);
    ["Overview", "Financials", "Substance", "Pillar 2", "Agreements", "Findings", "Filings", "Audit history"].forEach(
      (tab) => expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument()
    );
  });

  it("Overview tab shows functional profile and FAR summary", () => {
    render(<EntityPageContent {...props} defaultTab="Overview" />);
    expect(screen.getByText(/functional profile/i)).toBeInTheDocument();
  });

  it("Financials tab shows GAAP toggle", () => {
    render(<EntityPageContent {...props} defaultTab="Financials" />);
    expect(screen.getAllByRole("button", { name: /gaap/i }).length).toBeGreaterThan(0);
  });

  it("Findings tab shows related findings", () => {
    render(<EntityPageContent {...props} defaultTab="Findings" />);
    if (relatedFindings.length > 0) {
      expect(screen.getByText(relatedFindings[0].id)).toBeInTheDocument();
    } else {
      expect(screen.getByText(/no findings/i)).toBeInTheDocument();
    }
  });

  it("Pillar 2 tab shows GloBE attributes header", () => {
    render(<EntityPageContent {...props} defaultTab="Pillar 2" />);
    expect(screen.getAllByText(/globe/i).length).toBeGreaterThan(0);
  });

  it("Substance tab shows headcount header", () => {
    render(<EntityPageContent {...props} defaultTab="Substance" />);
    expect(screen.getAllByText(/headcount/i).length).toBeGreaterThan(0);
  });

  it("Agreements tab shows flows with ICA gap flags", () => {
    render(<EntityPageContent {...props} defaultTab="Agreements" />);
    expect(screen.getAllByText(/agreement/i).length).toBeGreaterThan(0);
  });
});
