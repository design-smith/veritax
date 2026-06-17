import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SourcesTable } from "../sources-table";
import { AddSourceCatalog } from "../add-source-catalog";

const sources = [
  { id: "src1", name: "SAP ERP", type: "ERP" as const, custodyClass: "shared" as const, scope: "Full GL, all periods", lastSync: "2025-11-22T06:00:00Z", lagHours: 0, volumeDocs: 18_420, ownerId: "u2", health: "healthy" as const },
  { id: "src2", name: "Payroll System", type: "HRIS" as const, custodyClass: "shared" as const, scope: "Headcount, payroll", lastSync: "2025-10-28T06:00:00Z", lagHours: 648, volumeDocs: 1_200, ownerId: "u2", health: "stale" as const },
  { id: "src3", name: "Ikaika Choi (email forward)", type: "email" as const, custodyClass: "personal" as const, scope: "Label-scoped read-only", lastSync: "2025-11-21T14:00:00Z", lagHours: 22, volumeDocs: 47, ownerId: "u3", health: "healthy" as const },
];

describe("SourcesTable", () => {
  it("renders all source rows", () => {
    render(<SourcesTable sources={sources} onPause={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.getByText("SAP ERP")).toBeInTheDocument();
    expect(screen.getByText("Payroll System")).toBeInTheDocument();
    expect(screen.getByText("Ikaika Choi (email forward)")).toBeInTheDocument();
  });

  it("shows health badge for each source", () => {
    render(<SourcesTable sources={sources} onPause={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.getAllByText("healthy").length).toBeGreaterThan(0);
    expect(screen.getByText("stale")).toBeInTheDocument();
  });

  it("renders Pause and Disconnect actions", () => {
    render(<SourcesTable sources={sources} onPause={vi.fn()} onDisconnect={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /pause/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /disconnect/i }).length).toBeGreaterThan(0);
  });

  it("calls onPause with source id when Pause clicked", async () => {
    const onPause = vi.fn();
    render(<SourcesTable sources={[sources[0]]} onPause={onPause} onDisconnect={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(onPause).toHaveBeenCalledWith("src1");
  });

  it("shows consequence statement when Disconnect clicked before confirming", async () => {
    render(<SourcesTable sources={[sources[0]]} onPause={vi.fn()} onDisconnect={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /disconnect/i }));
    expect(screen.getAllByText(/reference-orphaned|consequence/i).length).toBeGreaterThan(0);
  });
});

const catalog = [
  { id: "cat1", name: "SAP ERP", type: "ERP" as const, itPolicyState: "self-serve" as const },
  { id: "cat2", name: "Workday HRIS", type: "HRIS" as const, itPolicyState: "request" as const },
  { id: "cat3", name: "Slack", type: "messaging" as const, itPolicyState: "disabled" as const },
];

describe("AddSourceCatalog", () => {
  it("renders all catalog entries", () => {
    render(<AddSourceCatalog entries={catalog} onConnect={vi.fn()} onRequest={vi.fn()} />);
    expect(screen.getByText("SAP ERP")).toBeInTheDocument();
    expect(screen.getByText("Workday HRIS")).toBeInTheDocument();
    expect(screen.getByText("Slack")).toBeInTheDocument();
  });

  it("shows Self-serve chip for self-serve sources", () => {
    render(<AddSourceCatalog entries={catalog} onConnect={vi.fn()} onRequest={vi.fn()} />);
    expect(screen.getByText("Self-serve")).toBeInTheDocument();
  });

  it("shows Request chip and calls onRequest for request-gated sources", async () => {
    const onRequest = vi.fn();
    render(<AddSourceCatalog entries={catalog} onConnect={vi.fn()} onRequest={onRequest} />);
    await userEvent.click(screen.getByRole("button", { name: /request.*workday/i }));
    expect(onRequest).toHaveBeenCalledWith("cat2");
  });

  it("renders disabled entry as greyed out with no action", () => {
    render(<AddSourceCatalog entries={catalog} onConnect={vi.fn()} onRequest={vi.fn()} />);
    const disabledChip = screen.getByText("Disabled");
    expect(disabledChip).toBeInTheDocument();
  });
});
