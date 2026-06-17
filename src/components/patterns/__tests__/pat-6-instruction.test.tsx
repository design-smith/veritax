import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstructionInput } from "../pat-6-instruction";

describe("InstructionInput", () => {
  it("shows tier badge that updates as the user types", async () => {
    render(<InstructionInput onSubmit={vi.fn()} />);
    const textarea = screen.getByRole("textbox");

    // Default: style tier (short, formatting instruction)
    await userEvent.type(textarea, "Use bullet points");
    expect(screen.getByText(/style/i)).toBeInTheDocument();
  });

  it("classifies as run-tier for execution instructions", async () => {
    render(<InstructionInput onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox"), "Re-run the scan against all flows");
    expect(screen.getByText("run")).toBeInTheDocument();
  });

  it("classifies as methodology-tier for rate/policy instructions", async () => {
    render(<InstructionInput onSubmit={vi.fn()} />);
    await userEvent.type(
      screen.getByRole("textbox"),
      "Change the benchmark methodology to TNMM"
    );
    expect(screen.getByText("methodology")).toBeInTheDocument();
  });

  it("shows permission consequence line describing the tier outcome", async () => {
    render(<InstructionInput onSubmit={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox"), "Re-run the scan");
    expect(screen.getByText(/requires run/i)).toBeInTheDocument();
  });

  it("calls onSubmit with text and tier when submitted", async () => {
    const onSubmit = vi.fn();
    render(<InstructionInput onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole("textbox"), "Use bullet points");
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Use bullet points", tier: "style" })
    );
  });

  it("shows conflict warning when text matches an existing instruction", async () => {
    render(
      <InstructionInput
        onSubmit={vi.fn()}
        existingInstructions={["Always use bullet points for lists"]}
      />
    );
    await userEvent.type(screen.getByRole("textbox"), "Use bullet points");
    expect(await screen.findByText(/conflict/i)).toBeInTheDocument();
  });
});
