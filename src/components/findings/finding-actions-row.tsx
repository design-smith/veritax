"use client";

import { useState } from "react";
import { Check, Download, MessageSquare, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ReviewerState = "unreviewed" | "confirmed" | "dismissed";
type FindingType = "exception" | "gap" | "drift" | "documentation";

const DISMISS_REASONS = [
  "Not a finding",
  "Already remediated",
  "Accepted risk",
  "Data quality issue",
  "Out of scope",
  "Duplicate",
];

interface FindingActionsRowProps {
  findingId: string;
  findingType: FindingType;
  reviewerState: ReviewerState;
  onConfirm: (findingId: string) => void;
  onDismiss: (findingId: string, reason: string) => void;
  onAssign: (findingId: string) => void;
  onComment: (findingId: string) => void;
  onExportMemo: (findingId: string) => void;
  onDataRequest?: (findingId: string) => void;
  className?: string;
}

export function FindingActionsRow({
  findingId,
  findingType,
  reviewerState,
  onConfirm,
  onDismiss,
  onAssign,
  onComment,
  onExportMemo,
  onDataRequest,
  className,
}: FindingActionsRowProps) {
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState("");

  function handleConfirmDismiss() {
    if (!dismissReason) return;
    onDismiss(findingId, dismissReason);
    setDismissOpen(false);
    setDismissReason("");
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {/* Confirm */}
        <Button
          size="sm"
          variant="outline"
          disabled={reviewerState === "confirmed"}
          onClick={() => onConfirm(findingId)}
          className="gap-1.5"
        >
          <Check className="h-3.5 w-3.5" />
          Confirm
        </Button>

        {/* Dismiss (toggle form) */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDismissOpen((o) => !o)}
          className="gap-1.5"
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </Button>

        <Separator orientation="vertical" className="h-6" />

        {/* Assign */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAssign(findingId)}
          className="gap-1.5"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Assign
        </Button>

        {/* Comment */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onComment(findingId)}
          className="gap-1.5"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Comment
        </Button>

        {/* Data request (gap-type only) */}
        {findingType === "gap" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDataRequest?.(findingId)}
            className="gap-1.5"
          >
            Data request
          </Button>
        )}

        <Separator orientation="vertical" className="h-6" />

        {/* Export memo */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onExportMemo(findingId)}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          Export memo
        </Button>
      </div>

      {/* Inline dismiss form */}
      {dismissOpen && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
          <select
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            className="flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm"
          >
            <option value="">Select reason…</option>
            {DISMISS_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="destructive"
            disabled={!dismissReason}
            onClick={handleConfirmDismiss}
          >
            Confirm dismiss
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setDismissOpen(false); setDismissReason(""); }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
