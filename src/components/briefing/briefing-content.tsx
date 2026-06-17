"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  CheckCircle,
  ChevronDown,
  ExternalLink,
  Mail,
  MessageSquare,
  Package,
  Play,
  Rocket,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNow,
  parseISO,
} from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Commitment,
  Event,
  EventType,
  GateRequest,
  Obligation,
  User,
} from "@/lib/mock/types";
import { BoardPackAction } from "./board-pack-action";

interface BriefingContentProps {
  events: Event[];
  gates: GateRequest[];
  obligations: Obligation[];
  commitments: Commitment[];
  requesterMap: Record<string, User>;
  degradedSources?: string[];
  onAcknowledge: (eventId: string) => void;
  onOpen: (objectRef: string) => void;
  onApprove: (gateId: string) => void;
  onRequestChanges: (gateId: string, comment: string) => void;
  onReject: (gateId: string, reason: string) => void;
  onDelegate: (gateId: string, userId: string, expiresAt: string) => void;
  onApproveRun: (commitmentId: string) => void;
  onDismissCommitment: (commitmentId: string) => void;
  onNavigateObligation: (href: string) => void;
  onBoardPack: () => void;
  className?: string;
}

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type TodoSectionKey = "events" | "obligations" | "commitments";

type WorkItem =
  | {
      id: string;
      kind: "obligation";
      due: string;
      days: number;
      obligation: Obligation;
    }
  | {
      id: string;
      kind: "commitment";
      due: string;
      days: number;
      commitment: Commitment;
    };

const EVENT_META: Record<
  EventType,
  {
    label: string;
    variant: "default" | "secondary" | "success" | "outline";
  }
> = {
  finding_created: { label: "Finding", variant: "secondary" },
  finding_resolved: { label: "Resolved", variant: "success" },
  run_completed: { label: "Run", variant: "secondary" },
  gate_requested: { label: "Gate", variant: "outline" },
  document_ingested: { label: "Document", variant: "secondary" },
  staleness_detected: { label: "Stale", variant: "outline" },
  obligation_due: { label: "Obligation", variant: "outline" },
};

const PLAN_STATE_LABELS: Record<Commitment["planState"], string> = {
  pending: "Plan pending",
  approved: "Ready to run",
  dismissed: "Dismissed",
  completed: "Completed",
  external: "External",
};

const SOURCE_ICONS = {
  meeting: MessageSquare,
  email: Mail,
};

const SUGGESTED_PROMPTS = [
  "What changed since I was here?",
  "What needs my attention first?",
  "Which deadlines are at risk?",
  "What decisions are pending?",
];

function daysUntil(due: string): number {
  return differenceInCalendarDays(parseISO(due), new Date());
}

function dueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d late`;
  if (days === 0) return "Due today";
  return `${days}d`;
}

function dueBadgeClass(days: number): string {
  if (days < 0) return "border-border bg-muted text-foreground";
  if (days <= 7) return "border-border bg-primary/10 text-primary";
  return "border-border bg-background text-muted-foreground";
}

function gateDeadline(gate: GateRequest): Date {
  return new Date(parseISO(gate.slaStarted).getTime() + gate.slaHours * 3_600_000);
}

function hoursRemaining(gate: GateRequest): number {
  return Math.max(0, Math.ceil((gateDeadline(gate).getTime() - Date.now()) / 3_600_000));
}

function requesterFor(gate: GateRequest, requesterMap: Record<string, User>): User {
  return requesterMap[gate.requesterId] ?? {
    id: gate.requesterId,
    name: "Unknown",
    email: "",
    role: "analyst",
  };
}

function statusTextForGate(gate?: GateRequest): string {
  if (!gate) return "No gates pending";
  const hours = hoursRemaining(gate);
  return hours === 0 ? "Due now" : `${hours}h left`;
}

function sortEvents(events: Event[]): Event[] {
  return [...events].sort(
    (a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime(),
  );
}

function sortGates(gates: GateRequest[]): GateRequest[] {
  return [...gates].sort((a, b) => gateDeadline(a).getTime() - gateDeadline(b).getTime());
}

function sortObligations(obligations: Obligation[]): Obligation[] {
  return [...obligations].sort((a, b) => daysUntil(a.due) - daysUntil(b.due));
}

function buildWorkItems(obligations: Obligation[], commitments: Commitment[]): WorkItem[] {
  const obligationItems: WorkItem[] = obligations.map((obligation) => ({
    id: obligation.id,
    kind: "obligation",
    due: obligation.due,
    days: daysUntil(obligation.due),
    obligation,
  }));

  const commitmentItems: WorkItem[] = commitments
    .filter((commitment) => !["completed", "dismissed"].includes(commitment.planState))
    .map((commitment) => ({
      id: commitment.id,
      kind: "commitment",
      due: commitment.due,
      days: daysUntil(commitment.due),
      commitment,
    }));

  return [...obligationItems, ...commitmentItems].sort((a, b) => a.days - b.days);
}

function compactList(items: string[], empty: string): string {
  if (items.length === 0) return empty;
  return items.slice(0, 3).join(" ");
}

function buildOpeningBrief({
  events,
  gates,
  obligations,
  commitments,
  degradedSources,
}: {
  events: Event[];
  gates: GateRequest[];
  obligations: Obligation[];
  commitments: Commitment[];
  degradedSources?: string[];
}): string {
  const findings = events.filter((event) => event.type === "finding_created").length;
  const nextObligation = sortObligations(obligations)[0];
  const activeCommitments = commitments.filter(
    (commitment) => !["completed", "dismissed"].includes(commitment.planState),
  ).length;
  const sourceText =
    degradedSources && degradedSources.length > 0
      ? `${degradedSources.length} source${degradedSources.length === 1 ? " needs" : "s need"} review`
      : "sources look current";

  return [
    `Here is the current brief. The record has ${events.length} update${events.length === 1 ? "" : "s"} since your last visit, including ${findings} finding${findings === 1 ? "" : "s"}.`,
    `${gates.length} gate${gates.length === 1 ? "" : "s"} are pending, ${activeCommitments} commitment${activeCommitments === 1 ? "" : "s"} are active, and ${sourceText}.`,
    nextObligation
      ? `The next obligation is ${nextObligation.name} for ${nextObligation.jurisdiction}, ${dueLabel(daysUntil(nextObligation.due)).toLowerCase()}.`
      : "There are no upcoming obligations in this brief.",
  ].join(" ");
}

function answerBriefingQuestion({
  question,
  events,
  gates,
  obligations,
  commitments,
  requesterMap,
  degradedSources,
}: {
  question: string;
  events: Event[];
  gates: GateRequest[];
  obligations: Obligation[];
  commitments: Commitment[];
  requesterMap: Record<string, User>;
  degradedSources?: string[];
}): string {
  const query = question.toLowerCase();
  const sortedEvents = sortEvents(events);
  const sortedGates = sortGates(gates);
  const sortedObligations = sortObligations(obligations);
  const activeCommitments = commitments.filter(
    (commitment) => !["completed", "dismissed"].includes(commitment.planState),
  );

  if (query.includes("changed") || query.includes("since")) {
    return compactList(
      sortedEvents.map((event) => {
        const age = formatDistanceToNow(parseISO(event.timestamp), { addSuffix: true });
        return `${EVENT_META[event.type].label}: ${event.description} (${age}).`;
      }),
      "Nothing changed in the record since your last visit.",
    );
  }

  if (query.includes("attention") || query.includes("first") || query.includes("priority")) {
    const gate = sortedGates[0];
    const overdueObligation = sortedObligations.find((obligation) => daysUntil(obligation.due) < 0);
    const executableCommitment = activeCommitments.find(
      (commitment) => commitment.planState === "approved",
    );

    if (gate) {
      const requester = requesterFor(gate, requesterMap);
      return `${gate.objectName} should come first. It is a ${gate.objectType} gate requested by ${requester.name}, and the SLA is ${statusTextForGate(gate).toLowerCase()}.`;
    }

    if (overdueObligation) {
      return `${overdueObligation.name} should come first. It is ${dueLabel(daysUntil(overdueObligation.due)).toLowerCase()} for ${overdueObligation.jurisdiction}.`;
    }

    if (executableCommitment) {
      return `${executableCommitment.text} is ready to run. Review the plan in the to-do rail before approving it.`;
    }

    return "No item is currently blocking review. Start with the newest record changes if you want to clear the brief.";
  }

  if (query.includes("deadline") || query.includes("due") || query.includes("risk")) {
    return compactList(
      sortedObligations.map((obligation) => {
        const days = daysUntil(obligation.due);
        return `${obligation.name} is ${dueLabel(days).toLowerCase()} for ${obligation.jurisdiction}.`;
      }),
      "No obligation deadlines are currently loaded in this brief.",
    );
  }

  if (query.includes("decision") || query.includes("gate") || query.includes("pending")) {
    return compactList(
      sortedGates.map((gate) => {
        const requester = requesterFor(gate, requesterMap);
        return `${gate.objectName} is pending review, requested by ${requester.name}, ${statusTextForGate(gate).toLowerCase()}.`;
      }),
      "No gates are pending. The board pack can move toward review once the remaining to-do items are clear.",
    );
  }

  if (query.includes("source") || query.includes("stale") || query.includes("degraded")) {
    if (degradedSources && degradedSources.length > 0) {
      return `The sources to check are ${degradedSources.join(", ")}. The brief keeps them visible so you can decide whether a citation or finding needs a fresh run.`;
    }

    return "Sources look current in this brief. No degraded connectors are blocking review.";
  }

  return [
    `The brief is tracking ${events.length} record update${events.length === 1 ? "" : "s"}, ${gates.length} pending gate${gates.length === 1 ? "" : "s"}, ${obligations.length} obligation${obligations.length === 1 ? "" : "s"}, and ${activeCommitments.length} active commitment${activeCommitments.length === 1 ? "" : "s"}.`,
    "Ask what changed, what needs attention first, which deadlines are at risk, or what decisions are pending.",
  ].join(" ");
}

function PanelShell({
  title,
  children,
  className,
  headerSlot,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  headerSlot?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {headerSlot}
      </div>
      {children}
    </section>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      data-metric-tile={label}
      className="rounded-lg border border-border bg-card px-2 py-1.5 text-foreground sm:px-3 sm:py-2"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-base font-semibold leading-none sm:text-lg">{value}</p>
        <p className="hidden truncate text-xs text-muted-foreground min-[480px]:block">{detail}</p>
      </div>
    </div>
  );
}

function SourcesTile({ degradedSources }: { degradedSources?: string[] }) {
  const degradedCount = degradedSources?.length ?? 0;

  return (
    <div
      data-metric-tile="Sources"
      role={degradedCount > 0 ? "alert" : undefined}
      className="rounded-lg border border-border bg-card px-2 py-1.5 text-foreground sm:px-3 sm:py-2"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground">Sources</p>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-base font-semibold leading-none sm:text-lg">
          {degradedCount > 0 ? degradedCount : "OK"}
        </p>
        <p className="hidden truncate text-xs text-muted-foreground min-[480px]:block">
          {degradedCount > 0 ? degradedSources?.join(", ") : "current record"}
        </p>
      </div>
    </div>
  );
}

function CommandStrip({
  visibleEvents,
  visibleGates,
  obligations,
  commitments,
  degradedSources,
  children,
}: {
  visibleEvents: Event[];
  visibleGates: GateRequest[];
  obligations: Obligation[];
  commitments: Commitment[];
  degradedSources?: string[];
  children: React.ReactNode;
}) {
  const findingCount = visibleEvents.filter((event) => event.type === "finding_created").length;
  const nextObligation = sortObligations(obligations)[0];
  const activeCommitments = commitments.filter(
    (commitment) => !["completed", "dismissed"].includes(commitment.planState),
  );
  const urgentGate = visibleGates[0];

  return (
    <div className="grid shrink-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <StatusTile
          icon={Bell}
          label="Deltas"
          value={String(visibleEvents.length)}
          detail={findingCount > 0 ? `${findingCount} findings` : "record quiet"}
        />
        <StatusTile
          icon={ShieldCheck}
          label="Pending gates"
          value={String(visibleGates.length)}
          detail={statusTextForGate(urgentGate)}
        />
        <StatusTile
          icon={CalendarDays}
          label="Next obligation"
          value={nextObligation ? dueLabel(daysUntil(nextObligation.due)) : "Clear"}
          detail={nextObligation?.jurisdiction ?? "no deadlines"}
        />
        <StatusTile
          icon={CheckCircle}
          label="Commitments"
          value={String(activeCommitments.length)}
          detail="active plans"
        />
        <SourcesTile degradedSources={degradedSources} />
      </div>

      <div className="flex flex-col items-stretch gap-2 rounded-lg border border-border bg-card px-3 py-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between xl:w-[310px]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Board pack</p>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {visibleGates.length > 0 ? `${visibleGates.length} gates before export` : "ready for review"}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

function BriefingChatPanel({
  events,
  gates,
  obligations,
  commitments,
  requesterMap,
  degradedSources,
}: {
  events: Event[];
  gates: GateRequest[];
  obligations: Obligation[];
  commitments: Commitment[];
  requesterMap: Record<string, User>;
  degradedSources?: string[];
}) {
  const openingMessage = useMemo(
    () =>
      buildOpeningBrief({
        events,
        gates,
        obligations,
        commitments,
        degradedSources,
      }),
    [commitments, degradedSources, events, gates, obligations],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "opening",
      role: "assistant",
      content: openingMessage,
    },
  ]);
  const [draft, setDraft] = useState("");

  function submitQuestion(question: string) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    const answer = answerBriefingQuestion({
      question: trimmedQuestion,
      events,
      gates,
      obligations,
      commitments,
      requesterMap,
      degradedSources,
    });
    const stamp = Date.now();

    setMessages((current) => [
      ...current,
      {
        id: `user-${stamp}`,
        role: "user",
        content: trimmedQuestion,
      },
      {
        id: `assistant-${stamp}`,
        role: "assistant",
        content: answer,
      },
    ]);
    setDraft("");
  }

  return (
    <PanelShell
      title="Ask this brief"
      className="min-h-0"
      headerSlot={
        <Badge variant="outline" className="gap-1 text-[10px]">
          <MessageSquare className="h-3 w-3" />
          Briefing chat
        </Badge>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[88%] rounded-lg border px-3 py-2 text-sm leading-relaxed",
                  message.role === "assistant"
                    ? "self-start border-border bg-background text-foreground"
                    : "self-end border-primary/20 bg-primary text-primary-foreground",
                )}
              >
                {message.content}
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-card p-3">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => submitQuestion(prompt)}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                {prompt}
              </button>
            ))}
          </div>

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              submitQuestion(draft);
            }}
          >
            <label className="sr-only" htmlFor="briefing-chat-input">
              Ask this brief
            </label>
            <textarea
              id="briefing-chat-input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              placeholder="Ask what changed, what needs review, or what is due next."
              className="min-h-11 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            <Button type="submit" size="icon" aria-label="Send briefing question">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </PanelShell>
  );
}

function TodoRail({
  events,
  obligations,
  commitments,
  workItems,
  onAcknowledge,
  onOpen,
  onNavigateObligation,
  onApproveRun,
  onDismissCommitment,
}: {
  events: Event[];
  obligations: Obligation[];
  commitments: Commitment[];
  workItems: WorkItem[];
  onAcknowledge: (eventId: string) => void;
  onOpen: (objectRef: string) => void;
  onNavigateObligation: (href: string) => void;
  onApproveRun: (commitmentId: string) => void;
  onDismissCommitment: (commitmentId: string) => void;
}) {
  const [openSections, setOpenSections] = useState<Record<TodoSectionKey, boolean>>({
    events: true,
    obligations: false,
    commitments: false,
  });
  const obligationItems = workItems.filter(
    (item): item is Extract<WorkItem, { kind: "obligation" }> => item.kind === "obligation",
  );
  const commitmentItems = workItems.filter(
    (item): item is Extract<WorkItem, { kind: "commitment" }> => item.kind === "commitment",
  );

  function toggleSection(section: TodoSectionKey) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  return (
    <PanelShell
      title="To-do list"
      className="min-h-0"
      headerSlot={
        <Badge variant="outline" className="text-[10px]">
          {events.length + obligationItems.length + commitmentItems.length} items
        </Badge>
      }
    >
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <TodoSection
          id="since-you-were-here"
          label="Since you were here"
          count={events.length}
          open={openSections.events}
          onToggle={() => toggleSection("events")}
        >
          {events.length === 0 ? (
            <RailEmpty text="No new record changes." />
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <EventTodoRow
                  key={event.id}
                  event={event}
                  onAcknowledge={onAcknowledge}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          )}
        </TodoSection>

        <TodoSection
          id="obligations"
          label="Obligations"
          count={obligations.length}
          open={openSections.obligations}
          onToggle={() => toggleSection("obligations")}
        >
          {obligationItems.length === 0 ? (
            <RailEmpty text="No obligation work is queued." />
          ) : (
            <ul className="space-y-2">
              {obligationItems.map((item) => (
                <ObligationRow
                  key={item.id}
                  item={item}
                  onNavigateObligation={onNavigateObligation}
                />
              ))}
            </ul>
          )}
        </TodoSection>

        <TodoSection
          id="commitments"
          label="Commitments"
          count={commitments.filter((commitment) => !["completed", "dismissed"].includes(commitment.planState)).length}
          open={openSections.commitments}
          onToggle={() => toggleSection("commitments")}
        >
          {commitmentItems.length === 0 ? (
            <RailEmpty text="No commitments need action." />
          ) : (
            <ul className="space-y-2">
              {commitmentItems.map((item) => (
                <CommitmentRow
                  key={item.id}
                  item={item}
                  onApproveRun={onApproveRun}
                  onDismissCommitment={onDismissCommitment}
                />
              ))}
            </ul>
          )}
        </TodoSection>
      </div>
    </PanelShell>
  );
}

function TodoSection({
  id,
  label,
  count,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <span className="flex min-w-0 items-center gap-2">
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                !open && "-rotate-90",
              )}
            />
            <span className="truncate">{label}</span>
          </span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {count}
          </Badge>
        </button>
      </h3>
      <div
        id={`${id}-panel`}
        role="region"
        aria-label={label}
        hidden={!open}
        className="pb-2"
      >
        {children}
      </div>
    </section>
  );
}

function EventTodoRow({
  event,
  onAcknowledge,
  onOpen,
}: {
  event: Event;
  onAcknowledge: (eventId: string) => void;
  onOpen: (objectRef: string) => void;
}) {
  const meta = EVENT_META[event.type];

  return (
    <li className="rounded-md border border-border bg-background p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={meta.variant} className="text-[10px]">
          {meta.label}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(parseISO(event.timestamp), { addSuffix: true })}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-foreground">
        {event.description}
      </p>
      <div className="mt-2 flex items-center justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => onOpen(event.objectRef)}
          aria-label={`Open ${event.description}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => onAcknowledge(event.id)}
          aria-label={`Acknowledge ${event.description}`}
        >
          <Check className="h-3.5 w-3.5" />
          Ack
        </Button>
      </div>
    </li>
  );
}

