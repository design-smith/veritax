import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopBar } from "../top-bar";
import { PermissionsProvider } from "@/contexts/permissions-context";
import { FYLensProvider } from "@/contexts/fy-lens-context";

vi.mock("next/navigation", () => ({
  usePathname: () => "/briefing",
  useRouter: () => ({ push: vi.fn() }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <PermissionsProvider role="manager">
      <FYLensProvider>{children}</FYLensProvider>
    </PermissionsProvider>
  );
}

describe("TopBar", () => {
  it("renders the FY lens selector with current FY", () => {
    render(<TopBar />, { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> });
    const currentFY = `FY${new Date().getFullYear()}`;
    expect(screen.getByText(currentFY)).toBeInTheDocument();
  });

  it("renders the Ask/⌘K button", () => {
    render(<TopBar />, { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> });
    expect(screen.getByRole("button", { name: /ask/i })).toBeInTheDocument();
  });

  it("renders the notifications bell", () => {
    render(<TopBar />, { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> });
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
  });

  it("shows pending-gates chip with count when gateCount > 0", () => {
    render(<TopBar gateCount={5} />, {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });
    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gates/i })).toBeInTheDocument();
  });

  it("hides pending-gates chip when gateCount is 0", () => {
    render(<TopBar gateCount={0} />, {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });
    expect(screen.queryByRole("button", { name: /gates/i })).not.toBeInTheDocument();
  });

  it("renders user menu with avatar", () => {
    render(
      <TopBar
        user={{ name: "Marcus Webb", email: "m.webb@veritax.io", role: "manager", id: "u2" }}
      />,
      { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> }
    );
    expect(screen.getByText("MW")).toBeInTheDocument();
  });

  it("calls onAskOpen when Ask button is clicked", async () => {
    const onAskOpen = vi.fn();
    render(<TopBar onAskOpen={onAskOpen} />, {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });
    await userEvent.click(screen.getByRole("button", { name: /ask/i }));
    expect(onAskOpen).toHaveBeenCalledOnce();
  });
});
