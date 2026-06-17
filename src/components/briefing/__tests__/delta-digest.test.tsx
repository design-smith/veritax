import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeltaDigestSection } from "../delta-digest-section";
import type { Event } from "@/lib/mock/types";

const events: Event[] = [
  {
    id: "ev1",
    type: "finding_created",
    timestamp: "2025-11-22T09:00:00Z",
    actorId: "u1",
    description: "IC scan created 15 new findings for FY2024",
    objectRef: "/findings?run=r1",
    objectType: "finding-set",
  },
  {
    id: "ev2",
    type: "gate_requested",
    timestamp: "2025-11-20T16:00:00Z",
    actorId: "u3",
    description: "Review requested for Veritax UK Local File FY2024 v2",
    objectRef: "/library/d2",
    objectType: "document",
  },
  {
    id: "ev3",
    type: "obligation_due",
    timestamp: "2025-11-22T08:00:00Z",
    actorId: "u1",
    description: "France CbCR Notification is overdue",
    objectRef: "/calendar?obligation=ob5",
    objectType: "obligation",
  },
];

describe("DeltaDigestSection", () => {
  it("renders all delta items with descriptions", () => {
    render(<DeltaDigestSection events={events} onAcknowledge={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText(/IC scan created 15 new findings/)).toBeInTheDocument();
    expect(screen.getByText(/Review requested for Veritax UK/)).toBeInTheDocument();
    expect(screen.getByText(/France CbCR Notification/)).toBeInTheDocument();
  });

  it("calls onAcknowledge with event id when acknowledge clicked", async () => {
    const onAcknowledge = vi.fn();
    render(<DeltaDigestSection events={events} onAcknowledge={onAcknowledge} onOpen={vi.fn()} />);
    const ackButtons = screen.getAllByRole("button", { name: /acknowledge/i });
    await userEvent.click(ackButtons[0]);
    expect(onAcknowledge).toHaveBeenCalledWith("ev1");
  });

  it("removes item from view after acknowledge (optimistic)", async () => {
    render(<DeltaDigestSection events={events} onAcknowledge={vi.fn()} onOpen={vi.fn()} />);
    const ackButtons = screen.getAllByRole("button", { name: /acknowledge/i });
    await userEvent.click(ackButtons[0]);
    expect(screen.queryByText(/IC scan created 15 new findings/)).not.toBeInTheDocument();
  });

  it("calls onOpen with objectRef when open clicked", async () => {
    const onOpen = vi.fn();
    render(<DeltaDigestSection events={events} onAcknowledge={vi.fn()} onOpen={onOpen} />);
    const openButtons = screen.getAllByRole("button", { name: /open/i });
    await userEvent.click(openButtons[0]);
    expect(onOpen).toHaveBeenCalledWith("/findings?run=r1");
  });

  it("shows empty state when all events are acknowledged", async () => {
    render(
      <DeltaDigestSection
        events={[events[0]]}
        onAcknowledge={vi.fn()}
        onOpen={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /acknowledge/i }));
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });
});
