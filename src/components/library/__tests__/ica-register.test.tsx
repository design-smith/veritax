import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ICARegister } from "../ica-register";

const agreements = [
  {
    id: "a1",
    name: "IC Royalty Agreement — US↔UK",
    status: "executed" as const,
    parties: ["Veritax Corp (US)", "Veritax UK Ltd"],
    renewalDate: "2026-12-31",
    linkedFlowIds: ["f1", "f7"],
  },
  {
    id: "a2",
    name: "Commissionnaire Agreement — US↔France",
    status: "expired" as const,
    parties: ["Veritax Corp (US)", "Veritax France SAS"],
    renewalDate: "2023-12-31",
    linkedFlowIds: ["f10", "f11"],
  },
  {
    id: "a3",
    name: "Flow f5 — US↔Japan",
    status: "missing" as const,
    parties: ["Veritax Corp (US)", "Veritax KK"],
    renewalDate: null,
    linkedFlowIds: ["f5"],
    isGapRow: true,
  },
];

describe("ICARegister", () => {
  it("renders all agreement rows including gap rows", () => {
    render(<ICARegister agreements={agreements} onDraftRenewal={vi.fn()} onRequestExecution={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText("IC Royalty Agreement — US↔UK")).toBeInTheDocument();
    expect(screen.getByText("Commissionnaire Agreement — US↔France")).toBeInTheDocument();
  });

  it("shows Executed status chip on the row", () => {
    render(<ICARegister agreements={agreements} onDraftRenewal={vi.fn()} onRequestExecution={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getAllByText("Executed").length).toBeGreaterThan(0);
  });

  it("shows Expired status chip on the row", () => {
    render(<ICARegister agreements={agreements} onDraftRenewal={vi.fn()} onRequestExecution={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getAllByText("Expired").length).toBeGreaterThan(0);
  });

  it("renders gap rows with Create agreement draft action", () => {
    render(<ICARegister agreements={agreements} onDraftRenewal={vi.fn()} onRequestExecution={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText(/flow without agreement/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create agreement draft/i })).toBeInTheDocument();
  });

  it("calls onDraftRenewal when Draft renewal clicked", async () => {
    const onDraftRenewal = vi.fn();
    render(<ICARegister agreements={agreements} onDraftRenewal={onDraftRenewal} onRequestExecution={vi.fn()} onOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /draft renewal/i }));
    expect(onDraftRenewal).toHaveBeenCalledWith("a1");
  });

  it("calls onRequestExecution for expired agreements", async () => {
    const onRequestExecution = vi.fn();
    render(<ICARegister agreements={agreements} onDraftRenewal={vi.fn()} onRequestExecution={onRequestExecution} onOpen={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /request execution/i }));
    expect(onRequestExecution).toHaveBeenCalledWith("a2");
  });

  it("shows rollup count by status", () => {
    render(<ICARegister agreements={agreements} onDraftRenewal={vi.fn()} onRequestExecution={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByTestId("rollup-executed")).toHaveTextContent("1");
    expect(screen.getByTestId("rollup-expired")).toHaveTextContent("1");
    expect(screen.getByTestId("rollup-missing")).toHaveTextContent("1");
  });
});
