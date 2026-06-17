import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type HistoryEventType = "status_change" | "assignment" | "instruction" | "gate_decision" | "comment" | "run_completed";
type GateDecision = "approved" | "rejected" | "changes_requested" | "delegated";
type InstructionTier = "style" | "run" | "methodology";

export interface HistoryEvent {
  id: string;
  timestamp: string;
  actor: string;
  type: HistoryEventType;
  description: string;
  instructionEcho?: string;
  instructionTier?: InstructionTier;
  gateDecision?: GateDecision;
  reason?: string;
}

interface FindingHistoryTabProps {
  events: HistoryEvent[];
  className?: string;
}

const GATE_DECISION_VARIANTS: Record<GateDecision, "success" | "destructive" | "warning" | "secondary"> = {
  approved: "success",
  rejected: "destructive",
  changes_requested: "warning",
  delegated: "secondary",
};

const TIER_COLORS: Record<InstructionTier, string> = {
  style: "border-green-300 bg-green-50 text-green-700",
  run: "border-blue-300 bg-blue-50 text-blue-700",
  methodology: "border-amber-300 bg-amber-50 text-amber-700",
};

export function FindingHistoryTab({ events, className }: FindingHistoryTabProps) {
  if (events.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground py-6 text-center", className)}>
        No history recorded for this finding yet.
      </p>
    );
  }

  const sorted = [...events].sort(
    (a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()
  );

  return (
    <ul className={cn("space-y-0", className)}>
      {sorted.map((event, idx) => (
        <li key={event.id} role="listitem" className="relative flex gap-3 pb-4">
          {/* Timeline line */}
          {idx < sorted.length - 1 && (
            <div className="absolute left-3 top-6 bottom-0 w-px bg-border" />
          )}

          {/* Dot */}
          <div className="relative mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-background">
            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
          </div>

          {/* Content */}
          <div className="flex-1 space-y-1 pt-0.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-sm font-medium">{event.actor}</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">{event.description}</span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {format(parseISO(event.timestamp), "MMM d, HH:mm")}
              </span>
            </div>

            {/* Gate decision chip */}
            {event.gateDecision && (
              <Badge variant={GATE_DECISION_VARIANTS[event.gateDecision]} className="text-xs capitalize">
                {event.gateDecision}
              </Badge>
            )}

            {/* Instruction echo */}
            {event.instructionEcho && (
              <div className="rounded-md border border-border bg-muted/30 p-2 text-xs">
                <div className="flex items-center gap-1.5 mb-1">
                  {event.instructionTier && (
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] capitalize", TIER_COLORS[event.instructionTier])}
                    >
                      {event.instructionTier}
                    </Badge>
                  )}
                  <span className="text-muted-foreground">Instruction</span>
                </div>
                <p className="italic text-foreground">{event.instructionEcho}</p>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
