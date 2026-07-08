import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AdvisorRequestForm } from "../advisor-request-form";
import { AdvisorRequestsList, type AdvisorRequest } from "../advisor-requests-list";

const requests: AdvisorRequest[] = [
  {
    id: "dr1",
    title: "Provide payroll headcount data for Germany FY2024",
    description: "Please provide headcount by cost center and month for the German entity.",
    dueDate: "2025-12-20",
    status: "pending",
    fields: [
      { id: "f1", label: "Headcount Jan-Dec", type: "number", required: true },
      { id: "f2", label: "Payroll total (EUR)", type: "number", required: true },
      { id: "f3", label: "Notes", type: "text", required: false },
    ],
  },
  {
    id: "dr2",
    title: "Confirm executed version of royalty agreement",
    description: "Indicate which version is the executed version and upload the signed copy.",
    dueDate: "2025-12-10",
    status: "submitted",
    fields: [{ id: "f4", label: "Version number", type: "text", required: true }],
  },
];

function AdvisorListHarness() {
  const [openedRequest, setOpenedRequest] = useState("none");

  return (
    <>
      <AdvisorRequestsList requests={requests} onOpen={setOpenedRequest} />
      <p>Opened request: {openedRequest}</p>
    </>
  );
}

function AdvisorFormHarness() {
  const [submittedRequest, setSubmittedRequest] = useState("none");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  return (
    <>
      <AdvisorRequestForm
        request={requests[0]}
        onUpload={(files) => setUploadedFiles(files.map((file) => file.name))}
        onSubmit={(payload) => setSubmittedRequest(payload.requestId)}
      />
      <p>Submitted request: {submittedRequest}</p>
      <p>Uploaded files: {uploadedFiles.join(", ") || "none"}</p>
    </>
  );
}

describe("AdvisorRequestsList", () => {
  it("renders assigned requests with status and due date", () => {
    render(<AdvisorListHarness />);

    expect(screen.getByText("Provide payroll headcount data for Germany FY2024")).toBeInTheDocument();
    expect(screen.getByText("Confirm executed version of royalty agreement")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("submitted")).toBeInTheDocument();
    expect(screen.getAllByText(/20 Dec|Dec 20/).length).toBeGreaterThan(0);
  });

  it("opens a request through the row action", async () => {
    const user = userEvent.setup();
    render(<AdvisorListHarness />);

    await user.click(screen.getByRole("button", { name: /provide payroll headcount data/i }));

    expect(screen.getByText("Opened request: dr1")).toBeInTheDocument();
  });
});

describe("AdvisorRequestForm", () => {
  it("requires all required fields before submission", async () => {
    const user = userEvent.setup();
    render(<AdvisorFormHarness />);

    expect(screen.getByLabelText(/Headcount/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/Headcount/), "42");
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();

    await user.type(screen.getByLabelText(/Payroll total/), "1200000");
    expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
  });

  it("submits field values and records dropped files through visible state", async () => {
    const user = userEvent.setup();
    render(<AdvisorFormHarness />);

    fireEvent.drop(screen.getByTestId("upload-slot"), {
      dataTransfer: {
        files: [new File(["payroll"], "germany-payroll.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })],
        types: ["Files"],
      },
    });
    await user.type(screen.getByLabelText(/Headcount/), "42");
    await user.type(screen.getByLabelText(/Payroll total/), "1200000");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(screen.getByText("Uploaded files: germany-payroll.xlsx")).toBeInTheDocument();
    expect(screen.getByText("Submitted request: dr1")).toBeInTheDocument();
  });
});
