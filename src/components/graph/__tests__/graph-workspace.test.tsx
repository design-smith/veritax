import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GraphWorkspace } from "../graph-workspace";
import { mockEntities, mockFlows } from "@/lib/mock";

describe("GraphWorkspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens an entity inspector from the map and routes to the full entity page on double click", async () => {
    const user = userEvent.setup();
    const openedEntityIds: string[] = [];
    const entity = mockEntities[1];

    render(
      <GraphWorkspace
        entities={mockEntities}
        flows={mockFlows}
        onOpenEntityPage={(entityId) => openedEntityIds.push(entityId)}
      />,
    );

    const node = screen.getByRole("button", { name: `Open ${entity.name}` });
    await user.click(node);

    expect(screen.getByRole("heading", { name: entity.name })).toBeInTheDocument();

    await user.dblClick(node);

    expect(openedEntityIds).toEqual([entity.id]);
  });

  it("filters flows by status and persists the materiality threshold per view", async () => {
    const user = userEvent.setup();
    const threshold = 2_000_000;
    const expectedExceptionCount = mockFlows.filter((flow) => flow.status === "exception").length;
    const expectedMaterialCount = mockFlows.filter((flow) => flow.exposure >= threshold).length;

    const { unmount } = render(<GraphWorkspace entities={mockEntities} flows={mockFlows} />);

    expect(
      screen.getByRole("status", {
        name: `${mockEntities.length} entities, ${mockFlows.length} visible flows`,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "exception" }));
    expect(
      screen.getByRole("status", {
        name: `${mockEntities.length} entities, ${expectedExceptionCount} visible flows`,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "exception" }));
    fireEvent.change(screen.getByRole("slider", { name: /materiality threshold/i }), {
      target: { value: String(threshold) },
    });

    expect(
      screen.getByRole("status", {
        name: `${mockEntities.length} entities, ${expectedMaterialCount} visible flows`,
      }),
    ).toBeInTheDocument();

    unmount();
    render(<GraphWorkspace entities={mockEntities} flows={mockFlows} />);

    expect(screen.getByRole("slider", { name: /materiality threshold/i })).toHaveValue(
      String(threshold),
    );
    expect(
      screen.getByRole("status", {
        name: `${mockEntities.length} entities, ${expectedMaterialCount} visible flows`,
      }),
    ).toBeInTheDocument();
  });

  it("focuses canvas search with slash and marks matching entities", async () => {
    const user = userEvent.setup();
    const entity = mockEntities.find((item) => item.jurisdictionCode === "GB")!;

    render(<GraphWorkspace entities={mockEntities} flows={mockFlows} />);

    await user.keyboard("/");
    const search = screen.getByRole("textbox", { name: /search graph/i });
    expect(search).toHaveFocus();

    await user.type(search, "GB");

    expect(screen.getByText(/search highlights 1 entity/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Open ${entity.name}` })).toHaveAttribute(
      "data-search-hit",
      "true",
    );
  });

  it("renders tree view with ownership percentages, election badges, and structural markers", async () => {
    const user = userEvent.setup();

    render(<GraphWorkspace entities={mockEntities} flows={mockFlows} />);

    await user.click(screen.getByRole("button", { name: "Tree" }));

    expect(screen.getByRole("region", { name: /graph tree canvas/i })).toBeInTheDocument();
    expect(screen.getAllByText(/100% owned/i).length).toBeGreaterThan(0);
    expect(screen.getByText("check-the-box")).toBeInTheDocument();
    expect(screen.getAllByText(/structural change/i).length).toBeGreaterThan(0);
  });

  it("shift-selects multiple flows and opens a side-by-side comparison", async () => {
    const first = mockFlows[0];
    const second = mockFlows[1];
    const firstFrom = mockEntities.find((entity) => entity.id === first.fromEntityId)!;
    const firstTo = mockEntities.find((entity) => entity.id === first.toEntityId)!;
    const secondFrom = mockEntities.find((entity) => entity.id === second.fromEntityId)!;
    const secondTo = mockEntities.find((entity) => entity.id === second.toEntityId)!;

    render(<GraphWorkspace entities={mockEntities} flows={mockFlows} />);

    fireEvent.click(
      screen.getAllByRole("button", {
        name: `Open flow ${firstFrom.name} to ${firstTo.name}`,
      })[0],
      { shiftKey: true },
    );
    fireEvent.click(
      screen.getAllByRole("button", {
        name: `Open flow ${secondFrom.name} to ${secondTo.name}`,
      })[0],
      { shiftKey: true },
    );

    expect(screen.getByRole("heading", { name: /compare flows/i })).toBeInTheDocument();
    expect(screen.getByText(/2 selected flows/i)).toBeInTheDocument();
  });
});
