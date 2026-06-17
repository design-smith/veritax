import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvisorRequestsList } from "../advisor-requests-list";
import { AdvisorRequestForm } from "../advisor-request-form";

const requests = [
  {
    id: "dr1",
    title: "Provide payroll headcount data for Germany FY2024",
    description: "Please provide headcount by cost center and month for the German entity.",
    dueDate: "2025-12-20",
    status: "pending" as const,
    fields: [
      { id: "f1", label: "Headcount (Jan–Dec)", type: "number" as const, required: true },
      { id: "f2", label: "Payroll total (EUR)", type: "number" as const, required: true },
      { id: "f3", label: "Notes", type: "text" as const, required: false },
    ],
  },
  {
    id: "dr2",
    title: "Confirm executed version of royalty agreement",
    description: "Indicate which version is the executed version and upload the signed copy.",
    dueDate: "2025-12-10",
    status: "submitted" as const,
    fields: [{ id: "f4", label: "Version number", type: "text" as const, required: true }],
  },
];

describe("AdvisorRequestsList", () => {
  it("renders all assigned requests", () => {
    render(<AdvisorRequestsList requests={requests} onOpen={vi.fn()} />);
    expect(screen.getByText("Provide payroll headcount data for Germany FY2024")).toBeInTheDocument();
    expect(screen.getByText("Confirm executed version of royalty agreement")).toBeInTheDocument();
  });

  it("shows deliverable status chip on each request", () => {
    render(<AdvisorRequestsList requests={requests} onOpen={vi.fn()} />);
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("submitted")).toBeInTheDocument();
  });

  it("shows due date on each request", () => {
    render(<AdvisorRequestsList requests={requests} onOpen={vi.fn()} />);
    expect(screen.getAllByText(/20 Dec|Dec 20/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/10 Dec|Dec 10/).length).toBeGreaterThan(0);
  });

  it("calls onOpen with request id when row clicked", async () => {
    const onOpen = vi.fn();
    render(<AdvisorRequestsList requests={requests} onOpen={onOpen} />);
    await userEvent.click(screen.getByText("Provide payroll headcount data for Germany FY2024"));
    expect(onOpen).toHaveBeenCalledWith("dr1");
  });
});

describe("AdvisorRequestForm", () => {
  const req = requests[0];

  it("renders all form fields with labels", () => {
    render(<AdvisorRequestForm request={req} onSubmit={vi.fn()} onUpload={vi.fn()} />);
    // labels include * for required — use regex to match partial text
    expect(screen.getByLabelText(/Headcount/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Payroll total/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Notes/)).toBeInTheDocument();
  });

  it("marks required fields with * indicator", () => {
    render(<AdvisorRequestForm request={req} onSubmit={vi.fn()} onUpload={vi.fn()} />);
    const requiredLabels = screen.getAllByText(/\*/);
    expect(requiredLabels.length).toBeGreaterThan(0);
  });

  it("disables Submit until all required fields are filled", async () => {
    render(<AdvisorRequestForm request={req} onSubmit={vi.fn()} onUpload={vi.fn()} />);
    expect(screen.getByRole("button", { name: /submit/i })).toBeDisabled();
  });

  it("enables Submit after required fields are filled", async () => {
    render(<AdvisorRequestForm request={req} onSubmit={vi.fn()} onUpload={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Headcount/), "42");
    await userEvent.type(screen.getByLabelText(/Payroll total/), "1200000");
    expect(screen.getByRole("button", { name: /submit/i })).not.toBeDisabled();
  });

  it("calls onSubmit with field values when submitted", async () => {
    const onSubmit = vi.fn();
    render(<AdvisorRequestForm request={req} onSubmit={onSubmit} onUpload={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/Headcount/), "42");
    await userEvent.type(screen.getByLabelText(/Payroll total/), "1200000");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "dr1" })
    );
  });

  it("renders upload slot for attaching files", () => {
    render(<AdvisorRequestForm request={req} onSubmit={vi.fn()} onUpload={vi.fn()} />);
    expect(screen.getByTestId("upload-slot")).toBeInTheDocument();
  });
});
