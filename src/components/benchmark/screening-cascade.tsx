"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CascadeStage {
  id: string;
  label: string;
  totalIn: number;
  totalOut: number;
  criteria: string;
}

interface ScreeningCascadeProps {
  stages: CascadeStage[];
  onSelectStage: (stageId: string) => void;
  className?: string;
}

export function ScreeningCascade({ stages, onSelectStage, className }: ScreeningCascadeProps) {
  const [activeStage, setActiveStage] = useState<string | null>(null);

  function handleClick(id: string) {
    setActiveStage(id);
    onSelectStage(id);
  }

  const active = stages.find((s) => s.id === activeStage);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Visual cascade */}
      <div className="flex items-center gap-1 flex-wrap">
        {stages.map((stage, idx) => (
          <div key={stage.id} className="flex items-center gap-1">
            <button
              onClick={() => handleClick(stage.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-xs transition-colors hover:border-primary",
                activeStage === stage.id ? "border-primary bg-primary/5" : "border-border bg-card",
              )}
            >
              <p className="font-medium">{stage.label}</p>
              <p className="text-muted-foreground">{stage.totalOut} in</p>
            </button>
            {idx < stages.length - 1 && (
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Criteria editor for active stage */}
      {active && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Criteria — {active.label}</p>
            <p className="text-sm">{active.criteria}</p>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{active.totalIn} in</Badge>
              <Badge variant="outline">{active.totalIn - active.totalOut} excluded</Badge>
              <Badge variant="secondary">{active.totalOut} remaining</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
