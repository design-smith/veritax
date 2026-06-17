"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type InstructionTier = "style" | "run" | "methodology";

interface SubmitPayload {
  text: string;
  tier: InstructionTier;
}

interface InstructionInputProps {
  onSubmit: (payload: SubmitPayload) => void;
  existingInstructions?: string[];
  initialValue?: string;
  placeholder?: string;
  className?: string;
}

// Simple heuristic: keyword-based tier classification
function classifyTier(text: string): InstructionTier {
  const lower = text.toLowerCase();
  const methodologyKeywords = [
    "methodology", "benchmark", "method", "policy", "rate", "pricing",
    "change the", "update the policy", "tnmm", "cut", "cup", "cost plus",
  ];
  const runKeywords = [
    "run", "scan", "re-run", "regenerate", "re-generate", "rebuild",
    "execute", "compute", "refresh",
  ];
  if (methodologyKeywords.some((kw) => lower.includes(kw))) return "methodology";
  if (runKeywords.some((kw) => lower.includes(kw))) return "run";
  return "style";
}

function detectConflict(text: string, existing: string[]): string | null {
  if (!text.trim()) return null;
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter((w) => w.length > 4);
  for (const inst of existing) {
    const instLower = inst.toLowerCase();
    const matchCount = words.filter((w) => instLower.includes(w)).length;
    if (matchCount >= 2) return inst;
  }
  return null;
}

const TIER_CONSEQUENCE: Record<InstructionTier, string> = {
  style: "Will apply immediately — no approval required",
  run: "Requires run — will open plan confirmation",
  methodology: "Requires manager approval before applying",
};

const TIER_COLORS: Record<InstructionTier, string> = {
  style: "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-300",
  run: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300",
  methodology: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

export function InstructionInput({
  onSubmit,
  existingInstructions = [],
  initialValue = "",
  placeholder = "Type an instruction...",
  className,
}: InstructionInputProps) {
  const [text, setText] = useState(initialValue);

  const tier = text.trim() ? classifyTier(text) : "style";
  const conflict = text.trim() ? detectConflict(text, existingInstructions) : null;

  function handleSubmit() {
    if (!text.trim()) return;
    onSubmit({ text: text.trim(), tier });
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="text-sm"
      />

      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn("text-xs capitalize", TIER_COLORS[tier])}
        >
          {tier}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {TIER_CONSEQUENCE[tier]}
        </span>
      </div>

      {conflict && (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-medium">Conflict detected</span> — existing instruction:{" "}
            <em>&quot;{conflict}&quot;</em>
          </span>
        </div>
      )}

      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!text.trim()}
        className="w-full"
      >
        Submit instruction
      </Button>
    </div>
  );
}
