import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Finding } from "@/lib/mock/types";

type LifecycleStatus = Finding["status"];

const STAGES: { key: LifecycleStatus; label: string }[] = [
  { key: "detected", label: "Detected" },
  { key: "triaged", label: "Triaged" },
  { key: "in-remediation", label: "In remediation" },
  { key: "reviewed", label: "Reviewed" },
  { key: "resolved", label: "Resolved" },
  { key: "verify-next-cycle", label: "Verify next cycle" },
];

const STATUS_INDEX: Record<LifecycleStatus, number> = Object.fromEntries(
  STAGES.map(({ key }, i) => [key, i])
) as Record<LifecycleStatus, number>;

interface FindingLifecycleIndicatorProps {
  status: LifecycleStatus;
  nextCycleDate?: string;
  className?: string;
}

export function FindingLifecycleIndicator({
  status,
  nextCycleDate,
  className,
}: FindingLifecycleIndicatorProps) {
  const activeIdx = STATUS_INDEX[status];

  return (
    <div className={cn("space-y-2", className)}>
      <ol className="flex items-center gap-0">
        {STAGES.map(({ key, label }, idx) => {
          const isCompleted = idx < activeIdx;
          const isActive = idx === activeIdx;

          return (
            <li key={key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* Connector left */}
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    idx === 0 ? "invisible" : isCompleted || isActive ? "bg-primary" : "bg-border",
                  )}
                />
                {/* Stage dot */}
                <div
                  data-testid={`stage-${key}`}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    isCompleted
                      ? "completed border-primary bg-primary text-primary-foreground"
                      : isActive
                        ? "border-primary bg-background text-primary"
                        : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : idx + 1}
                </div>
                {/* Connector right */}
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    idx === STAGES.length - 1 ? "invisible" : isCompleted ? "bg-primary" : "bg-border",
                  )}
                />
              </div>
              <span
                className={cn(
                  "mt-1 text-center text-[10px] leading-tight",
                  isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {status === "resolved" && nextCycleDate && (
        <p data-testid="next-cycle-notice" className="text-center text-xs text-muted-foreground">
          Verify next cycle: <span className="font-medium text-foreground">{nextCycleDate}</span>
        </p>
      )}
    </div>
  );
}
