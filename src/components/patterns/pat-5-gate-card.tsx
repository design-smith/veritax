"use client";

import { useState } from "react";
import { Clock, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { GateRequest, User } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

type GateAction = "idle" | "changes" | "reject" | "delegate";

interface GateCardProps {
  gate: GateRequest;
  objectSummary: string;
  requester: User;
  diffSummary?: string;
  onApprove: () => void;
  onRequestChanges: (comment: string) => void;
  onReject: (reason: string) => void;
  onDelegate: (userId: string, expiresAt: string) => void;
  className?: string;
}

const REJECT_REASONS = [
  "Insufficient evidence",
  "Methodology not approved",
  "Scope too broad",
  "Requires additional review",
  "Policy conflict",
];

export function GateCard({
  gate,
  objectSummary,
  requester,
  diffSummary,
  onApprove,
  onRequestChanges,
  onReject,
  className,
}: GateCardProps) {
  const [action, setAction] = useState<GateAction>("idle");
  const [comment, setComment] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const slaStarted = new Date(gate.slaStarted);
  const slaDeadline = new Date(slaStarted.getTime() + gate.slaHours * 3600_000);
  const hoursRemaining = Math.max(
    0,
    Math.round((slaDeadline.getTime() - Date.now()) / 3_600_000),
  );
  const slaPercent = Math.min(
    100,
    ((gate.slaHours - hoursRemaining) / gate.slaHours) * 100,
  );
  const slaColor =
    slaPercent >= 90 ? "text-destructive" : slaPercent >= 75 ? "text-amber-600" : "text-muted-foreground";

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{gate.objectName}</CardTitle>
          <Badge variant="outline" className="shrink-0 text-xs">Gate</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{objectSummary}</p>
      </CardHeader>

      <CardContent className="space-y-3 pb-3">
        {diffSummary && (
          <div className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
            {diffSummary}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>Requested by <span className="font-medium text-foreground">{requester.name}</span></span>
          </div>
          <div className={cn("flex items-center gap-1.5", slaColor)}>
            <Clock className="h-3.5 w-3.5" />
            <span>SLA: {gate.slaHours}h ({hoursRemaining}h left)</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Escalation: <span className="font-medium text-foreground">{gate.escalationPath}</span></span>
          </div>
        </div>

        {/* Inline action forms */}
        {action === "changes" && (
          <div className="space-y-2 rounded-md border border-border p-2">
            <Label className="text-xs">Comment (required)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment describing what changes are needed..."
              rows={2}
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => { onRequestChanges(comment); setAction("idle"); setComment(""); }}
                disabled={!comment.trim()}
              >
                Send
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setAction("idle"); setComment(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {action === "reject" && (
          <div className="space-y-2 rounded-md border border-border p-2">
            <Label className="text-xs">Reason (required)</Label>
            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded-md border border-input bg-background p-2 text-sm"
            >
              <option value="">Select a reason...</option>
              {REJECT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                aria-label="Confirm reject"
                onClick={() => { onReject(rejectReason); setAction("idle"); setRejectReason(""); }}
                disabled={!rejectReason}
              >
                Confirm reject
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setAction("idle"); setRejectReason(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <Separator />

      <CardFooter className="flex flex-wrap gap-2 pt-3">
        <Button size="sm" onClick={onApprove} className="gap-1.5">
          <ShieldCheck className="h-4 w-4" />
          Approve & promote
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAction(action === "changes" ? "idle" : "changes")}
        >
          Request changes
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => setAction(action === "reject" ? "idle" : "reject")}
        >
          Reject
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAction("delegate")}>
          Delegate
        </Button>
      </CardFooter>
    </Card>
  );
}
