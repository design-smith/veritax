import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineDirectiveCanvas } from "../inline-directive-canvas";

const sectionContent =
  "The royalty rate applied to Veritax UK Ltd is 18%, above the arm's length range.";

describe("InlineDirectiveCanvas", () => {
  it("renders the section content", () => {
    render(
      <InlineDirectiveCanvas
        sectionId="s1"
        content={sectionContent}
        onInstruct={vi.fn()}
      />
    );
    expect(screen.getByText(/royalty rate applied/)).toBeInTheDocument();
  });

  it("shows the Instruct button when text is selected", async () => {
    render(
      <InlineDirectiveCanvas
        sectionId="s1"
        content={sectionContent}
        onInstruct={vi.fn()}
      />
    );
    // Simulate text selection via the Select action button (since JSDOM doesn't support real selection)
    const selectBtn = screen.getByRole("button", { name: /select text/i });
    await userEvent.click(selectBtn);
    expect(screen.getByRole("button", { name: /instruct/i })).toBeInTheDocument();
  });

  it("hides the Instruct button when no text is selected", () => {
    render(
      <InlineDirectiveCanvas
        sectionId="s1"
        content={sectionContent}
        onInstruct={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /instruct/i })).not.toBeInTheDocument();
  });

  it("calls onInstruct with sectionId and selected text when instruction submitted", async () => {
    const onInstruct = vi.fn();
    render(
      <InlineDirectiveCanvas
        sectionId="s1"
        content={sectionContent}
        onInstruct={onInstruct}
      />
    );
    // Step 1: simulate text selection
    await userEvent.click(screen.getByRole("button", { name: /select text/i }));
    // Step 2: open the instruction input
    await userEvent.click(screen.getByRole("button", { name: /instruct/i }));
    // Step 3: type and submit the instruction
    await userEvent.type(screen.getByRole("textbox"), "Adjust to reflect 12% policy rate");
    await userEvent.click(screen.getByRole("button", { name: /submit instruction/i }));
    expect(onInstruct).toHaveBeenCalledWith("s1", expect.any(String));
  });

  it("shows pending-self-check indicator when status is pending-self-check", () => {
    render(
      <InlineDirectiveCanvas
        sectionId="s1"
        content={sectionContent}
        status="pending-self-check"
        onInstruct={vi.fn()}
      />
    );
    expect(screen.getByTestId("self-check-indicator")).toHaveClass("pending");
  });

  it("shows pass indicator when status is self-check-pass", () => {
    render(
      <InlineDirectiveCanvas
        sectionId="s1"
        content={sectionContent}
        status="self-check-pass"
        onInstruct={vi.fn()}
      />
    );
    expect(screen.getByTestId("self-check-indicator")).toHaveClass("pass");
  });

  it("shows fail indicator and Open conflict link when status is self-check-fail", () => {
    render(
      <InlineDirectiveCanvas
        sectionId="s1"
        content={sectionContent}
        status="self-check-fail"
        conflictRef="/findings/fn1"
        onInstruct={vi.fn()}
      />
    );
    expect(screen.getByTestId("self-check-indicator")).toHaveClass("fail");
    expect(screen.getByRole("link", { name: /open conflict/i })).toHaveAttribute("href", "/findings/fn1");
  });
});
