"use client";

import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RequestStatus = "pending" | "submitted" | "accepted" | "rejected";

export interface DataRequestField {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "textarea";
  required: boolean;
}

export interface AdvisorRequest {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: RequestStatus;
  fields: DataRequestField[];
}

const STATUS_COLORS: Record<RequestStatus, string> = {
  pending:   "border-transparent bg-warning-soft text-warning-soft-foreground",
  submitted: "border-transparent bg-info-soft text-info-soft-foreground",
  accepted:  "border-transparent bg-success-soft text-success-soft-foreground",
  rejected:  "border-transparent bg-danger-soft text-danger-soft-foreground",
};

interface AdvisorRequestsListProps {
  requests: AdvisorRequest[];
  onOpen: (requestId: string) => void;
  className?: string;
}

export function AdvisorRequestsList({ requests, onOpen, className }: AdvisorRequestsListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {requests.map((req) => (
        <button
          key={req.id}
          onClick={() => onOpen(req.id)}
          className="flex w-full items-start gap-4 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
        >
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-medium">{req.title}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[req.status])}>
                {req.status}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3 w-3" />
                {format(parseISO(req.dueDate), "d MMM yyyy")}
              </span>
            </div>
          </div>
        </button>
      ))}
      {requests.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No data requests assigned.</p>
      )}
    </div>
  );
}
