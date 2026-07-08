"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StageTier = "style" | "run" | "methodology";

export interface AskStage {
  id: string;
  name: string;
  description: string;
  tier: StageTier;
}

const TIER_COLORS: Record<StageTier, string> = {
  style: "border-transparent bg-success-soft text-success-soft-foreground",
  run: "border-transparent bg-info-soft text-info-soft-foreground",
  methodology: "border-transparent bg-warning-soft text-warning-soft-foreground",
};

interface RunModePanelProps {
  payload: string;
  stages: AskStage[];
  onSelectStage: (stageId: string) => void;
  className?: string;
}

export function RunModePanel({ payload, stages, onSelectStage, className }: RunModePanelProps) {
  const filtered = payload.trim()
    ? stages.filter(
        (s) =>
          s.name.toLowerCase().includes(payload.toLowerCase()) ||
          s.description.toLowerCase().includes(payload.toLowerCase()),
      )
    : stages;

  if (filtered.length === 0) {
    return (
      <p className={cn("py-6 text-center text-xs text-muted-foreground", className)}>
        No matching stages for &quot;{payload}&quot;
      </p>
    );
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Stages
      </p>
      {filtered.map((stage) => (
        <button
          key={stage.id}
          onClick={() => onSelectStage(stage.id)}
          className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{stage.name}</span>
              {stage.tier !== "run" && (
                <Badge
                  variant="outline"
                  className={cn("text-[10px]", TIER_COLORS[stage.tier])}
                >
                  {stage.tier}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{stage.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
