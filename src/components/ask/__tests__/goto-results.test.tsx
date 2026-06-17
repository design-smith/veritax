import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoToResults } from "../goto-results";
import { mockEntities, mockFindings } from "@/lib/mock";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const results = {
  entities: mockEntities.slice(0, 2),
  flows: [],
  findings: mockFindings.slice(0, 2),
  documents: [],
  runs: [],
};

describe("GoToResults", () => {
  it("renders section headings for non-empty groups", () => {
    render(<GoToResults results={results} onNavigate={vi.fn()} />);
    expect(screen.getByText(/entities/i)).toBeInTheDocument();
    expect(screen.getByText(/findings/i)).toBeInTheDocument();
  });

  it("does not render section headings for empty groups", () => {
    render(<GoToResults results={results} onNavigate={vi.fn()} />);
    expect(screen.queryByText(/^flows$/i)).not.toBeInTheDocument();
  });

  it("renders entity names as clickable results", () => {
    render(<GoToResults results={results} onNavigate={vi.fn()} />);
    expect(screen.getByText(results.entities[0].name)).toBeInTheDocument();
    expect(screen.getByText(results.entities[1].name)).toBeInTheDocument();
  });

  it("calls onNavigate with entity href when entity clicked", async () => {
    const onNavigate = vi.fn();
    render(<GoToResults results={results} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByText(results.entities[0].name));
    expect(onNavigate).toHaveBeenCalledWith(`/graph/entities/${results.entities[0].id}`);
  });

  it("calls onNavigate with finding href when finding clicked", async () => {
    const onNavigate = vi.fn();
    render(<GoToResults results={results} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByText(results.findings[0].id));
    expect(onNavigate).toHaveBeenCalledWith(`/findings/${results.findings[0].id}`);
  });

  it("shows 'Nothing found' when all groups are empty", () => {
    const empty = { entities: [], flows: [], findings: [], documents: [], runs: [] };
    render(<GoToResults results={empty} onNavigate={vi.fn()} />);
    expect(screen.getByText(/nothing found/i)).toBeInTheDocument();
  });
});
