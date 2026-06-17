"use client";

import { Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OnboardingStage = "Connect" | "Ingest" | "Teach" | "Reveal";

const STAGES: OnboardingStage[] = ["Connect", "Ingest", "Teach", "Reveal"];

interface OnboardingRailProps {
  currentStage: OnboardingStage;
  completedStages: OnboardingStage[];
  onReplay: (() => void) | undefined;
  className?: string;
}

export function OnboardingRail({
  currentStage,
  completedStages,
  onReplay,
  className,
}: OnboardingRailProps) {
  const completed = new Set(completedStages);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <ol className="flex items-center">
        {STAGES.map((stage, idx) => {
          const isCompleted = completed.has(stage);
          const isActive = stage === currentStage;

          return (
            <li key={stage} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* Left connector */}
                <div className={cn("h-0.5 flex-1", idx === 0 ? "invisible" : isCompleted ? "bg-primary" : "bg-border")} />
                {/* Dot */}
                <div
                  data-testid={`stage-${stage}`}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    isCompleted
                      ? "completed border-primary bg-primary text-primary-foreground"
                      : isActive
                        ? "border-primary bg-background text-primary"
                        : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                {/* Right connector */}
                <div className={cn("h-0.5 flex-1", idx === STAGES.length - 1 ? "invisible" : isCompleted ? "bg-primary" : "bg-border")} />
              </div>
              <span
                className={cn(
                  "mt-1.5 text-center text-xs font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {stage}
              </span>
            </li>
          );
        })}
      </ol>

      {onReplay && (
        <div className="flex justify-center">
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground" onClick={onReplay}>
            <RefreshCw className="h-3.5 w-3.5" />
            Replay journey
          </Button>
        </div>
      )}
    </div>
  );
}
