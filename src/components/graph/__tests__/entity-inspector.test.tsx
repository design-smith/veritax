import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntityInspector } from "../entity-inspector";
import { mockEntities } from "@/lib/mock";

const entity = mockEntities[0];

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
      (tab) => expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument(),
    );
  });

  it("keeps entity detail inside the graph inspector", () => {
    render(<EntityInspector entity={entity} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /open full page/i })).not.toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();
    render(<EntityInspector entity={entity} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
