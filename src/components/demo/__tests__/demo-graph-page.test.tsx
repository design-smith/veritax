import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GraphWorkspace, DEFAULT_OWNERSHIP, PREVIOUS_OWNERSHIP } from "@/components/graph/graph-workspace";
import { mockEntities, mockFlows } from "@/lib/mock";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/demo/graph",
}));

describe("demo graph page", () => {
  it("renders entity nodes for all mock entities", () => {
    render(
      <GraphWorkspace
        entities={mockEntities}
        flows={mockFlows}
        ownership={DEFAULT_OWNERSHIP}
        previousOwnership={PREVIOUS_OWNERSHIP}
        onOpenEntityPage={() => {}}
        onOpenFlowPage={() => {}}
      />,
    );
    const first = mockEntities[0];
    expect(screen.getByRole("button", { name: `Open ${first.name}` })).toBeInTheDocument();
  });

  it("fires onOpenEntityPage with correct id on entity double-click", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    const openedIds: string[] = [];
    const entity = mockEntities[1];
    render(
      <GraphWorkspace
        entities={mockEntities}
        flows={mockFlows}
        ownership={DEFAULT_OWNERSHIP}
        previousOwnership={PREVIOUS_OWNERSHIP}
        onOpenEntityPage={(id) => openedIds.push(id)}
        onOpenFlowPage={() => {}}
      />,
    );
    await user.dblClick(screen.getByRole("button", { name: `Open ${entity.name}` }));
    expect(openedIds).toEqual([entity.id]);
  });
});
