import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useViewerPageState } from "../viewer-page-state";
import { ViewerHeader } from "../viewer-header";
import { mockDocuments } from "@/lib/mock";

// Hook under test via a thin wrapper
function PageControls({ total }: { total: number }) {
  const { page, totalPages, goNext, goPrev } = useViewerPageState(total);
  return (
    <div>
      <span data-testid="page">{page}</span>
      <span data-testid="total">{totalPages}</span>
      <button onClick={goPrev} aria-label="Previous page">prev</button>
      <button onClick={goNext} aria-label="Next page">next</button>
    </div>
  );
}

describe("useViewerPageState", () => {
  it("starts on page 1", () => {
    render(<PageControls total={10} />);
    expect(screen.getByTestId("page")).toHaveTextContent("1");
    expect(screen.getByTestId("total")).toHaveTextContent("10");
  });

  it("advances to the next page", async () => {
    render(<PageControls total={10} />);
    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(screen.getByTestId("page")).toHaveTextContent("2");
  });

  it("does not advance past the last page", async () => {
    render(<PageControls total={3} />);
    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    await userEvent.click(screen.getByRole("button", { name: /next page/i }));
    await userEvent.click(screen.getByRole("button", { name: /next page/i })); // should stop at 3
    expect(screen.getByTestId("page")).toHaveTextContent("3");
  });

  it("does not go below page 1", async () => {
    render(<PageControls total={5} />);
    await userEvent.click(screen.getByRole("button", { name: /previous page/i }));
    expect(screen.getByTestId("page")).toHaveTextContent("1");
  });
});

describe("ViewerHeader", () => {
  const doc = mockDocuments[0]; // master file, sensitive

  it("renders document name", () => {
    render(<ViewerHeader document={doc} onBack={vi.fn()} />);
    expect(screen.getByText(doc.name)).toBeInTheDocument();
  });

  it("renders custody badge", () => {
    render(<ViewerHeader document={doc} onBack={vi.fn()} />);
    expect(screen.getByText(doc.custody)).toBeInTheDocument();
  });

  it("renders sensitivity chip for non-standard sensitivity", () => {
    render(<ViewerHeader document={doc} onBack={vi.fn()} />);
    expect(screen.getByText(doc.sensitivity)).toBeInTheDocument();
  });

  it("renders truncated hash", () => {
    render(<ViewerHeader document={doc} onBack={vi.fn()} />);
    // Hash is "sha256:a1b2c3d4" — should show partial
    expect(screen.getByText(/sha256/i)).toBeInTheDocument();
  });

  it("renders Return to origin breadcrumb when originLabel provided", () => {
    render(<ViewerHeader document={doc} onBack={vi.fn()} originLabel="Finding fn1" />);
    expect(screen.getByRole("button", { name: /finding fn1/i })).toBeInTheDocument();
  });

  it("calls onBack when Return to button clicked", async () => {
    const onBack = vi.fn();
    render(<ViewerHeader document={doc} onBack={onBack} originLabel="Finding fn1" />);
    await userEvent.click(screen.getByRole("button", { name: /finding fn1/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
