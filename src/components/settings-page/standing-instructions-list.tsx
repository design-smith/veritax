"use client";

import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InstructionTier = "style" | "run" | "methodology";

const TIER_COLORS: Record<InstructionTier, string> = {
  style:       "border-transparent bg-success-soft text-success-soft-foreground",
  run:         "border-transparent bg-info-soft text-info-soft-foreground",
  methodology: "border-transparent bg-warning-soft text-warning-soft-foreground",
};

export interface StandingInstruction {
  id: string;
  text: string;
  tier: InstructionTier;
  scope: string;
  createdBy: string;
}

interface StandingInstructionsListProps {
  instructions: StandingInstruction[];
  onDelete: (instructionId: string) => void;
  className?: string;
}

export function StandingInstructionsList({ instructions, onDelete, className }: StandingInstructionsListProps) {
  return (
    <div className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      {instructions.map((inst) => (
        <div key={inst.id} className="flex items-start gap-3 px-4 py-3 bg-card">
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-sm">{inst.text}</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={cn("text-[10px]", TIER_COLORS[inst.tier])}>
                {inst.tier}
              </Badge>
              {inst.scope !== "global" && (
                <Badge variant="secondary" className="text-[10px]">{inst.scope}</Badge>
              )}
            </div>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-danger-soft-foreground"
            aria-label="Delete instruction"
            onClick={() => onDelete(inst.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {instructions.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No standing instructions yet.</p>
      )}
    </div>
  );
}
