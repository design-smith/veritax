import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FindingsList } from "../findings-list";
import { mockFindings } from "@/lib/mock";

const openFindings = mockFindings.filter(
  (f) => f.status !== "resolved" && f.status !== "verify-next-cycle"
);

describe("FindingsList", () => {
  it("renders table with severity, ID, title, status columns", () => {
    render(<FindingsList findings={mockFindings} onRowOpen={vi.fn()} />);
    expect(screen.getByText("Severity")).toBeInTheDocument();
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders all findings as rows", () => {
    render(<FindingsList findings={mockFindings} onRowOpen={vi.fn()} />);
    mockFindings.forEach((f) => {
      expect(screen.getByText(f.id)).toBeInTheDocument();
    });
  });

  it("default sort order is severity descending (critical first)", () => {
    render(<FindingsList findings={mockFindings} onRowOpen={vi.fn()} />);
    const cells = screen.getAllByTestId("cell-severity");
    expect(cells[0]).toHaveTextContent("critical");
  });

  it("shows rollup header with open count", () => {
    render(<FindingsList findings={openFindings} onRowOpen={vi.fn()} />);
    expect(screen.getByTestId("rollup-open-count")).toHaveTextContent(
      String(openFindings.length)
    );
  });

  it("shows total exposure in rollup header", () => {
    const totalExposure = openFindings.reduce((sum, f) => sum + f.exposure, 0);
    render(<FindingsList findings={openFindings} onRowOpen={vi.fn()} />);
    expect(screen.getByTestId("rollup-exposure")).toBeInTheDocument();
    // Should be formatted with commas
    expect(screen.getByTestId("rollup-exposure").textContent).toMatch(/,/);
  });

  it("calls onRowOpen when a row is clicked", async () => {
    const onRowOpen = vi.fn();
    const { getAllByRole } = render(
      <FindingsList findings={[mockFindings[0]]} onRowOpen={onRowOpen} />
    );
    // Click on the finding ID cell to open
    const cells = screen.getAllByText(mockFindings[0].id);
    cells[0].click();
    expect(onRowOpen).toHaveBeenCalledWith(mockFindings[0]);
  });
});
