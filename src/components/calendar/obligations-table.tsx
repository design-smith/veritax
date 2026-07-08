"use client";

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Paperclip, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Obligation } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

function dayChipColor(days: number): string {
  if (days <= 0)  return "bg-danger-soft text-danger-soft-foreground";
  if (days <= 7)  return "bg-danger-soft text-danger-soft-foreground";
  if (days <= 30) return "bg-warning-soft text-warning-soft-foreground";
  return "bg-success-soft text-success-soft-foreground";
}

interface ObligationsTableProps {
  obligations: Obligation[];
  onAttachEvidence: (obligationId: string) => void;
  onAssignOwner: (obligationId: string) => void;
  className?: string;
}

export function ObligationsTable({
  obligations,
  onAttachEvidence,
  onAssignOwner,
  className,
}: ObligationsTableProps) {
  return (
    <div className={cn("rounded-lg border border-border overflow-x-auto", className)}>
      <table className="min-w-[720px] w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {["Obligation", "Jurisdiction", "Due", "Status", "Actions"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {obligations.map((ob) => {
            const daysLeft = differenceInCalendarDays(parseISO(ob.due), new Date());
            const isOverdue = ob.status === "overdue" || daysLeft < 0;

            return (
              <tr key={ob.id} className="bg-card hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium">{ob.name}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs">{ob.jurisdiction}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{format(parseISO(ob.due), "d MMM yyyy")}</span>
                    <span
                      data-testid={`day-chip-${ob.id}`}
                      className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", dayChipColor(daysLeft))}
                    >
                      {daysLeft <= 0 ? "Overdue" : `${daysLeft}d`}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="outline"
                    data-testid={`status-${ob.id}`}
                    className={cn(
                      "text-xs capitalize",
                      isOverdue ? "overdue border-transparent bg-danger-soft text-danger-soft-foreground" :
                      ob.status === "filed" ? "border-transparent bg-success-soft text-success-soft-foreground" :
                      "border-border text-muted-foreground"
                    )}
                  >
                    {ob.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs"
                      onClick={() => onAttachEvidence(ob.id)}>
                      <Paperclip className="h-3 w-3" />
                      Attach
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs"
                      onClick={() => onAssignOwner(ob.id)}>
                      <UserPlus className="h-3 w-3" />
                      Assign
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