function ObligationRow({
  item,
  onNavigateObligation,
}: {
  item: Extract<WorkItem, { kind: "obligation" }>;
  onNavigateObligation: (href: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onNavigateObligation(`/calendar?obligation=${item.obligation.id}`)}
        className="flex w-full items-start justify-between gap-3 rounded-md border border-border bg-background p-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <Badge variant="outline" className="text-[10px]">
              Obligation
            </Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
            {item.obligation.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.obligation.jurisdiction} due {format(parseISO(item.due), "MMM d")}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium",
            dueBadgeClass(item.days),
          )}
        >
          {dueLabel(item.days)}
        </span>
      </button>
    </li>
  );
}

function CommitmentRow({
  item,
  onApproveRun,
  onDismissCommitment,
}: {
  item: Extract<WorkItem, { kind: "commitment" }>;
  onApproveRun: (commitmentId: string) => void;
  onDismissCommitment: (commitmentId: string) => void;
}) {
  const commitment = item.commitment;
  const SourceIcon = SOURCE_ICONS[commitment.source];
  const isExecutable = commitment.planState === "approved";
  const isPending = commitment.planState === "pending";
  const isExternal = commitment.planState === "external";

  return (
    <li className="rounded-md border border-border bg-background p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="gap-1 text-[10px] capitalize">
              <SourceIcon className="h-3 w-3" />
              {commitment.source}
            </Badge>
            <Badge variant={isExecutable ? "success" : "outline"} className="text-[10px]">
              {PLAN_STATE_LABELS[commitment.planState]}
            </Badge>
            <span
              className={cn(
                "rounded-md border px-2 py-0.5 text-xs font-medium",
                dueBadgeClass(item.days),
              )}
            >
              {dueLabel(item.days)}
            </span>
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug">
            {commitment.text}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Due {format(parseISO(item.due), "MMM d")}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap justify-end gap-1.5">
        {isExecutable && (
          <Button
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onApproveRun(commitment.id)}
          >
            <Play className="h-3.5 w-3.5" />
            Approve & run
          </Button>
        )}
        {isPending && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
            Review plan
          </Button>
        )}
        {isExternal && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled>
            External
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => onDismissCommitment(commitment.id)}
        >
          Dismiss
        </Button>
      </div>
    </li>
  );
}

function RailEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background/60 px-3 py-4 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function ColdStartState({ onGetStarted }: { onGetStarted?: () => void }) {
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Rocket className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">Get started with Veritax</p>
          <p className="text-sm text-muted-foreground">
            Connect your data sources to surface findings, obligations, and commitments here.
          </p>
        </div>
        <Button onClick={onGetStarted}>Connect first source</Button>
      </div>
    </div>
  );
}

export function BriefingContent({
  events,
  gates,
  obligations,
  commitments,
  requesterMap,
  degradedSources,
  onAcknowledge,
  onOpen,
  onApproveRun,
  onDismissCommitment,
  onNavigateObligation,
  onBoardPack,
  className,
}: BriefingContentProps) {
  const isColdStart =
    events.length === 0 &&
    gates.length === 0 &&
    obligations.length === 0 &&
    commitments.length === 0;

  const [dismissedEvents, setDismissedEvents] = useState<Set<string>>(new Set());
  const [dismissedCommitments, setDismissedCommitments] = useState<Set<string>>(new Set());
  const [boardPackRunRef, setBoardPackRunRef] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);

  const visibleEvents = useMemo(
    () => sortEvents(events.filter((event) => !dismissedEvents.has(event.id))),
    [dismissedEvents, events],
  );

  const visibleGates = useMemo(() => sortGates(gates), [gates]);

  const visibleCommitments = useMemo(
    () => commitments.filter((commitment) => !dismissedCommitments.has(commitment.id)),
    [commitments, dismissedCommitments],
  );

  const workItems = useMemo(
    () => buildWorkItems(obligations, visibleCommitments),
    [obligations, visibleCommitments],
  );

  function handleBoardPack() {
    setIsGenerating(true);
    setBoardPackRunRef("/runs/r-board-pack");
    onBoardPack();
  }

  function handleAcknowledge(eventId: string) {
    setDismissedEvents((prev) => new Set([...prev, eventId]));
    onAcknowledge(eventId);
  }

  function handleApproveRun(commitmentId: string) {
    setDismissedCommitments((prev) => new Set([...prev, commitmentId]));
    onApproveRun(commitmentId);
  }

  function handleDismissCommitment(commitmentId: string) {
    setDismissedCommitments((prev) => new Set([...prev, commitmentId]));
    onDismissCommitment(commitmentId);
  }

  if (isColdStart) {
    return (
      <ColdStartState
        onGetStarted={() => {
          if (typeof window !== "undefined") window.location.href = "/onboarding";
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden bg-background p-3 sm:p-4 lg:p-5",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <CommandStrip
          visibleEvents={visibleEvents}
          visibleGates={visibleGates}
          obligations={obligations}
          commitments={visibleCommitments}
          degradedSources={degradedSources}
        >
          <BoardPackAction
            onRequestPlan={handleBoardPack}
            isGenerating={isGenerating}
            runRef={boardPackRunRef}
          />
        </CommandStrip>

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(220px,0.72fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)] lg:grid-rows-[minmax(0,1fr)]">
          <BriefingChatPanel
            events={visibleEvents}
            gates={visibleGates}
            obligations={obligations}
            commitments={visibleCommitments}
            requesterMap={requesterMap}
            degradedSources={degradedSources}
          />

          <TodoRail
            events={visibleEvents}
            obligations={obligations}
            commitments={visibleCommitments}
            workItems={workItems}
            onAcknowledge={handleAcknowledge}
            onOpen={onOpen}
            onNavigateObligation={onNavigateObligation}
            onApproveRun={handleApproveRun}
            onDismissCommitment={handleDismissCommitment}
          />
        </div>
      </div>
    </div>
  );
}
