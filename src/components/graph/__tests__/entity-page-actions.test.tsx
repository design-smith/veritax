import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntityPageContent } from "../entity-page-content";
import { mockDocuments, mockEntities, mockFindings, mockFlows } from "@/lib/mock";

const entity = mockEntities[0];
const relatedFlows = mockFlows.filter(
  (flow) => flow.fromEntityId === entity.id || flow.toEntityId === entity.id,
);
const relatedFindings = mockFindings.filter((finding) =>
  relatedFlows.some((flow) => flow.id === finding.flowId),
);
const relatedDocuments = mockDocuments.filter((document) =>
  document.entityIds.includes(entity.id),
);

describe("EntityPageContent actions", () => {
  it("creates a scoped scan run through the plan confirmation pattern", async () => {
    const user = userEvent.setup();

    render(
      <EntityPageContent
        entity={entity}
        relatedFlows={relatedFlows}
        relatedFindings={relatedFindings}
        relatedDocuments={relatedDocuments}
      />,
    );

    await user.click(screen.getByRole("button", { name: /run scoped scan/i }));

    const dialog = screen.getByRole("dialog", { name: /confirm action/i });
    expect(within(dialog).getByText(/scope: veritax corp \(us\)/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Run" }));

    expect(screen.getByRole("link", { name: /open run/i })).toHaveAttribute(
      "href",
      "/runs?run=scoped-scan-e1",
    );
    expect(screen.getByText(/scoped scan run created/i)).toBeInTheDocument();
  });

  it("shows citations on overview claims and provenance on financial figures", async () => {
    const user = userEvent.setup();

    render(
      <EntityPageContent
        entity={entity}
        relatedFlows={relatedFlows}
        relatedFindings={relatedFindings}
        relatedDocuments={relatedDocuments}
      />,
    );

    expect(screen.getAllByRole("button", { name: "citation" }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("tab", { name: "Financials" }));

    expect(screen.getAllByRole("button", { name: "provenance" }).length).toBeGreaterThan(0);
  });

  it("saves standing instructions, assignments, and profile exports from the page header", async () => {
    const user = userEvent.setup();
    const savedInstructions: string[] = [];
    const assignments: string[] = [];
    const exports: string[] = [];

    render(
      <EntityPageContent
        entity={entity}
        relatedFlows={relatedFlows}
        relatedFindings={relatedFindings}
        relatedDocuments={relatedDocuments}
        onSaveStandingInstruction={(_entityId, instruction) => savedInstructions.push(instruction)}
        onAssign={(_entityId, assigneeId) => assignments.push(assigneeId)}
        onExportProfile={(_entityId, payload) => exports.push(`${payload.format}:${payload.destination}`)}
      />,
    );

    await user.click(screen.getByRole("button", { name: /add standing instruction/i }));
    await user.type(
      screen.getByRole("textbox", { name: /instruction/i }),
      "Keep Japan royalty gaps in weekly review until the agreement is executed.",
    );
    await user.click(screen.getByRole("button", { name: /save instruction/i }));

    expect(savedInstructions).toEqual([
      "Keep Japan royalty gaps in weekly review until the agreement is executed.",
    ]);
    expect(screen.getByText(/standing instruction saved/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Assign" }));
    await user.selectOptions(screen.getByLabelText(/owner/i), "u3");
    await user.click(screen.getByRole("button", { name: /save assignment/i }));

    expect(assignments).toEqual(["u3"]);
    expect(screen.getByText(/assigned to ikaika choi/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /export profile/i }));
    const exportDialog = screen.getByRole("dialog", { name: "Export" });
    await user.click(within(exportDialog).getByRole("button", { name: "Export" }));

    expect(exports).toEqual(["PDF (sealed):Download"]);
    expect(screen.getByText(/profile exported as pdf/i)).toBeInTheDocument();
  });
});
