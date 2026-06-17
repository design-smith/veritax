import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewQueue } from "../review-queue";
import { SignCeremony } from "../sign-ceremony";
import { HoursLog } from "../hours-log";

// ── ReviewQueue ───────────────────────────────────────────────────────────────

const assignments = [
  { id: "a1", docName: "Veritax UK Local File FY2024", docType: "local-file" as const, status: "assigned" as const, redlineCount: 3 },
  { id: "a2", docName: "Group Master File FY2024",     docType: "master-file" as const, status: "in-progress" as const, redlineCount: 0 },
  { id: "a3", docName: "Benchmark Study FY2022",       docType: "benchmark" as const, status: "signed" as const, redlineCount: 0 },
];

describe("ReviewQueue", () => {
  it("renders all assigned documents", () => {
    render(<ReviewQueue assignments={assignments} onOpen={vi.fn()} />);
    expect(screen.getByText("Veritax UK Local File FY2024")).toBeInTheDocument();
    expect(screen.getByText("Group Master File FY2024")).toBeInTheDocument();
  });

  it("renders document type chips", () => {
    render(<ReviewQueue assignments={assignments} onOpen={vi.fn()} />);
    expect(screen.getByText("local-file")).toBeInTheDocument();
    expect(screen.getByText("master-file")).toBeInTheDocument();
  });

  it("renders status chips", () => {
    render(<ReviewQueue assignments={assignments} onOpen={vi.fn()} />);
    expect(screen.getByText("assigned")).toBeInTheDocument();
    expect(screen.getByText("in-progress")).toBeInTheDocument();
    expect(screen.getByText("signed")).toBeInTheDocument();
  });

  it("shows redline count when > 0", () => {
    render(<ReviewQueue assignments={assignments} onOpen={vi.fn()} />);
    expect(screen.getByText(/3 changes/i)).toBeInTheDocument();
  });

  it("calls onOpen with assignment id when row clicked", async () => {
    const onOpen = vi.fn();
    render(<ReviewQueue assignments={assignments} onOpen={onOpen} />);
    await userEvent.click(screen.getByText("Veritax UK Local File FY2024"));
    expect(onOpen).toHaveBeenCalledWith("a1");
  });
});

// ── SignCeremony ──────────────────────────────────────────────────────────────

describe("SignCeremony", () => {
  const props = {
    docName: "Veritax UK Local File FY2024",
    reviewerName: "External Reviewer A",
    attestationText: "I confirm that I have reviewed the above document and it is accurate to the best of my knowledge.",
    onSeal: vi.fn(),
  };

  it("renders reviewer name and document name", () => {
    render(<SignCeremony {...props} />);
    expect(screen.getByText("External Reviewer A")).toBeInTheDocument();
    expect(screen.getByText("Veritax UK Local File FY2024")).toBeInTheDocument();
  });

  it("renders the attestation text", () => {
    render(<SignCeremony {...props} />);
    expect(screen.getByText(/accurate to the best of my knowledge/)).toBeInTheDocument();
  });

  it("renders a Seal & sign button", () => {
    render(<SignCeremony {...props} />);
    expect(screen.getByRole("button", { name: /seal.*sign|sign.*seal/i })).toBeInTheDocument();
  });

  it("requires checkbox confirmation before seal is enabled", () => {
    render(<SignCeremony {...props} />);
    expect(screen.getByRole("button", { name: /seal.*sign|sign.*seal/i })).toBeDisabled();
  });

  it("enables seal button after checkbox ticked", async () => {
    render(<SignCeremony {...props} />);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /seal.*sign|sign.*seal/i })).not.toBeDisabled();
  });

  it("calls onSeal and shows manifest receipt after seal clicked", async () => {
    const onSeal = vi.fn();
    render(<SignCeremony {...props} onSeal={onSeal} />);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: /seal.*sign|sign.*seal/i }));
    expect(onSeal).toHaveBeenCalledOnce();
    expect(screen.getByTestId("manifest-receipt")).toBeInTheDocument();
    expect(screen.getAllByText(/hash|receipt|signed/i).length).toBeGreaterThan(0);
  });
});

// ── HoursLog ──────────────────────────────────────────────────────────────────

const entries = [
  { id: "h1", docId: "a1", docName: "Veritax UK Local File FY2024", hours: 2.5, date: "2025-11-20" },
  { id: "h2", docId: "a2", docName: "Group Master File FY2024",     hours: 1.0, date: "2025-11-21" },
];

describe("HoursLog", () => {
  it("renders all hours entries", () => {
    render(<HoursLog entries={entries} onAddEntry={vi.fn()} />);
    expect(screen.getByText("Veritax UK Local File FY2024")).toBeInTheDocument();
    expect(screen.getByText("Group Master File FY2024")).toBeInTheDocument();
  });

  it("shows hours for each entry", () => {
    render(<HoursLog entries={entries} onAddEntry={vi.fn()} />);
    expect(screen.getByText(/2\.5h|2\.5 h/)).toBeInTheDocument();
    expect(screen.getByText(/1\.0h|1\.0 h|1h/)).toBeInTheDocument();
  });

  it("shows total hours", () => {
    render(<HoursLog entries={entries} onAddEntry={vi.fn()} />);
    expect(screen.getByText(/3\.5|total.*3\.5/i)).toBeInTheDocument();
  });

  it("renders a manual entry form", () => {
    render(<HoursLog entries={entries} onAddEntry={vi.fn()} />);
    expect(screen.getByRole("spinbutton", { name: /hours/i })).toBeInTheDocument();
  });

  it("calls onAddEntry when manual entry submitted", async () => {
    const onAddEntry = vi.fn();
    render(<HoursLog entries={entries} onAddEntry={onAddEntry} />);
    await userEvent.type(screen.getByRole("spinbutton", { name: /hours/i }), "3");
    await userEvent.click(screen.getByRole("button", { name: /add|log/i }));
    expect(onAddEntry).toHaveBeenCalledWith(expect.objectContaining({ hours: 3 }));
  });
});
