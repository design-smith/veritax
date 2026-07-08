"use client";

import { Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SourceType = "ERP" | "HRIS" | "email" | "sharepoint" | "license-db" | "messaging" | "other";
type ITPolicyState = "self-serve" | "request" | "disabled";

export interface CatalogEntry {
  id: string;
  name: string;
  type: SourceType;
  itPolicyState: ITPolicyState;
}

const POLICY_CONFIG: Record<ITPolicyState, { label: string; cls: string }> = {
  "self-serve": { label: "Self-serve", cls: "border-transparent bg-success-soft text-success-soft-foreground" },
  "request":    { label: "Request",    cls: "border-transparent bg-warning-soft text-warning-soft-foreground" },
  "disabled":   { label: "Disabled",  cls: "border-border text-muted-foreground" },
};

interface AddSourceCatalogProps {
  entries: CatalogEntry[];
  onConnect: (entryId: string) => void;
  onRequest: (entryId: string) => void;
  className?: string;
}

export function AddSourceCatalog({ entries, onConnect, onRequest, className }: AddSourceCatalogProps) {
  return (
    <div className={cn("grid gap-3 tablet:grid-cols-2", className)}>
      {entries.map((entry) => {
        const { label, cls } = POLICY_CONFIG[entry.itPolicyState];
        const isDisabled = entry.itPolicyState === "disabled";
        return (
          <div
            key={entry.id}
            className={cn(
              "flex items-center justify-between rounded-lg border border-border bg-card p-3",
              isDisabled && "opacity-50",
            )}
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">{entry.name}</p>
              <Badge variant="outline" className="text-[10px]">{entry.type}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px]", cls)}>{label}</Badge>
              {entry.itPolicyState === "self-serve" && (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                  onClick={() => onConnect(entry.id)}>
                  <Plus className="h-3 w-3" />
                  Connect
                </Button>
              )}
              {entry.itPolicyState === "request" && (
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs"
                  aria-label={`Request ${entry.name}`}
                  onClick={() => onRequest(entry.id)}>
                  <Send className="h-3 w-3" />
                  Request
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
