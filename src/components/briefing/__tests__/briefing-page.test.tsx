import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BriefingContent } from "../briefing-content";
import { PermissionsProvider } from "@/contexts/permissions-context";
import { FYLensProvider } from "@/contexts/fy-lens-context";
import {
  mockEvents,
  mockGateRequests,
  mockObligations,
  mockCommitments,
  mockUsers,
} from "@/lib/mock";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/briefing",
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function Wrapper({
  role = "manager",
  children,
}: {
  role?: "vp" | "manager" | "analyst" | "adjacent" | "admin";
  children: React.ReactNode;
}) {
  return (
    <PermissionsProvider role={role}>
      <FYLensProvider>{children}</FYLensProvider>
    </PermissionsProvider>
  );
}

const requesterMap = Object.fromEntries(mockUsers.map((u) => [u.id, u]));
type BriefingProps = ComponentProps<typeof BriefingContent>;

function makeProps() {
  return {
    events: mockEvents,
    gates: mockGateRequests,
    obligations: mockObligations,
    commitments: mockCommitments,
    requesterMap,
    onAcknowledge: vi.fn(),
    onOpen: vi.fn(),
    onApprove: vi.fn(),
    onRequestChanges: vi.fn(),
    onReject: vi.fn(),
    onDelegate: vi.fn(),
    onApproveRun: vi.fn(),
    onDismissCommitment: vi.fn(),
    onNavigateObligation: vi.fn(),
    onBoardPack: vi.fn(),
  };
}

function makeTrackedProps(
  overrides: Partial<BriefingProps> = {},
) {
  const calls = {
    acknowledged: [] as string[],
    opened: [] as string[],
    approved: [] as string[],
    changes: [] as Array<{ gateId: string; comment: string }>,
    rejected: [] as Array<{ gateId: string; reason: string }>,
    delegated: [] as Array<{ gateId: string; userId: string; expiresAt: string }>,
    approvedRuns: [] as string[],
    dismissedCommitments: [] as string[],
    obligationHrefs: [] as string[],
    boardPacks: 0,
  };

  const props: BriefingProps = {
    ...makeProps(),
    onAcknowledge: (eventId: string) => calls.acknowledged.push(eventId),
    onOpen: (objectRef: string) => calls.opened.push(objectRef),
    onApprove: (gateId: string) => calls.approved.push(gateId),
    onRequestChanges: (gateId: string, comment: string) =>
      calls.changes.push({ gateId, comment }),
    onReject: (gateId: string, reason: string) => calls.rejected.push({ gateId, reason }),
    onDelegate: (gateId: string, userId: string, expiresAt: string) =>
      calls.delegated.push({ gateId, userId, expiresAt }),
    onApproveRun: (commitmentId: string) => calls.approvedRuns.push(commitmentId),
    onDismissCommitment: (commitmentId: string) =>
      calls.dismissedCommitments.push(commitmentId),
    onNavigateObligation: (href: string) => calls.obligationHrefs.push(href),
    onBoardPack: () => {
      calls.boardPacks += 1;
    },
    ...overrides,
  };

  return { calls, props };
}

