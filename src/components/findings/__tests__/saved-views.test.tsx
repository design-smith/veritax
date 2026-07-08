import { afterEach, describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  clearRecordedFrontendTelemetryEvents,
  getRecordedFrontendTelemetryEvents,
} from "@/lib/telemetry/product-telemetry";
import { SavedViewsBar, useSavedViews } from "../saved-views";

// Stub localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/findings",
  useSearchParams: () => new URLSearchParams("view=open"),
}));

describe("SavedViewsBar", () => {
  beforeEach(() => localStorageMock.clear());
  afterEach(() => {
    clearRecordedFrontendTelemetryEvents();
  });

  it("renders the default Open view as active", () => {
    render(
      <SavedViewsBar
        currentViewId="open"
        views={[
          { id: "open", label: "Open", filters: { status: "open" } },
          { id: "triage", label: "Candidates", filters: { triage: true } },
        ]}
        onSwitchView={vi.fn()}
        onSaveView={vi.fn()}
      />
    );
    const openBtn = screen.getByRole("button", { name: /^open$/i });
    expect(openBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onSwitchView when a different view is clicked", async () => {
    const onSwitchView = vi.fn();
    render(
      <SavedViewsBar
        currentViewId="open"
        views={[
          { id: "open", label: "Open", filters: {} },
          { id: "all", label: "All findings", filters: {} },
        ]}
        onSwitchView={onSwitchView}
        onSaveView={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /all findings/i }));
    expect(onSwitchView).toHaveBeenCalledWith("all");
  });

  it("opens save-view dialog when Save view clicked", async () => {
    render(
      <SavedViewsBar
        currentViewId="open"
        views={[{ id: "open", label: "Open", filters: {} }]}
        onSwitchView={vi.fn()}
        onSaveView={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /save view/i }));
    expect(screen.getByPlaceholderText(/view name/i)).toBeInTheDocument();
  });

  it("calls onSaveView with name and filters when form submitted", async () => {
    const onSaveView = vi.fn();
    render(
      <SavedViewsBar
        currentViewId="open"
        views={[{ id: "open", label: "Open", filters: {} }]}
        onSwitchView={vi.fn()}
        onSaveView={onSaveView}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /save view/i }));
    await userEvent.type(screen.getByPlaceholderText(/view name/i), "My custom view");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onSaveView).toHaveBeenCalledWith(
      expect.objectContaining({ label: "My custom view" })
    );
  });

  it("records saved-view adoption telemetry without the view label", async () => {
    const savedViews: unknown[] = [];
    render(
      <SavedViewsBar
        currentViewId="open"
        views={[{ id: "open", label: "Open", filters: { status: "open", severity: "high" } }]}
        onSwitchView={() => undefined}
        onSaveView={(view) => savedViews.push(view)}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /save view/i }));
    await userEvent.type(screen.getByPlaceholderText(/view name/i), "High-risk open findings");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(savedViews).toHaveLength(1);
    expect(getRecordedFrontendTelemetryEvents()).toMatchObject([
      {
        name: "adoption.saved_view_created",
        surface: "findings",
        metadata: { filterCount: 2 },
      },
    ]);
    expect(JSON.stringify(getRecordedFrontendTelemetryEvents())).not.toContain("High-risk open findings");
  });
});
