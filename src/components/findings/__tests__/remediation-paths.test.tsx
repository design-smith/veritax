import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RemediationPaths } from "../remediation-paths";

const paths = [
  {
    id: "p1",
    title: "Adjust royalty rate to 12%",
    description: "Amend the ICA to cap the royalty rate at the upper quartile of the CUT range.",
    effortClass: "medium" as const,
    affectedObjects: ["UK Local File §4.2", "UK Tax Return 2024", "Master File §2.1"],
  },
  {
    id: "p2",
    title: "Commission new benchmark study",
    description: "Engage external firm to update CUT comparables and justify current rate.",
    effortClass: "high" as const,
    affectedObjects: ["Benchmark Study FY2024", "UK Local File §3.3"],
  },
  {
    id: "p3",
    title: "Request HMRC bilateral APA",
    description: "Initiate advance pricing agreement to lock in rate prospectively.",
    effortClass: "high" as const,
    affectedObjects: ["HMRC Submission", "UK Tax Return 2024", "Master File §5"],
    requiresExternal: true,
  },
];

describe("RemediationPaths", () => {
  it("renders 1 to 3 path cards with titles", () => {
    render(<RemediationPaths paths={paths} onSelectPath={vi.fn()} />);
    expect(screen.getByText("Adjust royalty rate to 12%")).toBeInTheDocument();
    expect(screen.getByText("Commission new benchmark study")).toBeInTheDocument();
    expect(screen.getByText("Request HMRC bilateral APA")).toBeInTheDocument();
  });

  it("shows effort class chip on each card", () => {
    render(<RemediationPaths paths={paths} onSelectPath={vi.fn()} />);
    expect(screen.getByText("medium")).toBeInTheDocument();
    expect(screen.getAllByText("high")).toHaveLength(2);
  });

  it("shows downstream affected objects as chips", () => {
    render(<RemediationPaths paths={paths} onSelectPath={vi.fn()} />);
    expect(screen.getByText("UK Local File §4.2")).toBeInTheDocument();
    expect(screen.getAllByText("UK Tax Return 2024").length).toBeGreaterThan(0);
  });

  it("calls onSelectPath with path id when Select path clicked", async () => {
    const onSelectPath = vi.fn();
    render(<RemediationPaths paths={paths} onSelectPath={onSelectPath} />);
    const buttons = screen.getAllByRole("button", { name: /select path/i });
    await userEvent.click(buttons[0]);
    expect(onSelectPath).toHaveBeenCalledWith("p1");
  });

  it("shows Requires external label on external paths", () => {
    render(<RemediationPaths paths={paths} onSelectPath={vi.fn()} />);
    expect(screen.getByText(/requires external/i)).toBeInTheDocument();
  });
});
