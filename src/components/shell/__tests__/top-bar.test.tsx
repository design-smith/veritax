import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { TopBar } from "../top-bar";
import { AppFrameProvider, createDefaultAppFrameState } from "@/contexts/app-frame-context";
import { PermissionsProvider } from "@/contexts/permissions-context";
import { FYLensProvider } from "@/contexts/fy-lens-context";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <PermissionsProvider role="manager">
      <FYLensProvider>
        <AppFrameProvider initialState={createDefaultAppFrameState()}>{children}</AppFrameProvider>
      </FYLensProvider>
    </PermissionsProvider>
  );
}

function AskHarness() {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <TopBar onAskOpen={() => setOpened(true)} />
      {opened && <p>Ask opened</p>}
    </>
  );
}

describe("TopBar", () => {
  it("renders the FY lens selector with current FY", () => {
    render(<TopBar />, { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> });
    const currentFY = `FY${new Date().getFullYear()}`;
    expect(screen.getByText(currentFY)).toBeInTheDocument();
  });

  it("renders the Ask button", () => {
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
      { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> },
    );
    expect(screen.getByText("MW")).toBeInTheDocument();
  });

  it("opens Ask through a real state transition when Ask is clicked", async () => {
    const user = userEvent.setup();
    render(<AskHarness />, {
      wrapper: ({ children }) => <Wrapper>{children}</Wrapper>,
    });
    await user.click(screen.getByRole("button", { name: /ask/i }));
    expect(screen.getByText("Ask opened")).toBeInTheDocument();
  });
});
