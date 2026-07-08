import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeetingDetailPageContent } from "../meeting-detail-page-content";

describe("MeetingDetailPageContent", () => {
  it("surfaces extracted work, opens verification links, drafts recap email, and honors transcript custody", async () => {
    const user = userEvent.setup();
    render(<MeetingDetailPageContent meetingId="mtg1" />);

    expect(screen.getByRole("heading", { name: /TP Year-End Planning/i })).toBeInTheDocument();
    expect(screen.getByText(/calendar-linked/i)).toBeInTheDocument();
    expect(screen.getByText(/Refresh benchmark study for royalty comparables/i)).toBeInTheDocument();

    const assertion = screen.getByRole("article", { name: /UK royalty rate/i });
    expect(within(assertion).getByRole("link", { name: /open in verification queue/i })).toHaveAttribute(
      "href",
      "/verification-queue?assertion=as1",
    );

    await user.click(screen.getByRole("button", { name: /open in email draft/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/recap draft opened/i);
    expect(screen.getByRole("region", { name: /email draft/i })).toHaveTextContent(/send-on-approval policy/i);

    await user.click(screen.getByRole("button", { name: /approve recap send/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/recap send approved/i);

    await user.click(screen.getByRole("tab", { name: /transcript/i }));
    expect(screen.getByText(/Full transcript renders here/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /turn off meeting intake/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/meeting intake consent turned off/i);
    expect(screen.getByText(/Intake consent off/i)).toBeInTheDocument();
  });

  it("explains absent transcript state when custody blocks transcript content", async () => {
    const user = userEvent.setup();
    render(<MeetingDetailPageContent meetingId="mtg2" />);

    expect(screen.getAllByText(/commitments-only/i).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("tab", { name: /transcript/i }));
    expect(screen.getByText(/Transcript not available/i)).toBeInTheDocument();
    expect(screen.getByText(/Only commitment extractions are accessible/i)).toBeInTheDocument();
  });
});
