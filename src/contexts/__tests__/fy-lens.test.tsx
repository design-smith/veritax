import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FYLensProvider, useFYLens, PastFYBanner, SealedMutationGuard } from "../fy-lens-context";

function LensDisplay() {
  const { fy, isPast } = useFYLens();
  return (
    <div>
      <span data-testid="fy">{fy}</span>
      <span data-testid="is-past">{String(isPast)}</span>
    </div>
  );
}

function LensChanger() {
  const { fy, setFY } = useFYLens();
  return (
    <div>
      <span data-testid="fy">{fy}</span>
      <button onClick={() => setFY("FY2023")}>Go to FY2023</button>
    </div>
  );
}

function PeriodChanger() {
  const { period, setPeriod } = useFYLens();
  return (
    <div>
      <span data-testid="period">{period ?? "Full year"}</span>
      <button onClick={() => setPeriod("Q2")}>Set Q2</button>
    </div>
  );
}

describe("useFYLens", () => {
  it("defaults to current FY", () => {
    const currentFY = `FY${new Date().getFullYear()}`;
    render(
      <FYLensProvider>
        <LensDisplay />
      </FYLensProvider>
    );
    expect(screen.getByTestId("fy")).toHaveTextContent(currentFY);
    expect(screen.getByTestId("is-past")).toHaveTextContent("false");
  });

  it("marks lens as past when FY is set to a previous year", async () => {
    render(
      <FYLensProvider>
        <LensChanger />
        <LensDisplay />
      </FYLensProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "Go to FY2023" }));
    expect(screen.getAllByTestId("fy")[0]).toHaveTextContent("FY2023");
    expect(screen.getByTestId("is-past")).toHaveTextContent("true");
  });

  it("stores the selected fiscal period in the global FY Lens", async () => {
    render(
      <FYLensProvider>
        <PeriodChanger />
      </FYLensProvider>
    );

    expect(screen.getByTestId("period")).toHaveTextContent("Full year");
    await userEvent.click(screen.getByRole("button", { name: "Set Q2" }));
    expect(screen.getByTestId("period")).toHaveTextContent("Q2");
  });
});

describe("PastFYBanner", () => {
  it("renders nothing when lens is current", () => {
    render(
      <FYLensProvider>
        <PastFYBanner />
      </FYLensProvider>
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the past-FY banner when lens is a past year", async () => {
    render(
      <FYLensProvider>
        <button onClick={() => {}}>change</button>
        <LensChanger />
        <PastFYBanner />
      </FYLensProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "Go to FY2023" }));
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(/FY2023/);
    expect(alert).toHaveTextContent(/records as filed/i);
  });

  it("mutation controls are announced as sealed in past FY context", async () => {
    render(
      <FYLensProvider>
        <LensChanger />
        <PastFYBanner />
      </FYLensProvider>
    );
    await userEvent.click(screen.getByRole("button", { name: "Go to FY2023" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/sealed/i);
  });
});

describe("SealedMutationGuard", () => {
  it("allows actions in the current FY and disables them in a sealed FY", async () => {
    const user = userEvent.setup();

    render(
      <FYLensProvider>
        <LensChanger />
        <SealedMutationGuard>
          <button type="button">Approve gate</button>
        </SealedMutationGuard>
      </FYLensProvider>,
    );

    expect(screen.getByRole("button", { name: "Approve gate" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Go to FY2023" }));

    expect(screen.getByRole("button", { name: "Approve gate" })).toBeDisabled();
    expect(screen.getByTitle("FY2023 is sealed. Open the current FY to act.")).toBeInTheDocument();
  });
});
