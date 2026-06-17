import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BriefingContent } from "../briefing-content";
import { PermissionsProvider } from "@/contexts/permissions-context";
import { FYLensProvider } from "@/contexts/fy-lens-context";
import {
  mockEvents,
  mockGateRequests,
  mockObligations,
  mockCommitments,
  mockUsers,
} from "@/lib/mock";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/briefing",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function Wrapper({ role = "manager" as const, children }: { role?: "vp" | "manager" | "analyst" | "adjacent" | "admin"; children: React.ReactNode }) {
  return (
    <PermissionsProvider role={role}>
      <FYLensProvider>{children}</FYLensProvider>
    </PermissionsProvider>
  );
}

const requesterMap = Object.fromEntries(mockUsers.map((u) => [u.id, u]));

const fullProps = {
  events: mockEvents,
  gates: mockGateRequests,
  obligations: mockObligations,
  commitments: mockCommitments,
  requesterMap,
  onAcknowledge: vi.fn(),
  onOpen: vi.fn(),
  onApprove: vi.fn(),
  onRequestChanges: vi.fn(),
  onReject: vi.fn(),
  onDelegate: vi.fn(),
  onApproveRun: vi.fn(),
  onDismissCommitment: vi.fn(),
  onNavigateObligation: vi.fn(),
  onBoardPack: vi.fn(),
};

describe("BriefingContent", () => {
  it("renders the five section headings in order", () => {
    render(
      <Wrapper>
        <BriefingContent {...fullProps} />
      </Wrapper>
    );
    const headings = screen.getAllByRole("heading", { level: 2 });
    const labels = headings.map((h) => h.textContent);
    expect(labels).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/since you were here/i),
        expect.stringMatching(/decision queue/i),
        expect.stringMatching(/obligations/i),
        expect.stringMatching(/commitments/i),
      ])
    );
  });

  it("shows board pack action for VP role", () => {
    render(
      <Wrapper role="vp">
        <BriefingContent {...fullProps} />
      </Wrapper>
    );
    expect(screen.getByRole("button", { name: /generate board pack/i })).toBeInTheDocument();
  });

  it("hides board pack action for analyst role", () => {
    render(
      <Wrapper role="analyst">
        <BriefingContent {...fullProps} />
      </Wrapper>
    );
    expect(screen.queryByRole("button", { name: /generate board pack/i })).not.toBeInTheDocument();
  });

  it("shows onboarding cold-start state when no events or gates", () => {
    render(
      <Wrapper>
        <BriefingContent
          {...fullProps}
          events={[]}
          gates={[]}
          obligations={[]}
          commitments={[]}
        />
      </Wrapper>
    );
    expect(screen.getByText(/get started/i)).toBeInTheDocument();
  });

  it("shows degraded sources banner when sources list is provided", () => {
    render(
      <Wrapper>
        <BriefingContent {...fullProps} degradedSources={["SAP ERP", "Payroll System"]} />
      </Wrapper>
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/SAP ERP/)).toBeInTheDocument();
  });

  it("surfaces command status across the brief", () => {
    render(
      <Wrapper>
        <BriefingContent {...fullProps} degradedSources={["SAP ERP"]} />
      </Wrapper>
    );

    expect(screen.getByText(/deltas/i)).toBeInTheDocument();
    expect(screen.getByText(/pending gates/i)).toBeInTheDocument();
    expect(screen.getByText(/next obligation/i)).toBeInTheDocument();
    expect(screen.getAllByText(/board pack/i).length).toBeGreaterThan(0);
  });

  it("advances the active gate after approval", async () => {
    const onApprove = vi.fn();

    render(
      <Wrapper>
        <BriefingContent {...fullProps} onApprove={onApprove} />
      </Wrapper>
    );

    const activeGate = mockGateRequests[1];
    expect(screen.getAllByText(activeGate.objectName).length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole("button", { name: /^approve & promote$/i })[0]);

    expect(onApprove).toHaveBeenCalledWith(activeGate.id);
    expect(screen.queryByText(activeGate.objectName)).not.toBeInTheDocument();
  });
});
