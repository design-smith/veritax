"use client";

import { differenceInCalendarDays, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Obligation } from "@/lib/mock/types";

interface ObligationsStripProps {
  obligations: Obligation[];
  onNavigate?: (href: string) => void;
  className?: string;
}

function daysRemaining(due: string): number {
  return differenceInCalendarDays(parseISO(due), new Date());
}

function chipColor(days: number): string {
  if (days <= 7) return "bg-danger-soft text-danger-soft-foreground dark:bg-danger-soft dark:text-danger-soft-foreground";
  if (days <= 30) return "bg-warning-soft text-warning-soft-foreground dark:bg-warning-soft dark:text-warning-soft-foreground";
  return "bg-success-soft text-success-soft-foreground dark:bg-success-soft dark:text-success-soft-foreground";
}

export function ObligationsStrip({ obligations, onNavigate, className }: ObligationsStripProps) {
  const sorted = [...obligations]
    .map((ob) => ({ ...ob, days: daysRemaining(ob.due) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  return (
    <ul className={cn("space-y-2", className)}>
      {sorted.map(({ days, ...ob }) => (
        <li
          key={ob.id}
          role="listitem"
          onClick={() => onNavigate?.(`/calendar?obligation=${ob.id}`)}
          className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 transition-colors hover:bg-muted"
        >
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{ob.name}</p>
              <p className="text-xs text-muted-foreground">{ob.jurisdiction}</p>
            </div>
          </div>
          <span
            data-testid={`day-chip-${ob.id}`}
            className={cn(
              "ml-3 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              chipColor(days),
            )}
          >
            {days <= 0 ? "Overdue" : `${days}d`}
          </span>
        </li>
      ))}
    </ul>
  );
}
