import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertPolicyEditor } from "../alert-policy-editor";

const policies = [
  { id: "findings", category: "Findings", cadence: "realtime" as const, threshold: 1, lastQuarterCount: 12 },
  { id: "runs",     category: "Runs",     cadence: "daily" as const,    threshold: 5, lastQuarterCount: 47 },
  { id: "obligations", category: "Obligations", cadence: "weekly" as const, threshold: 1, lastQuarterCount: 3 },
];

describe("AlertPolicyEditor", () => {
  it("renders all categories", () => {
    render(<AlertPolicyEditor policies={policies} onChange={vi.fn()} />);
    expect(screen.getByText("Findings")).toBeInTheDocument();
    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getByText("Obligations")).toBeInTheDocument();
  });

  it("renders cadence selector for each category", () => {
    render(<AlertPolicyEditor policies={policies} onChange={vi.fn()} />);
    expect(screen.getAllByRole("combobox").length).toBe(policies.length);
  });

  it("shows preview text for each policy", () => {
    render(<AlertPolicyEditor policies={policies} onChange={vi.fn()} />);
    // text is split across elements — check by finding a container that includes both
    const containers = screen.getAllByText(/last quarter/i).map((el) => el.closest("div")!);
    const findingsContainer = containers.find((c) => c?.textContent?.includes("12"));
    expect(findingsContainer).toBeTruthy();
  });

  it("calls onChange with updated cadence when selector changes", async () => {
    const onChange = vi.fn();
    render(<AlertPolicyEditor policies={policies} onChange={onChange} />);
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0], "daily");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "findings", cadence: "daily" })
    );
  });

  it("renders threshold input for each category", () => {
    render(<AlertPolicyEditor policies={policies} onChange={vi.fn()} />);
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs.length).toBe(policies.length);
  });

  it("calls onChange with updated threshold when threshold changes", () => {
    const onChange = vi.fn();
    render(<AlertPolicyEditor policies={policies} onChange={onChange} />);
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[1], { target: { value: "10" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "runs", threshold: 10 })
    );
  });
});
