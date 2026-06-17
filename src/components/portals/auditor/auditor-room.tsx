import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { AlertTriangle, Eye, Hash, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ArtifactType = "local-file" | "master-file" | "ica" | "benchmark" | "memo" | "board-pack";

export interface AuditorArtifact {
  id: string;
  name: string;
  type: ArtifactType;
  provisionPeriod: string;
  expiresAt: string;
  hash: string;
}

interface AuditorRoomProps {
  artifacts: AuditorArtifact[];
  provisionPeriod: string;
  expiresAt: string;
  className?: string;
}

export function AuditorRoom({ artifacts, provisionPeriod, expiresAt, className }: AuditorRoomProps) {
  const daysLeft = differenceInCalendarDays(parseISO(expiresAt), new Date());
  const expiryUrgent = daysLeft <= 30;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Every-open logged notice */}
      <Alert role="alert" className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950">
        <Eye className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-900 dark:text-amber-100">
          <strong>Views are logged.</strong> Your access to this evidence room is recorded and subject to policy review.
        </AlertDescription>
      </Alert>

      {/* Expiry countdown banner */}
      <div className={cn(
        "flex items-center justify-between rounded-lg border px-4 py-3",
        expiryUrgent ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950" : "border-border bg-muted/20"
      )}>
        <div className="flex items-center gap-2">
          <Shield className={cn("h-4 w-4", expiryUrgent ? "text-red-600" : "text-muted-foreground")} />
          <p className="text-sm">
            <span className="font-medium">Access expires:</span>{" "}
            {format(parseISO(expiresAt), "d MMM yyyy")}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("text-xs", expiryUrgent ? "border-red-300 text-red-700" : "border-border text-muted-foreground")}
        >
          {daysLeft > 0 ? `${daysLeft} days remaining` : "Expired"}
        </Badge>
      </div>

      {/* Provision period header */}
      <div>
        <p className="text-xs text-muted-foreground">Provision period</p>
        <p className="text-lg font-semibold">{provisionPeriod}</p>
      </div>

      <Separator />

      {/* Artifact list — read-only, no mutation controls */}
      <div className="space-y-2">
        {artifacts.map((artifact) => (
          <div
            key={artifact.id}
            className="rounded-lg border border-border bg-card px-4 py-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium truncate">{artifact.name}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{artifact.type}</Badge>
                  <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                    <Hash className="h-3 w-3" />{artifact.hash}
                  </span>
                </div>
              </div>
            </div>
            {/* Watermark notice — always shown, non-removable */}
            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
              DRAFT — not for reliance · watermark applied to all exports
            </p>
          </div>
        ))}
      </div>

      {/* Hard rule reminder */}
      <p className="text-center text-[10px] text-muted-foreground">
        This room is read-only. No edits, uploads, or deletions are permitted.
      </p>
    </div>
  );
}
