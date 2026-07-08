import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConnectStage } from "../connect-stage";

const forwardAddress = "ingest-abc123@veritax.io";

function ConnectHarness({ sharepointEnabled = true }: { sharepointEnabled?: boolean }) {
  const [droppedFileNames, setDroppedFileNames] = useState<string[]>([]);
  const [continued, setContinued] = useState(false);

  return (
    <>
      <ConnectStage
        forwardAddress={forwardAddress}
        sharepointEnabled={sharepointEnabled}
        onFilesDrop={(files) => setDroppedFileNames(files.map((file) => file.name))}
        onContinue={() => setContinued(true)}
      />
      <p>Dropped files: {droppedFileNames.join(", ") || "none"}</p>
      <p>Connect continued: {continued ? "yes" : "no"}</p>
    </>
  );
}

describe("ConnectStage", () => {
  it("renders the forward address, copy button, upload zone, and SharePoint control", () => {
    render(<ConnectHarness />);

    expect(screen.getByText(forwardAddress)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByTestId("upload-zone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sharepoint/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("captures dropped files, shows them, and enables continuation", () => {
    render(<ConnectHarness />);

    fireEvent.drop(screen.getByTestId("upload-zone"), {
      dataTransfer: {
        files: [new File(["a"], "local-file.pdf", { type: "application/pdf" })],
        types: ["Files"],
      },
    });

    expect(screen.getByText("local-file.pdf")).toBeInTheDocument();
    expect(screen.getByText("Dropped files: local-file.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });

  it("shows disabled SharePoint button with IT policy message when SharePoint is blocked", () => {
    render(<ConnectHarness sharepointEnabled={false} />);

    expect(screen.getByRole("button", { name: /sharepoint/i })).toBeDisabled();
    expect(screen.getByText(/disabled by IT policy/i)).toBeInTheDocument();
  });
});
