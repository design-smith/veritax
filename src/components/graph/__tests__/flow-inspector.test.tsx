import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlowInspector } from "../flow-inspector";
import { mockFlows, mockEntities } from "@/lib/mock";

vi.mock("next/link", () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...p}>{children}</a>
  ),
}));

const flow = mockFlows[0]; // US→UK royalty, exception status
const fromEntity = mockEntities.find((e) => e.id === flow.fromEntityId)!;
const toEntity = mockEntities.find((e) => e.id === flow.toEntityId)!;

describe("FlowInspector", () => {
  it("renders from-entity and to-entity names", () => {
    render(<FlowInspector flow={flow} fromEntity={fromEntity} toEntity={toEntity} onClose={vi.fn()} />);
    expect(screen.getByText(fromEntity.name)).toBeInTheDocument();
    expect(screen.getByText(toEntity.name)).toBeInTheDocument();
  });

  it("renders flow kind and method chips", () => {
    render(<FlowInspector flow={flow} fromEntity={fromEntity} toEntity={toEntity} onClose={vi.fn()} />);
    expect(screen.getByText(flow.kind)).toBeInTheDocument();
    expect(screen.getByText(flow.method)).toBeInTheDocument();
  });

  it("renders policy rate vs observed rate", () => {
    render(<FlowInspector flow={flow} fromEntity={fromEntity} toEntity={toEntity} onClose={vi.fn()} />);
    expect(screen.getAllByText(/policy/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/observed/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/18\.?0?%/)).toBeInTheDocument();
    expect(screen.getByText(/12\.?0?%/)).toBeInTheDocument();
  });

  it("shows exception status with a visible indicator", () => {
    render(<FlowInspector flow={flow} fromEntity={fromEntity} toEntity={toEntity} onClose={vi.fn()} />);
    expect(screen.getAllByText("exception").length).toBeGreaterThan(0);
  });

  it("renders a link to the full flow page", () => {
    render(<FlowInspector flow={flow} fromEntity={fromEntity} toEntity={toEntity} onClose={vi.fn()} />);
    expect(screen.getByRole("link", { name: /open full page/i }))
      .toHaveAttribute("href", `/graph/flows/${flow.id}`);
  });

  it("calls onClose when close clicked", async () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <FlowInspector flow={flow} fromEntity={fromEntity} toEntity={toEntity} onClose={onClose} />
    );
    getByRole("button", { name: /close/i }).click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
