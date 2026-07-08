import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LibraryWorkspace } from "@/components/library/library-workspace";
import { mockDocuments, mockEntities, mockFlows } from "@/lib/mock";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/demo/library",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("demo library page", () => {
  it("renders the library list with all corpus documents", () => {
    render(
      <LibraryWorkspace
        documents={mockDocuments}
        entities={mockEntities}
        flows={mockFlows}
      />,
    );

    // 9 documents in mockDocuments — check a few key ones
    expect(screen.getByText(/Veritax Group Master File FY2024/)).toBeInTheDocument();
    expect(screen.getByText(/Veritax UK Local File FY2024/)).toBeInTheDocument();
    expect(screen.getByText(/CUT Benchmark Study/)).toBeInTheDocument();
  });
});
