import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FlowInspector } from "../flow-inspector";
import { mockEntities, mockFlows } from "@/lib/mock";

const flow = mockFlows[0];
const fromEntity = mockEntities.find((entity) => entity.id === flow.fromEntityId)!;
const toEntity = mockEntities.find((entity) => entity.id === flow.toEntityId)!;

describe("FlowInspector", () => {
  it("renders from-entity and to-entity names", () => {
    render(<FlowInspector flow={flow} fromEntity={fromEntity} toEntity={toEntity} onClose={vi.fn()} />);
    expect(screen.getByText(fromEntity.name)).toBeInTheDocument();
    expect(screen.getByText(toEntity.name)).toBeInTheDocument();
  });

  it("renders flow kind, method, and policy-versus-observed values", () => {
    render(<FlowInspector flow={flow} fromEntity={fromEntity} toEntity={toEntity} onClose={vi.fn()} />);
    expect(screen.getByText(flow.kind)).toBeInTheDocument();
    expect(screen.getByText(flow.method)).toBeInTheDocument();
    expect(screen.getAllByText(/policy/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/observed/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/18\.?0?%/)).toBeInTheDocument();
    expect(screen.getByText(/12\.?0?%/)).toBeInTheDocument();
  });

  it("keeps flow detail inside the graph inspector", () => {
    render(<FlowInspector flow={flow} fromEntity={fromEntity} toEntity={toEntity} onClose={vi.fn()} />);
    expect(screen.getAllByText("exception").length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /open full page/i })).not.toBeInTheDocument();
  });

  it("calls onClose when close clicked", () => {
    const onClose = vi.fn();
    render(<FlowInspector flow={flow} fromEntity={fromEntity} toEntity={toEntity} onClose={onClose} />);
    screen.getByRole("button", { name: /close/i }).click();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