describe("BriefingContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the chat workspace and to-do rail", () => {
    render(
      <Wrapper>
        <BriefingContent {...makeProps()} />
      </Wrapper>,
    );

    expect(screen.getByRole("heading", { level: 2, name: /ask this brief/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /to-do list/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /since you were here/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: /obligations/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.getByRole("button", { name: /commitments/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("shows board pack action for VP role", () => {
    render(
      <Wrapper role="vp">
        <BriefingContent {...makeProps()} />
      </Wrapper>,
    );
    expect(screen.getByRole("button", { name: /generate board pack/i })).toBeInTheDocument();
  });

  it("hides board pack action for analyst role", () => {
    render(
      <Wrapper role="analyst">
        <BriefingContent {...makeProps()} />
      </Wrapper>,
    );
    expect(screen.queryByRole("button", { name: /generate board pack/i })).not.toBeInTheDocument();
  });

  it("shows onboarding cold-start state when no work is loaded", () => {
    render(
      <Wrapper>
        <BriefingContent
          {...makeProps()}
          events={[]}
          gates={[]}
          obligations={[]}
          commitments={[]}
        />
      </Wrapper>,
    );
    expect(screen.getByText(/get started/i)).toBeInTheDocument();
  });

  it("renders the cold-start onboarding journey instead of an empty report", () => {
    render(
      <Wrapper>
        <BriefingContent
          {...makeProps()}
          events={[]}
          gates={[]}
          obligations={[]}
          commitments={[]}
        />
      </Wrapper>,
    );

    expect(screen.getByText(/connect sources/i)).toBeInTheDocument();
    expect(screen.getByText(/run mirror/i)).toBeInTheDocument();
    expect(screen.getByText(/review findings/i)).toBeInTheDocument();
  });

  it("shows degraded sources in the neutral compact status area", () => {
    render(
      <Wrapper>
        <BriefingContent {...makeProps()} degradedSources={["SAP ERP", "Payroll System"]} />
      </Wrapper>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/SAP ERP/);
  });

  it("lists degraded sources in one consolidated briefing banner", () => {
    render(
      <Wrapper>
        <BriefingContent {...makeProps()} degradedSources={["SAP ERP", "Payroll System"]} />
      </Wrapper>,
    );

    const banner = screen.getByRole("alert", {
      name: /degraded sources affect this brief/i,
    });
    expect(banner).toHaveTextContent("SAP ERP");
    expect(banner).toHaveTextContent("Payroll System");
    expect(banner).toHaveTextContent(/Affected sections/i);
  });

  it("renders all top metrics with the same neutral tile treatment", () => {
    const { container } = render(
      <Wrapper>
        <BriefingContent {...makeProps()} degradedSources={["SAP ERP"]} />
      </Wrapper>,
    );

    const tiles = Array.from(container.querySelectorAll("[data-metric-tile]"));
    expect(tiles).toHaveLength(5);
    expect(tiles.map((tile) => tile.getAttribute("data-metric-tile"))).toEqual([
      "Deltas",
      "Pending gates",
      "Next obligation",
      "Commitments",
      "Sources",
    ]);
    for (const tile of tiles) {
      expect(tile.className).not.toMatch(/amber|destructive|red/);
      expect(tile.className).toMatch(/border-border/);
    }
  });

  it("renders suggested prompts and answers a submitted briefing question", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <BriefingContent {...makeProps()} />
      </Wrapper>,
    );

    expect(
      screen.getByRole("button", { name: /what changed since i was here/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /what needs my attention first/i }),
    ).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /ask this brief/i }), "What decisions are pending?");
    await user.click(screen.getByRole("button", { name: /send briefing question/i }));

    expect(screen.getAllByText(/pending review/i).length).toBeGreaterThan(0);
  });

  it("answers a suggested attention prompt from the current briefing data", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <BriefingContent {...makeProps()} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /what needs my attention first/i }));

    expect(screen.getByText(/should come first/i)).toBeInTheDocument();
  });

  it("keeps event Open and Ack actions in the to-do rail", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    const event = mockEvents[0];

    render(
      <Wrapper>
        <BriefingContent {...props} />
      </Wrapper>,
    );

    expect(screen.getByText(event.description)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `Open ${event.description}` }));
    expect(props.onOpen).toHaveBeenCalledWith(event.objectRef);

    await user.click(screen.getByRole("button", { name: `Acknowledge ${event.description}` }));
    expect(props.onAcknowledge).toHaveBeenCalledWith(event.id);
    expect(screen.queryByText(event.description)).not.toBeInTheDocument();
  });

  it("keeps pending gate decisions actionable inside the expanded to-do rail", async () => {
    const user = userEvent.setup();
    const gate = mockGateRequests[0];
    const { calls, props } = makeTrackedProps({
      events: [],
      gates: [gate],
      obligations: [],
      commitments: [],
    });

    render(
      <Wrapper>
        <BriefingContent {...props} />
      </Wrapper>,
    );

    expect(screen.getByRole("button", { name: /since you were here/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByText(gate.objectName)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /approve & promote/i }));

    expect(calls.approved).toEqual([gate.id]);
    expect(screen.queryByText(gate.objectName)).not.toBeInTheDocument();
  });

  it("can request changes on a gate without navigating away from the brief", async () => {
    const user = userEvent.setup();
    const gate = mockGateRequests[1];
    const { calls, props } = makeTrackedProps({
      events: [],
      gates: [gate],
      obligations: [],
      commitments: [],
    });

    render(
      <Wrapper>
        <BriefingContent {...props} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /request changes/i }));
    await user.type(screen.getByRole("textbox", { name: /comment/i }), "Please add the missing citation.");
    await user.click(screen.getByRole("button", { name: /^send$/i }));

    expect(calls.changes).toEqual([
      {
        gateId: gate.id,
        comment: "Please add the missing citation.",
      },
    ]);
    expect(screen.queryByText(gate.objectName)).not.toBeInTheDocument();
  });

  it("runs the board-pack plan and announces the Documents handoff", async () => {
    const user = userEvent.setup();
    const { calls, props } = makeTrackedProps({ gates: [] });

    render(
      <Wrapper role="vp">
        <BriefingContent {...props} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /generate board pack/i }));

    expect(calls.boardPacks).toBe(1);
    expect(screen.getByRole("link", { name: /view run/i })).toHaveAttribute(
      "href",
      "/runs/r-board-pack",
    );
    expect(screen.getByRole("link", { name: /open board pack in documents/i })).toHaveAttribute(
      "href",
      "/documents?type=board-pack&run=r-board-pack",
    );
    expect(screen.getByText(/artifact lands in documents/i)).toBeInTheDocument();
  });

  it("expands obligations and keeps navigation actionable", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    const obligation = mockObligations[0];

    render(
      <Wrapper>
        <BriefingContent {...props} />
      </Wrapper>,
    );

    const obligationsTrigger = screen.getByRole("button", { name: /obligations/i });
    expect(obligationsTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(obligationsTrigger);
    expect(obligationsTrigger).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: new RegExp(obligation.name, "i") }));
    expect(props.onNavigateObligation).toHaveBeenCalledWith(`/calendar?obligation=${obligation.id}`);
  });

  it("expands commitments and keeps plan actions actionable", async () => {
    const user = userEvent.setup();
    const props = makeProps();

    render(
      <Wrapper>
        <BriefingContent {...props} />
      </Wrapper>,
    );

    const commitmentsTrigger = screen.getByRole("button", { name: /commitments/i });
    expect(commitmentsTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(commitmentsTrigger);
    expect(commitmentsTrigger).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: /approve & run/i }));
    expect(props.onApproveRun).toHaveBeenCalledWith("cm3");

    await user.click(screen.getAllByRole("button", { name: /dismiss/i })[0]);
    expect(props.onDismissCommitment).toHaveBeenCalled();
  });
});
