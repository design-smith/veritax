import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BenchmarkPageContent } from "../benchmark-page-content";

describe("BenchmarkPageContent", () => {
  it("routes screening criteria edits through a manager gate", async () => {
    const user = userEvent.setup();

    render(<BenchmarkPageContent />);

    await user.click(screen.getByRole("button", { name: /revenue/i }));
    await user.click(screen.getByRole("button", { name: /edit criteria/i }));
    await user.clear(screen.getByLabelText(/criteria text/i));
    await user.type(screen.getByLabelText(/criteria text/i), "Revenue $75M-$5B across three years");
    await user.click(screen.getByRole("button", { name: /submit criteria proposal/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/criteria proposal routed to manager gate/i);
    expect(screen.getByText(/methodology-tier change/i)).toBeInTheDocument();
  });

  it("updates comparable decisions and runs range actions from page state", async () => {
    const user = userEvent.setup();

    render(<BenchmarkPageContent />);

    await user.click(screen.getByRole("tab", { name: /comparable set/i }));
    const acmeRow = screen.getByRole("row", { name: /acme software/i });
    await user.click(within(acmeRow).getByRole("button", { name: /reject/i }));
    expect(within(acmeRow).getByText(/rejected/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /range panel/i }));
    await user.selectOptions(screen.getByRole("combobox", { name: /pli/i }), "TNMM - operating margin");
    await user.click(screen.getByRole("switch", { name: /weighted average/i }));
    await user.click(screen.getByRole("button", { name: /refresh from license/i }));
    await user.click(screen.getByRole("button", { name: /re-test tested party/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/re-test plan created/i);
    expect(screen.getByText(/license refresh produced a diff sheet/i)).toBeInTheDocument();
  });

  it("itemizes benchmark refresh differences and requires manager accept before the set changes", async () => {
    const user = userEvent.setup();

    render(<BenchmarkPageContent />);

    await user.click(screen.getByRole("tab", { name: /range panel/i }));
    await user.click(screen.getByRole("button", { name: /refresh from license/i }));

    const diffGate = screen.getByRole("region", { name: /refresh diff gate/i });
    expect(within(diffGate).getByText(/Orion Licensing PLC/i)).toBeInTheDocument();
    expect(within(diffGate).getByText(/Gamma Systems Ltd/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /comparable set/i }));
    expect(screen.queryByText(/Orion Licensing PLC/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /range panel/i }));
    const visibleDiffGate = screen.getByRole("region", { name: /refresh diff gate/i });
    await user.click(within(visibleDiffGate).getByRole("button", { name: /accept refresh diff/i }));
    await user.click(screen.getByRole("tab", { name: /comparable set/i }));

    expect(screen.getByText(/Orion Licensing PLC/i)).toBeInTheDocument();
    expect(screen.queryByText(/Gamma Systems Ltd/i)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/benchmark refresh accepted/i);
  });
});
