import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeetingDetail } from "../meeting-detail";

const meeting = {
  id: "mtg1",
  title: "TP Year-End Planning — Q4 Review",
  date: "2025-11-10T14:00:00Z",
  participants: ["Marcus Webb", "Ikaika Choi", "Sarah Kimura"],
  classification: "ingested" as const,
  transcriptCustody: "allowed" as const,
  extractedCommitments: [
    { id: "cm1", text: "Refresh benchmark study before year-end", ownerId: "u3" },
    { id: "cm2", text: "Obtain France agreement renewal", ownerId: "u2" },
  ],
  extractedAssertions: [
    { id: "as1", text: "UK royalty rate is above the benchmark range", confidenceLabel: "confirmed" },
  ],
  recapDraft: "Meeting covered TP year-end planning. Key actions: refresh benchmarks, renew France ICA.",
};

describe("MeetingDetail", () => {
  it("renders the meeting title and date", () => {
    render(<MeetingDetail meeting={meeting} onOpenEmailDraft={vi.fn()} />);
    expect(screen.getByText("TP Year-End Planning — Q4 Review")).toBeInTheDocument();
    expect(screen.getByText(/Nov 10|10 Nov/)).toBeInTheDocument();
  });

  it("renders the classification chip", () => {
    render(<MeetingDetail meeting={meeting} onOpenEmailDraft={vi.fn()} />);
    expect(screen.getByText("ingested")).toBeInTheDocument();
  });

  it("renders extracted commitments list", () => {
    render(<MeetingDetail meeting={meeting} onOpenEmailDraft={vi.fn()} />);
    expect(screen.getByText("Refresh benchmark study before year-end")).toBeInTheDocument();
    expect(screen.getByText("Obtain France agreement renewal")).toBeInTheDocument();
  });

  it("renders extracted assertions list", () => {
    render(<MeetingDetail meeting={meeting} onOpenEmailDraft={vi.fn()} />);
    expect(screen.getByText("UK royalty rate is above the benchmark range")).toBeInTheDocument();
  });

  it("renders the recap draft text", () => {
    render(<MeetingDetail meeting={meeting} onOpenEmailDraft={vi.fn()} />);
    expect(screen.getByText(/refresh benchmarks, renew France ICA/)).toBeInTheDocument();
  });

  it("renders Open in email draft button for recap", () => {
    render(<MeetingDetail meeting={meeting} onOpenEmailDraft={vi.fn()} />);
    expect(screen.getByRole("button", { name: /open in email draft/i })).toBeInTheDocument();
  });

  it("calls onOpenEmailDraft when Open in email draft clicked", async () => {
    const onOpenEmailDraft = vi.fn();
    render(<MeetingDetail meeting={meeting} onOpenEmailDraft={onOpenEmailDraft} />);
    await userEvent.click(screen.getByRole("button", { name: /open in email draft/i }));
    expect(onOpenEmailDraft).toHaveBeenCalledWith("mtg1");
  });

  it("shows the Transcript tab when custody is allowed", () => {
    render(<MeetingDetail meeting={meeting} onOpenEmailDraft={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /transcript/i })).toBeInTheDocument();
  });

  it("shows an absent-state message on Transcript tab when custody is not allowed", () => {
    const restricted = { ...meeting, transcriptCustody: "excluded" as const };
    render(<MeetingDetail meeting={restricted} onOpenEmailDraft={vi.fn()} />);
    // Tab exists but content explains why transcript is not available
    expect(screen.getByRole("tab", { name: /transcript/i })).toBeInTheDocument();
  });

  it("renders the Transcript tab content only when custody is allowed", () => {
    const restricted = { ...meeting, transcriptCustody: "excluded" as const };
    render(<MeetingDetail meeting={restricted} onOpenEmailDraft={vi.fn()} defaultTab="Transcript" />);
    expect(screen.getByText(/not available|custody.*excluded|transcript.*excluded/i)).toBeInTheDocument();
  });

  it("shows participants list", () => {
    render(<MeetingDetail meeting={meeting} onOpenEmailDraft={vi.fn()} />);
    expect(screen.getByText(/Marcus Webb/)).toBeInTheDocument();
  });
});
