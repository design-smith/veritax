import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AskOverlay } from "../ask-overlay";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("AskOverlay", () => {
  it("renders when open is true", () => {
    render(<AskOverlay open onClose={vi.fn()} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(<AskOverlay open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", async () => {
    const onClose = vi.fn();
    render(<AskOverlay open onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows 'ask' mode badge by default", () => {
    render(<AskOverlay open onClose={vi.fn()} />);
    expect(screen.getByText("ask")).toBeInTheDocument();
  });

  it("switches to 'run' mode badge when > prefix typed", async () => {
    render(<AskOverlay open onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox"), "> ic-scan");
    expect(screen.getByText("run")).toBeInTheDocument();
  });

  it("switches to 'goto' mode badge when @ prefix typed", async () => {
    render(<AskOverlay open onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole("textbox"), "@uk");
    expect(screen.getByText("goto")).toBeInTheDocument();
  });

  it("renders a placeholder that describes all modes", () => {
    render(<AskOverlay open onClose={vi.fn()} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("placeholder");
    expect(input.getAttribute("placeholder")).toMatch(/ask|search|run/i);
  });

  it("accepts an initial query prop and pre-fills the input", () => {
    render(<AskOverlay open onClose={vi.fn()} initialQuery="royalty rate" />);
    expect(screen.getByRole("textbox")).toHaveValue("royalty rate");
  });
});
