"use client";

import { Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SensitivityTier = "standard" | "sensitive" | "privileged";

// ── SensitivityChip ──────────────────────────────────────────────────────────

interface SensitivityChipProps {
  tier: SensitivityTier;
  className?: string;
}

export function SensitivityChip({ tier, className }: SensitivityChipProps) {
  if (tier === "standard") return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-xs font-medium",
        tier === "privileged"
          ? "border-transparent bg-danger-soft text-danger-soft-foreground"
          : "border-transparent bg-warning-soft text-warning-soft-foreground",
        className,
      )}
    >
      <Lock className="h-3 w-3" />
      {tier === "privileged" ? "Privileged" : "Sensitive"}
    </Badge>
  );
}

// ── SensitivityNotice ────────────────────────────────────────────────────────

interface SensitivityNoticeProps {
  tier: SensitivityTier;
  className?: string;
}

export function SensitivityNotice({ tier, className }: SensitivityNoticeProps) {
  return (
    <Alert
      role="alert"
      className={cn(
        "border-transparent bg-warning-soft text-warning-soft-foreground",
        className,
      )}
    >
      <Lock className="h-4 w-4 text-warning-soft-foreground" />
      <AlertDescription>
        <span className="font-medium capitalize">{tier}</span> object — views are logged. Access is subject to policy review.
      </AlertDescription>
    </Alert>
  );
}

// ── VaultLockedEntry ─────────────────────────────────────────────────────────

interface VaultLockedEntryProps {
  label: string;
  onContactCounsel?: () => void;
}

export function VaultLockedEntry({ label, onContactCounsel }: VaultLockedEntryProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-danger/25 bg-danger-soft p-3 dark:border-danger/30 dark:bg-danger-soft">
      <div className="flex items-center gap-2">
        <Lock
          aria-label="locked"
          className="h-4 w-4 shrink-0 text-danger-soft-foreground"
        />
        <span className="text-sm font-medium text-danger-soft-foreground dark:text-danger-soft-foreground">{label}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="border-danger/25 text-danger-soft-foreground hover:bg-danger-soft dark:border-danger/30 dark:text-danger-soft-foreground"
        onClick={onContactCounsel}
      >
        Contact counsel
      </Button>
    </div>
  );
}
