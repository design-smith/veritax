import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PermissionsProvider } from "@/contexts/permissions-context";
import { FYLensProvider } from "@/contexts/fy-lens-context";
import { BriefingContent } from "@/components/briefing/briefing-content";
import {
  mockCommitments,
  mockEvents,
  mockGateRequests,
  mockObligations,
  mockUsers,
} from "@/lib/mock";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/demo/briefing",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const requesterMap = Object.fromEntries(mockUsers.map((u) => [u.id, u]));
const noop = () => {};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <PermissionsProvider role="manager">
      <FYLensProvider>{children}</FYLensProvider>
    </PermissionsProvider>
  );
}

describe("demo briefing page", () => {
  it("renders gate cards from mock data", () => {
    render(
      <BriefingContent
        events={mockEvents}
        gates={mockGateRequests}
        obligations={mockObligations}
        commitments={mockCommitments}
        requesterMap={requesterMap}
        onAcknowledge={noop}
        onOpen={noop}
        onApprove={noop}
        onRequestChanges={noop}
        onReject={noop}
        onDelegate={noop}
        onApproveRun={noop}
        onDismissCommitment={noop}
        onNavigateObligation={noop}
        onBoardPack={noop}
      />,
      { wrapper: Wrapper },
    );

    // Gate cards from mockGateRequests
    expect(screen.getAllByText(/veritax uk local file/i).length).toBeGreaterThan(0);
    // Events section
    expect(screen.getAllByText(/ic scan|15 new findings|ingested|resolved|obligation/i).length).toBeGreaterThan(0);
    // Obligations strip
    expect(screen.getAllByText(/uk|germany|singapore|japan|france/i).length).toBeGreaterThan(0);
  });

  it("renders commitments from mock data", () => {
    render(
      <BriefingContent
        events={mockEvents}
        gates={mockGateRequests}
        obligations={mockObligations}
        commitments={mockCommitments}
        requesterMap={requesterMap}
        onAcknowledge={noop}
        onOpen={noop}
        onApprove={noop}
        onRequestChanges={noop}
        onReject={noop}
        onDelegate={noop}
        onApproveRun={noop}
        onDismissCommitment={noop}
        onNavigateObligation={noop}
        onBoardPack={noop}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getAllByText(/benchmark study|commissionnaire|japan substance|germany payroll/i).length).toBeGreaterThan(0);
  });
});
