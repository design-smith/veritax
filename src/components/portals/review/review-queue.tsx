"use client";

import { GitPullRequest } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DocType = "local-file" | "master-file" | "ica" | "benchmark" | "memo";
type AssignmentStatus = "assigned" | "in-progress" | "changes-requested" | "signed";

const STATUS_COLORS: Record<AssignmentStatus, string> = {
  assigned:           "border-amber-300 bg-amber-50 text-amber-700",
  "in-progress":      "border-blue-300 bg-blue-50 text-blue-700",
  "changes-requested":"border-red-300 bg-red-50 text-red-700",
  signed:             "border-green-300 bg-green-50 text-green-700",
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
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
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
