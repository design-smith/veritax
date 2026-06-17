"use client";

import { format, parseISO } from "date-fns";
import { CalendarDays, Mail, MessageSquare, Play, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Commitment } from "@/lib/mock/types";

interface CommitmentsLaneProps {
  commitments: Commitment[];
  onApproveRun: (commitmentId: string) => void;
  onDismiss: (commitmentId: string) => void;
  onMarkDone?: (commitmentId: string) => void;
  className?: string;
}

const SOURCE_ICONS = {
  meeting: MessageSquare,
  email: Mail,
};

const PLAN_STATE_LABELS: Record<Commitment["planState"], string> = {
  pending: "Plan pending",
  approved: "Ready to run",
  dismissed: "Dismissed",
  completed: "Completed",
  external: "External",
};

export function CommitmentsLane({
  commitments,
  onApproveRun,
  onDismiss,
  onMarkDone,
  className,
}: CommitmentsLaneProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {commitments.map((commitment) => {
        const SourceIcon = SOURCE_ICONS[commitment.source];
        const isExecutable = commitment.planState === "approved";
        const isPending = commitment.planState === "pending";
        const isExternal = commitment.planState === "external";

        return (
          <Card key={commitment.id} className="border-border">
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="text-sm font-medium leading-snug">{commitment.text}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1 text-[10px] capitalize"
                  >
                    <SourceIcon className="h-3 w-3" />
                    {commitment.source}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-[10px]"
                  >
                    {PLAN_STATE_LABELS[commitment.planState]}
                  </Badge>
                  {commitment.due && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {format(parseISO(commitment.due), "MMM d")}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-1.5">
                {/* Executable plans: Approve & run + Dismiss */}
                {isExecutable && (
                  <>
                    <Button
                      size="sm"
                      className="h-7 gap-1.5 px-2.5 text-xs"
                      onClick={() => onApproveRun(commitment.id)}
                    >
                      <Play className="h-3 w-3" />
                      Approve & run
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2.5 text-xs text-muted-foreground"
                      onClick={() => onDismiss(commitment.id)}
                    >
                      <X className="h-3 w-3" />
                      Dismiss
                    </Button>
                  </>
                )}

                {/* Pending plans: need review before they can run */}
                {isPending && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs">
                      Review plan
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2.5 text-xs text-muted-foreground"
                      onClick={() => onDismiss(commitment.id)}
                    >
                      <X className="h-3 w-3" />
                      Dismiss
                    </Button>
                  </>
                )}

                {/* External commitments: task controls only */}
                {isExternal && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs"
                      onClick={() => onMarkDone?.(commitment.id)}
                    >
                      Mark done
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2.5 text-xs text-muted-foreground"
                      onClick={() => onDismiss(commitment.id)}
                    >
                      <X className="h-3 w-3" />
                      Dismiss
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
