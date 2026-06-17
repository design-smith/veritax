"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarDays, Mail, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Commitment } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

type FilterMode = "all" | "mine" | "by-me" | "team";

const PLAN_STATE_COLORS: Record<Commitment["planState"], string> = {
  pending:   "border-amber-300 bg-amber-50 text-amber-700",
  approved:  "border-green-300 bg-green-50 text-green-700",
  dismissed: "border-border text-muted-foreground",
  completed: "border-green-300 bg-green-50 text-green-700",
  external:  "border-blue-300 bg-blue-50 text-blue-700",
};

const SOURCE_ICONS = { meeting: MessageSquare, email: Mail };

interface CommitmentsListViewProps {
  commitments: Commitment[];
  currentUserId: string;
  onOpen: (commitmentId: string) => void;
  className?: string;
}

export function CommitmentsListView({
  commitments,
  currentUserId,
  onOpen,
  className,
}: CommitmentsListViewProps) {
  const [filter, setFilter] = useState<FilterMode>("all");

  const visible = commitments.filter((c) => {
    if (filter === "mine") return c.ownerId === currentUserId;
    return true;
  });

  const filters: Array<{ key: FilterMode; label: string }> = [
    { key: "all",    label: "All" },
    { key: "mine",   label: "Mine" },
    { key: "by-me",  label: "By me" },
    { key: "team",   label: "Team" },
  ];

  return (
    <div className={cn("space-y-4", className)}>
      {/* Filter tabs */}
      <div className="flex gap-1">
        {filters.map(({ key, label }) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "default" : "outline"}
            className="h-7 px-3 text-xs"
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Separator />

      {/* Rows */}
      <div className="space-y-2">
        {visible.map((c) => {
          const SourceIcon = SOURCE_ICONS[c.source];
          return (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className="flex w-full items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
            >
              <SourceIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium leading-snug">{c.text}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("text-[10px] capitalize", PLAN_STATE_COLORS[c.planState])}>
                    {c.planState}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {c.source}
                  </Badge>
                  {c.due && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {format(parseISO(c.due), "MMM d")}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No commitments match this filter.</p>
        )}
      </div>
    </div>
  );
}
