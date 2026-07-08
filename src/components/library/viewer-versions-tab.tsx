"use client";

import { format, parseISO } from "date-fns";
import { CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DocumentVersion {
  id: string;
  number: number;
  createdAt: string;
  author: string;
  isExecuted: boolean;
}

interface ViewerVersionsTabProps {
  versions: DocumentVersion[];
  currentVersionId: string;
  onSelectVersion: (versionId: string) => void;
}

export function ViewerVersionsTab({ versions, currentVersionId, onSelectVersion }: ViewerVersionsTabProps) {
  return (
    <div className="space-y-1 py-2">
      {versions.map((v) => (
        <button
          key={v.id}
          aria-current={v.id === currentVersionId ? "true" : undefined}
          onClick={() => onSelectVersion(v.id)}
          className={cn(
            "w-full flex items-start gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted",
            v.id === currentVersionId && "bg-muted",
          )}
        >
          <div className="flex flex-1 flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">v{v.number}</span>
              {v.isExecuted && (
                <Badge variant="outline" className="text-[10px] border-transparent bg-success-soft text-success-soft-foreground">
                  executed
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {format(parseISO(v.createdAt), "d MMM yyyy")} · {v.author}
            </span>
          </div>
          {v.isExecuted && <CheckCircle className="h-4 w-4 shrink-0 text-success-soft-foreground mt-0.5" />}
        </button>
      ))}
    </div>
  );
}
