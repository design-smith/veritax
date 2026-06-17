import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConnectStage } from "../connect-stage";

describe("ConnectStage", () => {
  const forwardAddress = "ingest-abc123@veritax.io";

  it("renders the forward email address", () => {
    render(<ConnectStage forwardAddress={forwardAddress} onFilesDrop={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByText(forwardAddress)).toBeInTheDocument();
  });

  it("renders a copy button for the forward address", () => {
    render(<ConnectStage forwardAddress={forwardAddress} onFilesDrop={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("renders the drag-drop upload zone", () => {
    render(<ConnectStage forwardAddress={forwardAddress} onFilesDrop={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByTestId("upload-zone")).toBeInTheDocument();
  });

  it("calls onFilesDrop when files are dropped on the zone", () => {
    const onFilesDrop = vi.fn();
    render(<ConnectStage forwardAddress={forwardAddress} onFilesDrop={onFilesDrop} onContinue={vi.fn()} />);
    const zone = screen.getByTestId("upload-zone");
    const file = new File(["hello"], "test.pdf", { type: "application/pdf" });
    fireEvent.drop(zone, { dataTransfer: { files: [file], types: ["Files"] } });
    expect(onFilesDrop).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: "test.pdf" })]));
  });

  it("renders SharePoint connect button when sharepointEnabled is true", () => {
    render(
      <ConnectStage
        forwardAddress={forwardAddress}
        onFilesDrop={vi.fn()}
        onContinue={vi.fn()}
        sharepointEnabled
      />
    );
    expect(screen.getByRole("button", { name: /sharepoint/i })).toBeInTheDocument();
  });

  it("shows disabled SharePoint button with IT policy message when sharepointEnabled is false", () => {
    render(
      <ConnectStage
        forwardAddress={forwardAddress}
        onFilesDrop={vi.fn()}
        onContinue={vi.fn()}
        sharepointEnabled={false}
      />
    );
    expect(screen.getByRole("button", { name: /sharepoint/i })).toBeDisabled();
    expect(screen.getByText(/disabled by IT policy/i)).toBeInTheDocument();
  });

  it("shows uploaded files as a list after drop", () => {
    render(<ConnectStage forwardAddress={forwardAddress} onFilesDrop={vi.fn()} onContinue={vi.fn()} />);
    const zone = screen.getByTestId("upload-zone");
    const file = new File(["a"], "local-file.pdf", { type: "application/pdf" });
    fireEvent.drop(zone, { dataTransfer: { files: [file], types: ["Files"] } });
    expect(screen.getByText("local-file.pdf")).toBeInTheDocument();
  });

  it("Continue button is disabled before any file is dropped or connected", () => {
    render(<ConnectStage forwardAddress={forwardAddress} onFilesDrop={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("Continue button is enabled after files are dropped", () => {
    render(<ConnectStage forwardAddress={forwardAddress} onFilesDrop={vi.fn()} onContinue={vi.fn()} />);
    const zone = screen.getByTestId("upload-zone");
    fireEvent.drop(zone, {
      dataTransfer: { files: [new File(["a"], "doc.pdf", { type: "application/pdf" })], types: ["Files"] },
    });
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });
});
