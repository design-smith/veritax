"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

// ── StaleBadge ────────────────────────────────────────────────────────────────

interface StaleBadgeProps {
  whatChanged?: string;
  onViewDiff?: () => void;
}

export function StaleBadge({ whatChanged, onViewDiff }: StaleBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge
        variant="warning"
        className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
      >
        <RefreshCw className="h-3 w-3" />
        stale
      </Badge>
      {onViewDiff && (
        <button
          onClick={onViewDiff}
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          what changed
        </button>
      )}
    </span>
  );
}

// ── SurfaceStalenessBar ───────────────────────────────────────────────────────

interface SurfaceStalenessBarProps {
  count: number;
  onReview: () => void;
}

export function SurfaceStalenessBar({ count, onReview }: SurfaceStalenessBarProps) {
  if (count === 0) return null;

  return (
    <Alert className="rounded-none border-x-0 border-t-0 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950">
      <TriangleAlert className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-amber-900 dark:text-amber-100">
          <strong>{count} artifacts</strong> affected by changes since last build
        </span>
        <Button size="sm" variant="outline" onClick={onReview} className="ml-4 shrink-0">
          Review proposals
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// ── StalenessProposalSheet ────────────────────────────────────────────────────

export interface ProposalTarget {
  id: string;
  name: string;
  changeDescription: string;
}

interface StalenessProposalSheetProps {
  open: boolean;
  targets: ProposalTarget[];
  onAccept: (id: string) => void;
  onSkip: (id: string) => void;
  onClose: () => void;
}

export function StalenessProposalSheet({
  open,
  targets,
  onAccept,
  onSkip,
  onClose,
}: StalenessProposalSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-96">
        <SheetHeader>
          <SheetTitle>Rebuild proposals</SheetTitle>
        </SheetHeader>
        <p className="mt-2 text-xs text-muted-foreground">
          The following artifacts have stale inputs. Accept to queue a rebuild via plan confirmation.
          Nothing rebuilds automatically.
        </p>
        <div className="mt-4 space-y-3">
          {targets.map((target, i) => (
            <div key={target.id}>
              {i > 0 && <Separator className="mb-3" />}
              <div className="space-y-2">
                <p className="text-sm font-medium">{target.name}</p>
                <p className="text-xs text-muted-foreground">{target.changeDescription}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => onAccept(target.id)}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onSkip(target.id)}>
                    Skip
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
