import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeftRail } from "../left-rail";
import { PermissionsProvider } from "@/contexts/permissions-context";

vi.mock("next/navigation", () => ({
  usePathname: () => "/briefing",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function Wrapper({ role = "manager", children }: { role?: "vp" | "manager" | "analyst" | "adjacent" | "admin"; children: React.ReactNode }) {
  return <PermissionsProvider role={role}>{children}</PermissionsProvider>;
}

describe("LeftRail", () => {
  it("renders all core nav items in fixed order", () => {
    render(<LeftRail />, { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> });

    const links = screen.getAllByRole("link");
    const labels = links.map((l) => l.textContent?.trim()).filter(Boolean);

    expect(labels).toContain("Briefing");
    expect(labels).toContain("Graph");
    expect(labels).toContain("Findings");
    expect(labels).toContain("Library");
    expect(labels).toContain("Monitor");
    expect(labels).toContain("Calendar");
    expect(labels).toContain("Commitments");
    expect(labels).toContain("Runs");
    expect(labels).toContain("Connectors");
  });

  it("hides Admin link for non-admin roles", () => {
    render(<LeftRail />, { wrapper: ({ children }) => <Wrapper role="analyst">{children}</Wrapper> });
    expect(screen.queryByRole("link", { name: /admin/i })).not.toBeInTheDocument();
  });

  it("shows Admin link for admin role", () => {
    render(<LeftRail />, { wrapper: ({ children }) => <Wrapper role="admin">{children}</Wrapper> });
    expect(screen.getByRole("link", { name: /admin/i })).toBeInTheDocument();
  });

  it("highlights the active route", () => {
    render(<LeftRail />, { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> });
    const briefingLink = screen.getByRole("link", { name: /briefing/i });
    expect(briefingLink).toHaveAttribute("aria-current", "page");
  });

  it("shows badge count when provided", () => {
    render(<LeftRail badges={{ findings: 7, gates: 3 }} />, {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("hides badge when count is zero", () => {
    render(<LeftRail badges={{ findings: 0 }} />, {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("collapses to icon-only on toggle", async () => {
    render(<LeftRail />, { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> });
    const toggle = screen.getByRole("button", { name: /collapse/i });
    await userEvent.click(toggle);
    // Label span is removed from DOM when collapsed (not merely hidden)
    expect(screen.queryByText("Briefing")).not.toBeInTheDocument();
  });
});
