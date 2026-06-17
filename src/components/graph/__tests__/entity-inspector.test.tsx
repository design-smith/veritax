import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntityInspector } from "../entity-inspector";
import { mockEntities } from "@/lib/mock";

vi.mock("next/link", () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...p}>{children}</a>
  ),
}));

const entity = mockEntities[0]; // Veritax Corp (US)

describe("EntityInspector", () => {
  it("renders entity name, role, and jurisdiction", () => {
    render(<EntityInspector entity={entity} onClose={vi.fn()} />);
    expect(screen.getByText(entity.name)).toBeInTheDocument();
    expect(screen.getByText(entity.role)).toBeInTheDocument();
    expect(screen.getByText(entity.jurisdictionCode)).toBeInTheDocument();
  });

  it("renders as-of date", () => {
    render(<EntityInspector entity={entity} onClose={vi.fn()} />);
    expect(screen.getByText(entity.asOf)).toBeInTheDocument();
  });

  it("renders all required tab stubs", () => {
    render(<EntityInspector entity={entity} onClose={vi.fn()} />);
    ["Overview", "Financials", "Substance", "Pillar 2", "Agreements", "Findings", "Filings"].forEach(
      (tab) => expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument()
    );
  });

  it("renders copy-link button", () => {
    render(<EntityInspector entity={entity} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
  });

  it("renders a link to the full entity page", () => {
    render(<EntityInspector entity={entity} onClose={vi.fn()} />);
    expect(screen.getByRole("link", { name: /open full page/i })).toHaveAttribute(
      "href",
      `/graph/entities/${entity.id}`
    );
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();
    render(<EntityInspector entity={entity} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
