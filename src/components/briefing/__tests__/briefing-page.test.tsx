import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("shows degraded sources in the neutral compact status area", () => {
    render(
      <Wrapper>
        <BriefingContent {...makeProps()} degradedSources={["SAP ERP", "Payroll System"]} />
      </Wrapper>,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/SAP ERP/)).toBeInTheDocument();
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

    expect(screen.getByText(/pending review/i)).toBeInTheDocument();
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
