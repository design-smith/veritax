"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { GateCard } from "@/components/patterns/pat-5-gate-card";
import type { GateRequest, User } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

interface DecisionQueueSectionProps {
  gates: GateRequest[];
  requesterMap: Record<string, User>;
  onApprove: (gateId: string) => void;
  onRequestChanges: (gateId: string, comment: string) => void;
  onReject: (gateId: string, reason: string) => void;
  onDelegate: (gateId: string, userId: string, expiresAt: string) => void;
  className?: string;
}

export function DecisionQueueSection({
  gates,
  requesterMap,
  onApprove,
  onRequestChanges,
  onReject,
  onDelegate,
  className,
}: DecisionQueueSectionProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = gates.filter((g) => !dismissed.has(g.id));

  function complete(gateId: string) {
    setDismissed((prev) => new Set([...prev, gateId]));
  }

  if (visible.length === 0) {
    return (
      <div className={cn("flex flex-col items-center gap-2 py-8 text-center", className)}>
        <CheckCircle className="h-8 w-8 text-green-500" />
        <p className="text-sm font-medium">No pending decisions</p>
        <p className="text-xs text-muted-foreground">All gates have been resolved.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {visible.map((gate) => {
        const requester = requesterMap[gate.requesterId] ?? {
          id: gate.requesterId,
          name: "Unknown",
          email: "",
          role: "analyst" as const,
        };

        return (
          <GateCard
            key={gate.id}
            gate={gate}
            objectSummary={`${gate.objectType} — pending sign-off`}
            requester={requester}
            onApprove={() => {
              complete(gate.id);
              onApprove(gate.id);
            }}
            onRequestChanges={(comment) => onRequestChanges(gate.id, comment)}
            onReject={(reason) => {
              complete(gate.id);
              onReject(gate.id, reason);
            }}
            onDelegate={(userId, expiresAt) => onDelegate(gate.id, userId, expiresAt)}
          />
        );
      })}
    </div>
  );
}
