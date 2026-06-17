"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  CheckCircle,
  ChevronRight,
  ExternalLink,
  Mail,
  MessageSquare,
  Package,
  Play,
  Rocket,
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
import { GateCard } from "@/components/patterns/pat-5-gate-card";
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

type BriefingTab = "pulse" | "decisions" | "next";

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
    variant: "default" | "secondary" | "destructive" | "warning" | "success" | "outline";
  }
> = {
  finding_created: { label: "Finding", variant: "destructive" },
  finding_resolved: { label: "Resolved", variant: "success" },
  run_completed: { label: "Run", variant: "secondary" },
  gate_requested: { label: "Gate", variant: "warning" },
  document_ingested: { label: "Document", variant: "secondary" },
  staleness_detected: { label: "Stale", variant: "warning" },
  obligation_due: { label: "Obligation", variant: "destructive" },
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

function daysUntil(due: string): number {
  return differenceInCalendarDays(parseISO(due), new Date());
}

function dueLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d late`;
  if (days === 0) return "Due today";
  return `${days}d`;
}

function dueTone(days: number): string {
  if (days < 0) return "border-destructive/30 bg-destructive/10 text-destructive";
  if (days <= 7) return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200";
  if (days <= 30) return "border-primary/25 bg-primary/10 text-primary";
  return "border-border bg-muted text-muted-foreground";
}

function gateDeadline(gate: GateRequest): Date {
  return new Date(parseISO(gate.slaStarted).getTime() + gate.slaHours * 3_600_000);
}

function hoursRemaining(gate: GateRequest): number {
  return Math.max(0, Math.ceil((gateDeadline(gate).getTime() - Date.now()) / 3_600_000));
}

function gateProgress(gate: GateRequest): number {
  const remaining = hoursRemaining(gate);
  return Math.min(100, Math.max(0, ((gate.slaHours - remaining) / gate.slaHours) * 100));
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
        "min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {headerSlot}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </section>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "warning" | "danger" | "ready";
}) {
  const toneClass =
    tone === "danger"
      ? "border-destructive/25 bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        : tone === "ready"
          ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "border-border bg-card text-foreground";

  return (
    <div className={cn("rounded-lg border px-2 py-1.5 sm:px-3 sm:py-2", toneClass)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-base font-semibold leading-none sm:text-lg">{value}</p>
        <p className="hidden truncate text-xs text-muted-foreground min-[480px]:block">{detail}</p>
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
  const degradedCount = degradedSources?.length ?? 0;

  return (
    <div className="grid shrink-0 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <StatusTile
          icon={Bell}
          label="Deltas"
          value={String(visibleEvents.length)}
          detail={findingCount > 0 ? `${findingCount} findings` : "record quiet"}
          tone={findingCount > 0 ? "danger" : "ready"}
        />
        <StatusTile
          icon={ShieldCheck}
          label="Pending gates"
          value={String(visibleGates.length)}
          detail={statusTextForGate(urgentGate)}
          tone={visibleGates.length > 0 ? "warning" : "ready"}
        />
        <StatusTile
          icon={CalendarDays}
          label="Next obligation"
          value={nextObligation ? dueLabel(daysUntil(nextObligation.due)) : "Clear"}
          detail={nextObligation?.jurisdiction ?? "no deadlines"}
          tone={nextObligation && daysUntil(nextObligation.due) <= 7 ? "danger" : "neutral"}
        />
        <StatusTile
          icon={CheckCircle}
          label="Commitments"
          value={String(activeCommitments.length)}
          detail="active plans"
          tone={activeCommitments.length > 0 ? "neutral" : "ready"}
        />
        <div
          role={degradedCount > 0 ? "alert" : undefined}
          className={cn(
            "rounded-lg border px-2 py-1.5 sm:px-3 sm:py-2",
            degradedCount > 0
              ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
              : "border-border bg-card text-foreground",
          )}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
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
      </div>

      <div className="flex flex-col items-stretch gap-2 rounded-lg border border-border bg-card px-3 py-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between xl:w-[310px]">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
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

function MobileTabs({
  activeTab,
  onChange,
}: {
  activeTab: BriefingTab;
  onChange: (tab: BriefingTab) => void;
}) {
  const tabs: Array<{ id: BriefingTab; label: string }> = [
    { id: "pulse", label: "Pulse" },
    { id: "decisions", label: "Decisions" },
    { id: "next", label: "Next work" },
  ];

  return (
    <div className="grid shrink-0 grid-cols-3 rounded-lg border border-border bg-card p-1 md:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
            activeTab === tab.id && "bg-primary text-primary-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function DeltaPulsePanel({
  events,
  className,
  onAcknowledge,
  onOpen,
}: {
  events: Event[];
  className?: string;
  onAcknowledge: (eventId: string) => void;
  onOpen: (objectRef: string) => void;
}) {
  return (
    <PanelShell
      title="Since you were here"
      className={className}
      headerSlot={
        <Badge variant="outline" className="text-[10px]">
          {events.length} items
        </Badge>
      }
    >
      {events.length === 0 ? (
        <CompactEmpty
          icon={CheckCircle}
          title="All caught up"
          detail="No new changes since your last visit."
        />
      ) : (
        <ul className="space-y-2">
          {events.map((event) => {
            const meta = EVENT_META[event.type];

            return (
              <li
                key={event.id}
                className="rounded-md border border-border bg-background p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={meta.variant} className="text-[10px]">
                        {meta.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(parseISO(event.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm leading-snug text-foreground">
                      {event.description}
                    </p>
                  </div>
                </div>
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
          })}
        </ul>
      )}
    </PanelShell>
  );
}

function MobileActiveGateCard({
  gate,
  requester,
  onApprove,
  onRequestChanges,
  onReject,
}: {
  gate: GateRequest;
  requester: User;
  onApprove: () => void;
  onRequestChanges: (comment: string) => void;
  onReject: (reason: string) => void;
}) {
  const [mode, setMode] = useState<"idle" | "changes" | "reject">("idle");
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const hours = hoursRemaining(gate);

  return (
    <div className="rounded-md border border-primary/25 bg-background p-3 md:hidden">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="text-[10px]">
          Gate
        </Badge>
        <span className="text-xs text-muted-foreground">
          {hours === 0 ? "Due now" : `${hours}h left`}
        </span>
      </div>
      <h3 className="mt-2 text-base font-semibold leading-tight">{gate.objectName}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{gate.objectType} ready for review</p>
      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
        <p>
          Requested by <span className="font-medium text-foreground">{requester.name}</span>
        </p>
        <p>
          Escalation: <span className="font-medium text-foreground">{gate.escalationPath}</span>
        </p>
      </div>

      {mode === "changes" && (
        <div className="mt-3 space-y-2 rounded-md border border-border p-2">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="What needs to change?"
            rows={3}
            className="min-h-20 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!comment.trim()}
              onClick={() => {
                onRequestChanges(comment);
                setComment("");
                setMode("idle");
              }}
            >
              Send
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                setComment("");
                setMode("idle");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === "reject" && (
        <div className="mt-3 space-y-2 rounded-md border border-border p-2">
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="">Select a reason</option>
            <option value="Insufficient evidence">Insufficient evidence</option>
            <option value="Methodology not approved">Methodology not approved</option>
            <option value="Requires additional review">Requires additional review</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="destructive"
              className="h-8 text-xs"
              disabled={!reason}
              onClick={() => {
                onReject(reason);
                setReason("");
                setMode("idle");
              }}
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => {
                setReason("");
                setMode("idle");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-2">
        <Button size="sm" className="h-8 text-xs" onClick={onApprove}>
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="hidden min-[480px]:inline">Approve & promote</span>
          <span className="min-[480px]:hidden">Approve</span>
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => setMode(mode === "changes" ? "idle" : "changes")}
          >
            Changes
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs text-destructive hover:text-destructive"
            onClick={() => setMode(mode === "reject" ? "idle" : "reject")}
          >
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

function DecisionWorkbench({
  gates,
  activeGate,
  requesterMap,
  className,
  onActivate,
  onApprove,
  onRequestChanges,
  onReject,
  onDelegate,
}: {
  gates: GateRequest[];
  activeGate?: GateRequest;
  requesterMap: Record<string, User>;
  className?: string;
  onActivate: (gateId: string) => void;
  onApprove: (gateId: string) => void;
  onRequestChanges: (gateId: string, comment: string) => void;
  onReject: (gateId: string, reason: string) => void;
  onDelegate: (gateId: string, userId: string, expiresAt: string) => void;
}) {
  const queuedGates = gates.filter((gate) => gate.id !== activeGate?.id);

  return (
    <PanelShell
      title="Decision queue"
      className={className}
      headerSlot={
        <Badge variant={gates.length > 0 ? "warning" : "success"} className="text-[10px]">
          {gates.length} pending
        </Badge>
      }
    >
      {gates.length === 0 || !activeGate ? (
        <CompactEmpty
          icon={CheckCircle}
          title="No pending decisions"
          detail="All gates have been resolved."
        />
      ) : (
        <div className="flex min-h-full flex-col gap-3">
          <MobileActiveGateCard
            gate={activeGate}
            requester={requesterFor(activeGate, requesterMap)}
            onApprove={() => onApprove(activeGate.id)}
            onRequestChanges={(comment) => onRequestChanges(activeGate.id, comment)}
            onReject={(reason) => onReject(activeGate.id, reason)}
          />
          <GateCard
            gate={activeGate}
            objectSummary={`${activeGate.objectType} ready for review`}
            requester={requesterFor(activeGate, requesterMap)}
            onApprove={() => onApprove(activeGate.id)}
            onRequestChanges={(comment) => onRequestChanges(activeGate.id, comment)}
            onReject={(reason) => onReject(activeGate.id, reason)}
            onDelegate={(userId, expiresAt) => onDelegate(activeGate.id, userId, expiresAt)}
            className="hidden border-primary/25 bg-background md:block"
          />

          {queuedGates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Queued gates</p>
                <span className="text-xs text-muted-foreground">{queuedGates.length} waiting</span>
              </div>
              <ul className="space-y-2">
                {queuedGates.map((gate) => {
                  const hours = hoursRemaining(gate);
                  const progress = gateProgress(gate);

                  return (
                    <li
                      key={gate.id}
                      className="rounded-md border border-border bg-background p-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{gate.objectName}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{gate.objectType}</span>
                            <span>{hours === 0 ? "Due now" : `${hours}h left`}</span>
                            <span>{requesterFor(gate, requesterMap).name}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 px-2 text-xs"
                          onClick={() => onActivate(gate.id)}
                          aria-label={`Review ${gate.objectName}`}
                        >
                          Review
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            progress >= 90 ? "bg-destructive" : progress >= 75 ? "bg-amber-500" : "bg-primary",
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </PanelShell>
  );
}

function NextWorkPanel({
  obligations,
  commitments,
  workItems,
  className,
  onNavigateObligation,
  onApproveRun,
  onDismissCommitment,
}: {
  obligations: Obligation[];
  commitments: Commitment[];
  workItems: WorkItem[];
  className?: string;
  onNavigateObligation: (href: string) => void;
  onApproveRun: (commitmentId: string) => void;
  onDismissCommitment: (commitmentId: string) => void;
}) {
  return (
    <section
      className={cn(
        "min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground",
        className,
      )}
    >
      <div className="grid shrink-0 grid-cols-2 border-b border-border">
        <div className="border-r border-border px-3 py-2.5">
          <h2 className="text-sm font-semibold">Obligations</h2>
          <p className="text-xs text-muted-foreground">{obligations.length} deadlines</p>
        </div>
        <div className="px-3 py-2.5">
          <h2 className="text-sm font-semibold">Commitments</h2>
          <p className="text-xs text-muted-foreground">{commitments.length} active</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {workItems.length === 0 ? (
          <CompactEmpty
            icon={CheckCircle}
            title="No next work"
            detail="Obligations and commitments are clear."
          />
        ) : (
          <ul className="space-y-2">
            {workItems.map((item) =>
              item.kind === "obligation" ? (
                <ObligationRow
                  key={item.id}
                  item={item}
                  onNavigateObligation={onNavigateObligation}
                />
              ) : (
                <CommitmentRow
                  key={item.id}
                  item={item}
                  onApproveRun={onApproveRun}
                  onDismissCommitment={onDismissCommitment}
                />
              ),
            )}
          </ul>
        )}
      </div>
    </section>
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
            dueTone(item.days),
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
                dueTone(item.days),
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

function CompactEmpty({
  icon: Icon,
  title,
  detail,
}: {
  icon: React.ElementType;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background/60 p-6 text-center">
      <Icon className="h-7 w-7 text-primary" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-xs text-xs text-muted-foreground">{detail}</p>
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
  onApprove,
  onRequestChanges,
  onReject,
  onDelegate,
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

  const [activeTab, setActiveTab] = useState<BriefingTab>("decisions");
  const [dismissedEvents, setDismissedEvents] = useState<Set<string>>(new Set());
  const [dismissedGates, setDismissedGates] = useState<Set<string>>(new Set());
  const [dismissedCommitments, setDismissedCommitments] = useState<Set<string>>(new Set());
  const [activeGateId, setActiveGateId] = useState<string | undefined>();
  const [boardPackRunRef, setBoardPackRunRef] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);

  const visibleEvents = useMemo(
    () => sortEvents(events.filter((event) => !dismissedEvents.has(event.id))),
    [dismissedEvents, events],
  );

  const visibleGates = useMemo(
    () => sortGates(gates.filter((gate) => !dismissedGates.has(gate.id))),
    [dismissedGates, gates],
  );

  const visibleCommitments = useMemo(
    () => commitments.filter((commitment) => !dismissedCommitments.has(commitment.id)),
    [commitments, dismissedCommitments],
  );

  const activeGate =
    visibleGates.find((gate) => gate.id === activeGateId) ?? visibleGates[0];

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

  function completeGate(gateId: string) {
    setDismissedGates((prev) => new Set([...prev, gateId]));
    const nextGate = visibleGates.find((gate) => gate.id !== gateId);
    setActiveGateId(nextGate?.id);
  }

  function handleApprove(gateId: string) {
    completeGate(gateId);
    onApprove(gateId);
  }

  function handleReject(gateId: string, reason: string) {
    completeGate(gateId);
    onReject(gateId, reason);
  }

  function handleDismissCommitment(commitmentId: string) {
    setDismissedCommitments((prev) => new Set([...prev, commitmentId]));
    onDismissCommitment(commitmentId);
  }

  const panelVisibility = (tab: BriefingTab) =>
    activeTab === tab ? "flex" : "hidden md:flex";

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

        <MobileTabs activeTab={activeTab} onChange={setActiveTab} />

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(240px,0.9fr)_minmax(360px,1.1fr)] md:grid-rows-[minmax(0,1fr)_minmax(0,0.72fr)] xl:grid-cols-[minmax(260px,0.85fr)_minmax(420px,1.25fr)_minmax(280px,0.9fr)] xl:grid-rows-[minmax(0,1fr)]">
          <DeltaPulsePanel
            events={visibleEvents}
            onAcknowledge={handleAcknowledge}
            onOpen={onOpen}
            className={cn(
              panelVisibility("pulse"),
              "md:col-start-1 md:row-start-1 xl:col-start-1 xl:row-start-1",
            )}
          />

          <DecisionWorkbench
            gates={visibleGates}
            activeGate={activeGate}
            requesterMap={requesterMap}
            onActivate={setActiveGateId}
            onApprove={handleApprove}
            onRequestChanges={onRequestChanges}
            onReject={handleReject}
            onDelegate={onDelegate}
            className={cn(
              panelVisibility("decisions"),
              "md:col-start-2 md:row-start-1 xl:col-start-2 xl:row-start-1",
            )}
          />

          <NextWorkPanel
            obligations={obligations}
            commitments={visibleCommitments}
            workItems={workItems}
            onNavigateObligation={onNavigateObligation}
            onApproveRun={onApproveRun}
            onDismissCommitment={handleDismissCommitment}
            className={cn(
              panelVisibility("next"),
              "md:col-span-2 md:row-start-2 xl:col-span-1 xl:col-start-3 xl:row-start-1",
            )}
          />
        </div>
      </div>
    </div>
  );
}
