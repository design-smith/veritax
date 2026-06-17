"use client";

import { useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Check, CheckCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Event, EventType } from "@/lib/mock/types";

interface DeltaDigestSectionProps {
  events: Event[];
  onAcknowledge: (eventId: string) => void;
  onOpen: (objectRef: string) => void;
  className?: string;
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  finding_created: "Findings",
  finding_resolved: "Resolved",
  run_completed: "Run",
  gate_requested: "Gate",
  document_ingested: "Document",
  staleness_detected: "Stale",
  obligation_due: "Obligation",
};

const EVENT_TYPE_VARIANTS: Record<EventType, "default" | "secondary" | "destructive" | "warning" | "success" | "outline"> = {
  finding_created: "destructive",
  finding_resolved: "success",
  run_completed: "secondary",
  gate_requested: "warning",
  document_ingested: "secondary",
  staleness_detected: "warning",
  obligation_due: "destructive",
};

export function DeltaDigestSection({
  events,
  onAcknowledge,
  onOpen,
  className,
}: DeltaDigestSectionProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = events.filter((e) => !dismissed.has(e.id));

  function handleAcknowledge(eventId: string) {
    setDismissed((prev) => new Set([...prev, eventId]));
    onAcknowledge(eventId);
  }

  if (visible.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 py-8 text-center", className)}>
        <CheckCircle className="h-8 w-8 text-green-500" />
        <p className="text-sm font-medium">All caught up</p>
        <p className="text-xs text-muted-foreground">No new changes since your last visit.</p>
      </div>
    );
  }

  return (
    <ul className={cn("space-y-2", className)}>
      {visible.map((event) => (
        <li
          key={event.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="flex items-start gap-3 min-w-0">
            <Badge
              variant={EVENT_TYPE_VARIANTS[event.type]}
              className="mt-0.5 shrink-0 text-[10px]"
            >
              {EVENT_TYPE_LABELS[event.type]}
            </Badge>
            <div className="min-w-0">
              <p className="text-sm text-foreground">{event.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(parseISO(event.timestamp), { addSuffix: true })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => onOpen(event.objectRef)}
              aria-label="Open"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => handleAcknowledge(event.id)}
              aria-label="Acknowledge"
            >
              <Check className="h-3.5 w-3.5" />
              Ack
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
