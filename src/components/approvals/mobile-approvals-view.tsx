"use client";

import { useState } from "react";
import { CheckCircle, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { GateRequest, User } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

interface MobileApprovalsViewProps {
  gates: GateRequest[];
  requesterMap: Record<string, User>;
  onApprove: (gateId: string) => void;
  onReject: (gateId: string, reason: string) => void;
  className?: string;
}

export function MobileApprovalsView({
  gates,
  requesterMap,
  onApprove,
  onReject,
  className,
}: MobileApprovalsViewProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const visible = gates.filter((g) => !dismissed.has(g.id));

  function handleApprove(id: string) {
    setDismissed((prev) => new Set([...prev, id]));
    onApprove(id);
  }

  function handleRejectConfirm(id: string) {
    setDismissed((prev) => new Set([...prev, id]));
    onReject(id, rejectReason);
    setRejectingId(null);
    setRejectReason("");
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Compact header */}
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
        <p className="text-sm font-semibold">Approvals</p>
        <Badge
          variant={visible.length > 0 ? "destructive" : "secondary"}
          className="text-xs"
        >
          {visible.length} pending
        </Badge>
      </div>

      {/* Gate cards */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <CheckCircle className="h-10 w-10 text-success-soft-foreground" />
            <p className="text-sm font-medium">No pending approvals — all clear</p>
          </div>
        )}

        {visible.map((gate) => {
          const requester = requesterMap[gate.requesterId];
          const isRejecting = rejectingId === gate.id;

          return (
            <div key={gate.id} className="border-b border-border px-4 py-4 space-y-3">
              {/* Card header */}
              <div className="space-y-1">
                <p className="text-sm font-semibold leading-snug">{gate.objectName}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>From {requester?.name ?? gate.requesterId}</span>
                  <span>·</span>
                  <Clock className="h-3 w-3" />
                  <span>SLA: {gate.slaHours}h</span>
                </div>
                <p className="text-xs text-muted-foreground capitalize">{gate.objectType}</p>
              </div>

              {/* Inline reject form */}
              {isRejecting && (
                <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (required)"
                    rows={2}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 text-xs"
                      disabled={!rejectReason.trim()}
                      onClick={() => handleRejectConfirm(gate.id)}
                    >
                      Confirm reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs"
                      onClick={() => { setRejectingId(null); setRejectReason(""); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Action row */}
              {!isRejecting && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-1.5 text-sm"
                    onClick={() => handleApprove(gate.id)}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-1.5 text-sm text-danger-soft-foreground hover:text-danger-soft-foreground"
                    onClick={() => setRejectingId(gate.id)}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
