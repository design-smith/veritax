import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  clearRecordedFrontendTelemetryEvents,
  getRecordedFrontendTelemetryEvents,
} from "@/lib/telemetry/product-telemetry";
import { StaleBadge, StalenessProposalSheet, SurfaceStalenessBar } from "../pat-3-staleness";

afterEach(() => {
  clearRecordedFrontendTelemetryEvents();
});

describe("StaleBadge", () => {
  it("renders a stale label and what-changed link", () => {
    render(<StaleBadge whatChanged="Source sync changed 3 fields" onViewDiff={vi.fn()} />);
    expect(screen.getByText(/stale/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /what changed/i })).toBeInTheDocument();
  });

  it("calls onViewDiff when the diff link is clicked", async () => {
    const onViewDiff = vi.fn();
    render(<StaleBadge whatChanged="3 fields changed" onViewDiff={onViewDiff} />);
    await userEvent.click(screen.getByRole("button", { name: /what changed/i }));
    expect(onViewDiff).toHaveBeenCalledOnce();
  });
});

describe("SurfaceStalenessBar", () => {
  it("shows affected artifact count and review proposals button", () => {
    render(<SurfaceStalenessBar count={3} onReview={vi.fn()} />);
    expect(screen.getByText(/3 artifacts/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review proposals/i })).toBeInTheDocument();
  });

  it("does not render when count is 0", () => {
    const { container } = render(<SurfaceStalenessBar count={0} onReview={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("StalenessProposalSheet", () => {
  const targets = [
    { id: "t1", name: "UK Local File §4.2", changeDescription: "Royalty rate source updated" },
    { id: "t2", name: "Master File §2.1", changeDescription: "Entity profile changed" },
  ];

  it("lists all targets with accept and skip actions", () => {
    render(
      <StalenessProposalSheet
        open
        targets={targets}
        onAccept={vi.fn()}
        onSkip={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("UK Local File §4.2")).toBeInTheDocument();
    expect(screen.getByText("Master File §2.1")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /accept/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /skip/i })).toHaveLength(2);
  });

  it("calls onAccept with the target id when accept clicked", async () => {
    const onAccept = vi.fn();
    render(
      <StalenessProposalSheet
        open
        targets={targets}
        onAccept={onAccept}
        onSkip={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const acceptButtons = screen.getAllByRole("button", { name: /accept/i });
    await userEvent.click(acceptButtons[0]);
    expect(onAccept).toHaveBeenCalledWith("t1");
  });

  it("never auto-rebuilds — no automatic action on render", () => {
    const onAccept = vi.fn();
    render(
      <StalenessProposalSheet
        open
        targets={targets}
        onAccept={onAccept}
        onSkip={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(onAccept).not.toHaveBeenCalled();
  });

  it("records rebuild proposal decisions for accept and skip actions", async () => {
    const decisions: string[] = [];
    render(
      <StalenessProposalSheet
        open
        targets={targets}
        onAccept={(id) => decisions.push(`accepted:${id}`)}
        onSkip={(id) => decisions.push(`skipped:${id}`)}
        onClose={() => undefined}
      />
    );

    await userEvent.click(screen.getAllByRole("button", { name: /accept/i })[0]);
    await userEvent.click(screen.getAllByRole("button", { name: /skip/i })[1]);

    expect(decisions).toEqual(["accepted:t1", "skipped:t2"]);
    expect(getRecordedFrontendTelemetryEvents().map((event) => event.metadata.decision)).toEqual([
      "accepted",
      "skipped",
    ]);
    expect(JSON.stringify(getRecordedFrontendTelemetryEvents())).not.toContain("UK Local File");
    expect(JSON.stringify(getRecordedFrontendTelemetryEvents())).not.toContain("Entity profile");
  });
});
