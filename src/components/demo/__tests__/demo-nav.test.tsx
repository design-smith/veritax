import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DemoNav } from "../demo-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/demo/briefing",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const DEMO_PAGES = [
  { label: "Briefing", href: "/demo/briefing" },
  { label: "Graph", href: "/demo/graph" },
  { label: "Findings", href: "/demo/findings" },
  { label: "Library", href: "/demo/library" },
  { label: "Gathering", href: "/demo/gathering" },
];

describe("DemoNav", () => {
  it("renders the five Friday demo links with correct /demo/* hrefs", () => {
    render(<DemoNav />);
    for (const { label, href } of DEMO_PAGES) {
      const link = screen.getByRole("link", { name: new RegExp(label, "i") });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", href);
    }
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("marks the active route with aria-current=page", () => {
    render(<DemoNav />);
    // pathname mocked to /demo/briefing
    expect(screen.getByRole("link", { name: /briefing/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /graph/i })).not.toHaveAttribute("aria-current");
  });
});
