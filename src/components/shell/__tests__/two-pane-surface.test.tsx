import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TwoPaneSurface } from "../two-pane-surface";

describe("TwoPaneSurface", () => {
  it("renders list, canvas, inspector, and header action as named regions", () => {
    render(
      <TwoPaneSurface
        title="Findings workbench"
        description="Open findings, citations, and gates in one surface."
        action={<button type="button">Export view</button>}
        list={<p>Finding rows</p>}
        canvas={<p>Evidence canvas</p>}
        inspector={<p>Finding inspector</p>}
      />,
    );

    expect(screen.getByRole("heading", { name: "Findings workbench" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export view" })).toBeInTheDocument();

    expect(within(screen.getByRole("region", { name: "List" })).getByText("Finding rows")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Canvas" })).getByText("Evidence canvas")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Inspector" })).getByText("Finding inspector")).toBeInTheDocument();
  });

  it("keeps the inspector region stable when no record is selected", () => {
    render(
      <TwoPaneSurface
        title="Graph workbench"
        list={<p>Entity rows</p>}
        canvas={<p>Intercompany Graph</p>}
      />,
    );

    expect(screen.getByRole("region", { name: "Inspector" })).toHaveTextContent(
      "Select a record to inspect.",
    );
  });
});
