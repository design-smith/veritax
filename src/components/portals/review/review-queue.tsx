"use client";

import { GitPullRequest } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DocType = "local-file" | "master-file" | "ica" | "benchmark" | "memo";
type AssignmentStatus = "assigned" | "in-progress" | "changes-requested" | "signed";

const STATUS_COLORS: Record<AssignmentStatus, string> = {
  assigned:           "border-transparent bg-warning-soft text-warning-soft-foreground",
  "in-progress":      "border-transparent bg-info-soft text-info-soft-foreground",
  "changes-requested":"border-transparent bg-danger-soft text-danger-soft-foreground",
  signed:             "border-transparent bg-success-soft text-success-soft-foreground",
};

export interface ReviewAssignment {
  id: string;
  docName: string;
  docType: DocType;
  status: AssignmentStatus;
  redlineCount: number;
}

interface ReviewQueueProps {
  assignments: ReviewAssignment[];
  onOpen: (assignmentId: string) => void;
  className?: string;
}

export function ReviewQueue({ assignments, onOpen, className }: ReviewQueueProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {assignments.map((a) => (
        <button
          key={a.id}
          onClick={() => onOpen(a.id)}
          className="flex w-full items-start gap-4 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
        >
          <GitPullRequest className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-sm font-medium">{a.docName}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-[10px]">{a.docType}</Badge>
              <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[a.status])}>
                {a.status}
              </Badge>
              {a.redlineCount > 0 && (
                <Badge variant="outline" className="text-[10px] border-warning/25 text-warning-soft-foreground">
                  {a.redlineCount} changes
                </Badge>
              )}
            </div>
          </div>
        </button>
      ))}
      {assignments.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No documents assigned for review.</p>
      )}
    </div>
  );
}
