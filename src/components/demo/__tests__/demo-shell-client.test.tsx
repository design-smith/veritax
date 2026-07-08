import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DemoShellClient } from "../demo-shell-client";

// TopBar has heavy context deps (FYLens, AppFrame) — already tested in its own suite
vi.mock("@/components/shell/top-bar", () => ({
  TopBar: () => <header data-testid="top-bar" />,
}));

// AskRecord renders a plain div, not a Radix dialog — stub so we can assert open state
vi.mock("@/components/ask/ask-record", () => ({
  AskRecord: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" data-testid="ask-overlay" /> : null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/demo/briefing",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("DemoShellClient", () => {
  it("renders children in the main content area", () => {
    render(
      <DemoShellClient>
        <p>Demo content</p>
      </DemoShellClient>,
    );
    expect(screen.getByText("Demo content")).toBeInTheDocument();
  });

  it("opens the Ask overlay on Ctrl+K", async () => {
    const user = userEvent.setup();
    render(
      <DemoShellClient>
        <p>page</p>
      </DemoShellClient>,
    );

    // Overlay should not be visible initially
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.keyboard("{Control>}k{/Control}");

    // Ask overlay dialog should appear
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
