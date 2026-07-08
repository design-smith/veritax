"use client";

import { format, parseISO } from "date-fns";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RequestType = "access" | "connector" | "backfill";
type RequestStatus = "pending" | "approved" | "denied";

export interface PendingRequest {
  id: string;
  type: RequestType;
  requesterId: string;
  description: string;
  status: RequestStatus;
  createdAt: string;
}

interface PendingRequestsQueueProps {
  requests: PendingRequest[];
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  className?: string;
}

export function PendingRequestsQueue({ requests, onApprove, onDeny, className }: PendingRequestsQueueProps) {
  if (requests.length === 0) {
    return (
      <p className={cn("py-8 text-center text-sm text-muted-foreground", className)}>
        No pending requests — queue is clear.
      </p>
    );
  }

  return (
    <div className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      {requests.map((req) => (
        <div key={req.id} className="flex items-start gap-4 px-4 py-3 bg-card">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] capitalize">{req.type}</Badge>
              <span className="text-xs text-muted-foreground font-mono">
                {format(parseISO(req.createdAt), "d MMM HH:mm")}
              </span>
            </div>
            <p className="text-sm">{req.description}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={() => onApprove(req.id)}>
              <Check className="h-3 w-3" />
              Approve
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs text-danger-soft-foreground border-danger/30 hover:bg-danger/[0.05]"
              onClick={() => onDeny(req.id)}>
              <X className="h-3 w-3" />
              Deny
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
