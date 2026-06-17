import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAnchorNavigation } from "../anchor-navigation";
import { SpanHighlight } from "../span-highlight";

// Hook wrapper
function AnchorNav({ anchors }: { anchors: string[] }) {
  const { activeAnchorId, activeIndex, total, goNext, goPrev } = useAnchorNavigation(anchors);
  return (
    <div>
      <span data-testid="active">{activeAnchorId ?? "none"}</span>
      <span data-testid="index">{activeIndex + 1}</span>
      <span data-testid="total">{total}</span>
      <button onClick={goPrev} aria-label="Previous anchor">prev</button>
      <button onClick={goNext} aria-label="Next anchor">next</button>
    </div>
  );
}

describe("useAnchorNavigation", () => {
  const anchors = ["span-1", "span-2", "span-3"];

  it("starts at the first anchor", () => {
    render(<AnchorNav anchors={anchors} />);
    expect(screen.getByTestId("active")).toHaveTextContent("span-1");
    expect(screen.getByTestId("index")).toHaveTextContent("1");
    expect(screen.getByTestId("total")).toHaveTextContent("3");
  });

  it("advances to the next anchor on n/goNext", async () => {
    render(<AnchorNav anchors={anchors} />);
    await userEvent.click(screen.getByRole("button", { name: /next anchor/i }));
    expect(screen.getByTestId("active")).toHaveTextContent("span-2");
  });

  it("goes back to the previous anchor on p/goPrev", async () => {
    render(<AnchorNav anchors={anchors} />);
    await userEvent.click(screen.getByRole("button", { name: /next anchor/i }));
    await userEvent.click(screen.getByRole("button", { name: /previous anchor/i }));
    expect(screen.getByTestId("active")).toHaveTextContent("span-1");
  });

  it("wraps from last to first when going next", async () => {
    render(<AnchorNav anchors={anchors} />);
    // Jump to last
    await userEvent.click(screen.getByRole("button", { name: /next anchor/i }));
    await userEvent.click(screen.getByRole("button", { name: /next anchor/i }));
    // Now at span-3, next should wrap to span-1
    await userEvent.click(screen.getByRole("button", { name: /next anchor/i }));
    expect(screen.getByTestId("active")).toHaveTextContent("span-1");
  });

  it("returns none when anchors list is empty", () => {
    render(<AnchorNav anchors={[]} />);
    expect(screen.getByTestId("active")).toHaveTextContent("none");
    expect(screen.getByTestId("total")).toHaveTextContent("0");
  });
});

describe("SpanHighlight", () => {
  const reverseCitations = [
    { findingId: "fn1", findingTitle: "UK royalty rate exceeds benchmark" },
    { findingId: "fn2", findingTitle: "France royalty rate breach" },
  ];

  it("renders the span text with highlight class when isActive", () => {
    render(
      <SpanHighlight
        spanId="s1"
        text="The royalty rate applied is 18%"
        isActive
        reverseCitations={[]}
      />
    );
    const el = screen.getByTestId("span-s1");
    expect(el).toHaveClass("highlighted");
    expect(el).toHaveTextContent("The royalty rate applied is 18%");
  });

  it("does not apply highlighted class when not active", () => {
    render(
      <SpanHighlight
        spanId="s1"
        text="Some text"
        isActive={false}
        reverseCitations={[]}
      />
    );
    expect(screen.getByTestId("span-s1")).not.toHaveClass("highlighted");
  });

  it("shows reverse-citation popover on hover listing citing findings", async () => {
    render(
      <SpanHighlight
        spanId="s1"
        text="The royalty rate applied is 18%"
        isActive
        reverseCitations={reverseCitations}
      />
    );
    await userEvent.hover(screen.getByTestId("span-s1"));
    expect(await screen.findByText("UK royalty rate exceeds benchmark")).toBeInTheDocument();
    expect(screen.getByText("France royalty rate breach")).toBeInTheDocument();
  });
});
