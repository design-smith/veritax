"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type PolicyStatus = "draft" | "published";

export interface TrustCenterItem {
  id: string;
  label: string;
  description: string;
  status: PolicyStatus;
  lastUpdated: string;
}

interface TrustCenterPublisherProps {
  items: TrustCenterItem[];
  onPublish: (itemId: string) => void;
  onRetract: (itemId: string) => void;
  className?: string;
}

export function TrustCenterPublisher({
  items,
  onPublish,
  onRetract,
  className,
}: TrustCenterPublisherProps) {
  const [localStatuses, setLocalStatuses] = useState<Record<string, PolicyStatus>>(
    Object.fromEntries(items.map((i) => [i.id, i.status]))
  );

  function handlePublish(id: string) {
    setLocalStatuses((prev) => ({ ...prev, [id]: "published" }));
    onPublish(id);
  }

  function handleRetract(id: string) {
    setLocalStatuses((prev) => ({ ...prev, [id]: "draft" }));
    onRetract(id);
  }

  return (
    <div className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      {items.map((item) => {
        const status = localStatuses[item.id] ?? item.status;
        return (
          <div key={item.id} className="flex items-start gap-4 bg-card px-5 py-4">
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{item.label}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    status === "published"
                      ? "border-transparent bg-success-soft text-success-soft-foreground"
                      : "border-transparent bg-warning-soft text-warning-soft-foreground",
                  )}
                >
                  {status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{item.description}</p>
              <p className="text-[10px] text-muted-foreground">
                Last updated: {format(parseISO(item.lastUpdated), "d MMM yyyy")}
              </p>
            </div>
            <div className="shrink-0">
              {status === "draft" ? (
                <Button size="sm" className="h-7 px-3 text-xs" onClick={() => handlePublish(item.id)}>
                  Publish
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs text-muted-foreground"
                  onClick={() => handleRetract(item.id)}
                >
                  Retract
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
