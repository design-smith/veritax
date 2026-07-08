"use client";

import { useState } from "react";
import { AlertTriangle, ArrowUpCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { Finding } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

interface TriageSubViewProps {
  candidates: Finding[];
  onPromote: (findingId: string, reason: string) => void;
  className?: string;
}

const SEVERITY_COLORS: Record<Finding["severity"], string> = {
  critical: "bg-danger-soft text-danger-soft-foreground",
  high: "bg-warning-soft text-warning-soft-foreground",
  medium: "bg-info-soft text-info-soft-foreground",
  low: "bg-muted text-muted-foreground",
};

export function TriageSubView({ candidates, onPromote, className }: TriageSubViewProps) {
  const [promoting, setPromoting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function handleConfirmPromote(id: string) {
    if (!reason.trim()) return;
    onPromote(id, reason.trim());
    setPromoting(null);
    setReason("");
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Persistent banner */}
      <Alert className="border-warning/25 bg-warning-soft dark:border-warning/30 dark:bg-warning-soft">
        <AlertTriangle className="h-4 w-4 text-warning-soft-foreground" />
        <AlertDescription className="text-warning-soft-foreground dark:text-warning-soft-foreground font-medium">
          Candidates — not yet findings
        </AlertDescription>
      </Alert>

      <div className="rounded-lg border border-border overflow-hidden">
        {candidates.map((candidate, idx) => (
          <div key={candidate.id}>
            {idx > 0 && <Separator />}
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="font-mono text-xs text-muted-foreground">{candidate.id}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
                      SEVERITY_COLORS[candidate.severity],
                    )}
                  >
                    {candidate.severity}
                  </span>
                  <span className="text-sm font-medium truncate">{candidate.title}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5 text-xs"
                  onClick={() => {
                    setPromoting(candidate.id === promoting ? null : candidate.id);
                    setReason("");
                  }}
                >
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                  Promote
                </Button>
              </div>

              {/* Inline promote form */}
              {promoting === candidate.id && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for promotion…"
                    className="h-8 flex-1 text-sm"
                    onKeyDown={(e) => e.key === "Enter" && handleConfirmPromote(candidate.id)}
                  />
                  <Button
                    size="sm"
                    disabled={!reason.trim()}
                    onClick={() => handleConfirmPromote(candidate.id)}
                  >
                    Confirm promote
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setPromoting(null); setReason(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
