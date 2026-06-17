"use client";

import { format, parseISO } from "date-fns";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface SavedQuestion {
  id: string;
  question: string;
  lastAnswer: string;
  lastRunAt: string;
  hasChanged: boolean;
  isMonitored: boolean;
}

interface SavedQuestionsTableProps {
  questions: SavedQuestion[];
  onReask: (questionId: string) => void;
  onDelete: (questionId: string) => void;
  onToggleMonitor: (questionId: string) => void;
  className?: string;
}

export function SavedQuestionsTable({
  questions,
  onReask,
  onDelete,
  onToggleMonitor,
  className,
}: SavedQuestionsTableProps) {
  if (questions.length === 0) {
    return (
      <p className={cn("py-8 text-center text-sm text-muted-foreground", className)}>
        No saved questions yet. Ask something and save it.
      </p>
    );
  }

  return (
    <div className={cn("divide-y divide-border", className)}>
      {questions.map((q) => (
        <div
          key={q.id}
          data-testid={`question-row-${q.id}`}
          className={cn(
            "flex items-start gap-4 px-4 py-4 transition-colors",
            q.hasChanged && "changed bg-amber-50/60 dark:bg-amber-950/30",
          )}
        >
          {/* Monitor toggle */}
          <div className="mt-0.5 shrink-0">
            <Checkbox
              data-testid={`monitor-toggle-${q.id}`}
              checked={q.isMonitored}
              onCheckedChange={() => onToggleMonitor(q.id)}
              aria-label={`Monitor ${q.question}`}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{q.question}</p>
              <div className="flex shrink-0 items-center gap-1">
                {q.hasChanged && (
                  <Badge variant="warning" className="text-[10px] border-amber-300 bg-amber-50 text-amber-700">
                    Changed
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {format(parseISO(q.lastRunAt), "MMM d")}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{q.lastAnswer}</p>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => onReask(q.id)}
            >
              <RefreshCw className="h-3 w-3" />
              Re-ask
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
