import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Eye, Hash, Shield } from "lucide-react";

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
  onOpenArtifact?: (artifact: AuditorArtifact) => void;
  className?: string;
}

export function AuditorRoom({
  artifacts,
  provisionPeriod,
  expiresAt,
  onOpenArtifact,
  className,
}: AuditorRoomProps) {
  const daysLeft = differenceInCalendarDays(parseISO(expiresAt), new Date());
  const expiryUrgent = daysLeft <= 30;

  return (
    <div className={cn("space-y-4", className)}>
      <Alert role="alert" className="border-warning/25 bg-warning-soft dark:border-warning/30 dark:bg-warning-soft">
        <Eye className="h-4 w-4 text-warning-soft-foreground" />
        <AlertDescription className="text-warning-soft-foreground dark:text-warning-soft-foreground">
          <strong>Views are logged.</strong> Your access to this evidence room is recorded and subject to policy review.
        </AlertDescription>
      </Alert>

      <div
        className={cn(
          "flex items-center justify-between rounded-lg border px-4 py-3",
          expiryUrgent
            ? "border-danger/25 bg-danger-soft dark:border-danger/30 dark:bg-danger-soft"
            : "border-border bg-muted/20",
        )}
      >
        <div className="flex items-center gap-2">
          <Shield className={cn("h-4 w-4", expiryUrgent ? "text-danger-soft-foreground" : "text-muted-foreground")} />
          <p className="text-sm">
            <span className="font-medium">Access expires:</span>{" "}
            {format(parseISO(expiresAt), "d MMM yyyy")}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("text-xs", expiryUrgent ? "border-danger/25 text-danger-soft-foreground" : "border-border text-muted-foreground")}
        >
          {daysLeft > 0 ? `${daysLeft} days remaining` : "Expired"}
        </Badge>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Provision period</p>
        <p className="text-lg font-semibold">{provisionPeriod}</p>
      </div>

      <Separator />

      <div className="space-y-2">
        {artifacts.map((artifact) => {
          const rowContent = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-medium truncate">{artifact.name}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {artifact.type}
                    </Badge>
                    <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                      <Hash className="h-3 w-3" />
                      {artifact.hash}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-[10px] font-medium text-warning-soft-foreground dark:text-warning-soft-foreground">
                DRAFT - not for reliance. Watermark applied to all exports.
              </p>
            </>
          );

          return onOpenArtifact ? (
            <button
              key={artifact.id}
              type="button"
              onClick={() => onOpenArtifact(artifact)}
              className="w-full space-y-2 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/30"
            >
              {rowContent}
            </button>
          ) : (
            <div key={artifact.id} className="space-y-2 rounded-lg border border-border bg-card px-4 py-3">
              {rowContent}
            </div>
          );
        })}
      </div>

      <p className="text-center text-[10px] text-muted-foreground">
        This room is read-only. No edits, uploads, or deletions are permitted.
      </p>
    </div>
  );
}
