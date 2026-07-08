import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { TopBar } from "../top-bar";
import { AppFrameProvider, createDefaultAppFrameState } from "@/contexts/app-frame-context";
import { FYLensProvider, useFYLens } from "@/contexts/fy-lens-context";
import { PermissionsProvider } from "@/contexts/permissions-context";

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <PermissionsProvider role="manager">
      <FYLensProvider>
        <AppFrameProvider initialState={createDefaultAppFrameState()}>{children}</AppFrameProvider>
      </FYLensProvider>
    </PermissionsProvider>
  );
}

function PastFYControl() {
  const { setFY } = useFYLens();
  return <button onClick={() => setFY("FY2023")}>View sealed FY</button>;
}

describe("TopBar app frame controls", () => {
  it("switches workspace and subgroup from the shell selector", async () => {
    const user = userEvent.setup();
    render(<TopBar />, { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> });

    expect(screen.getByRole("button", { name: /workspace: veritax group/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /workspace: veritax group/i }));
    await user.click(screen.getByRole("menuitem", { name: /emea transfer pricing/i }));
    expect(screen.getByRole("button", { name: /workspace: emea transfer pricing/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /workspace: emea transfer pricing/i }));
    await user.click(screen.getByRole("menuitem", { name: /france local file/i }));
    expect(screen.getByRole("button", { name: /subgroup: france local file/i })).toBeInTheDocument();
  });

  it("opens Digest Center and marks notifications read", async () => {
    const user = userEvent.setup();
    render(<TopBar />, { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> });

    expect(screen.getByRole("button", { name: /notifications, 4 unread/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /notifications, 4 unread/i }));
    const digest = screen.getByRole("dialog", { name: /digest center/i });
    expect(within(digest).getByText("15 findings ready for review")).toBeInTheDocument();
    expect(within(digest).getByText("Finding alerts: immediate")).toBeInTheDocument();

    await user.click(within(digest).getByRole("button", { name: /mark all read/i }));
    expect(within(digest).getByText("All digest items read")).toBeInTheDocument();
    await user.click(within(digest).getByRole("button", { name: /close/i }));
    expect(screen.getByRole("button", { name: /notifications, none unread/i })).toBeInTheDocument();
  });

  it("opens Gate Queue and completing a gate advances the count", async () => {
    const user = userEvent.setup();
    render(<TopBar />, { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> });

    expect(screen.getByRole("button", { name: /3 pending gates/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /3 pending gates/i }));
    const queue = screen.getByRole("dialog", { name: /gate queue/i });
    expect(within(queue).getByText("Veritax UK Local File FY2024 v2")).toBeInTheDocument();

    await user.click(within(queue).getByRole("button", { name: /approve veritax uk local file/i }));
    expect(within(queue).queryByText("Veritax UK Local File FY2024 v2")).not.toBeInTheDocument();
    await user.click(within(queue).getByRole("button", { name: /close/i }));
    expect(screen.getByRole("button", { name: /2 pending gates/i })).toBeInTheDocument();
  });

  it("disables gate actions when the selected FY is sealed", async () => {
    const user = userEvent.setup();
    render(
      <>
        <PastFYControl />
        <TopBar />
      </>,
      { wrapper: ({ children }) => <Wrapper>{children}</Wrapper> },
    );

    await user.click(screen.getByRole("button", { name: "View sealed FY" }));
    await user.click(screen.getByRole("button", { name: /3 pending gates/i }));

    const queue = screen.getByRole("dialog", { name: /gate queue/i });
    expect(within(queue).getByRole("button", { name: /approve veritax uk local file/i })).toBeDisabled();
    expect(within(queue).getAllByTitle("FY2023 is sealed. Open the current FY to act.").length).toBeGreaterThan(0);
  });
});
