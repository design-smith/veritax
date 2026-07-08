import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FlowPageContent } from "../flow-page-content";
import { mockDocuments, mockEntities, mockFindings, mockFlows } from "@/lib/mock";

const flow = mockFlows[0];
const fromEntity = mockEntities.find((entity) => entity.id === flow.fromEntityId)!;
const toEntity = mockEntities.find((entity) => entity.id === flow.toEntityId)!;
const relatedFindings = mockFindings.filter((finding) => finding.flowId === flow.id);
const relatedDocuments = mockDocuments.filter((document) =>
  document.entityIds.includes(flow.fromEntityId) || document.entityIds.includes(flow.toEntityId),
);

const coverageByJurisdiction = [
  { jurisdiction: "United Kingdom", jurisdictionCode: "GB", hasLocalFile: true, documentId: "d2" },
  { jurisdiction: "United States", jurisdictionCode: "US", hasLocalFile: true, documentId: "d1" },
  { jurisdiction: "Germany", jurisdictionCode: "DE", hasLocalFile: false },
];

describe("FlowPageContent actions", () => {
  it("creates retest runs, sends flow context to Factory, and creates governed policy gates", async () => {
    const user = userEvent.setup();
    const factoryHandoffs: string[] = [];
    const policyRequests: string[] = [];

    render(
      <FlowPageContent
        flow={flow}
        fromEntity={fromEntity}
        toEntity={toEntity}
        coverageByJurisdiction={coverageByJurisdiction}
        relatedFindings={relatedFindings}
        relatedDocuments={relatedDocuments}
        onRetest={(flowId) => ({
          id: `retest-${flowId}`,
          href: `/runs?run=retest-${flowId}`,
        })}
        onOpenInFactory={(href) => factoryHandoffs.push(href)}
        onProposePolicyChange={(flowId) => {
          policyRequests.push(flowId);
          return {
            id: `governed-edit-${flowId}`,
            href: `/verification?gate=governed-edit-${flowId}`,
          };
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /re-test range/i }));
    const retestDialog = screen.getByRole("dialog", { name: /confirm action/i });
    expect(within(retestDialog).getByText(/scope: f1/i)).toBeInTheDocument();

    await user.click(within(retestDialog).getByRole("button", { name: "Run" }));
    expect(screen.getByRole("link", { name: /open run retest-f1/i })).toHaveAttribute(
      "href",
      "/runs?run=retest-f1",
    );
    expect(screen.getByText(/re-test range run created/i)).toBeInTheDocument();
    await user.click(within(retestDialog).getByRole("button", { name: "Cancel" }));

    await user.click(screen.getByRole("button", { name: /open in factory/i }));
    expect(factoryHandoffs).toEqual(["/factory?flow=f1"]);
    expect(screen.getByText(/opened in factory/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /propose policy change/i }));
    expect(policyRequests).toEqual(["f1"]);
    expect(screen.getByRole("link", { name: /open gate governed-edit-f1/i })).toHaveAttribute(
      "href",
      "/verification?gate=governed-edit-f1",
    );
    expect(screen.queryByRole("spinbutton", { name: /policy rate/i })).not.toBeInTheDocument();
  });

  it("renders benchmark, findings, customs linkage, coverage, and provenance for the flow", () => {
    render(
      <FlowPageContent
        flow={flow}
        fromEntity={fromEntity}
        toEntity={toEntity}
        coverageByJurisdiction={coverageByJurisdiction}
        relatedFindings={relatedFindings}
        relatedDocuments={relatedDocuments}
      />,
    );

    expect(screen.getByRole("heading", { name: /benchmark/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /findings on flow/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /customs linkage/i })).toBeInTheDocument();
    expect(screen.getByText("DE")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "provenance" }).length).toBeGreaterThan(0);
    expect(screen.getByText(relatedFindings[0].id)).toBeInTheDocument();
  });
});
