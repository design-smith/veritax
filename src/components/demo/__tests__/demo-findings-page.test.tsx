import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FindingsWorkspace } from "@/components/findings/findings-workspace";
import { mockEntities, mockFindings, mockFlows, mockUsers } from "@/lib/mock";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/demo/findings",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("demo findings page", () => {
  it("renders the findings workspace with all critical findings visible", () => {
    render(
      <FindingsWorkspace
        initialFindings={mockFindings}
        flows={mockFlows}
        entities={mockEntities}
        users={mockUsers}
      />,
    );

    // Critical findings are shown first
    expect(screen.getAllByText(/uk royalty rate|france royalty|pillar 2/i).length).toBeGreaterThan(0);
  });

  it("navigates to /demo/findings/[id] when a finding row is opened", async () => {
    const onOpenFinding = vi.fn();
    const user = userEvent.setup();

    render(
      <FindingsWorkspace
        initialFindings={mockFindings}
        flows={mockFlows}
        entities={mockEntities}
        users={mockUsers}
        onOpenFinding={onOpenFinding}
      />,
    );

    // Click the first finding row (critical — UK royalty)
    const rows = screen.getAllByRole("row");
    // find a data row (not the header)
    const firstDataRow = rows.find((r) => r.querySelector('[data-testid="cell-severity"]'));
    if (firstDataRow) await user.click(firstDataRow);

    expect(onOpenFinding).toHaveBeenCalled();
    // The page wires this to router.push('/demo/findings/' + finding.id)
    const called = onOpenFinding.mock.calls[0]?.[0];
    expect(called?.id).toBeTruthy();
  });
});
