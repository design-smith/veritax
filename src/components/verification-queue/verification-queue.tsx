"use client";

import { useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type QuestionCategory = "entity-merge" | "account-mapping" | "extraction-correction" | "executed-version" | "dormancy-flag";

export interface VerificationQuestion {
  id: string;
  category: QuestionCategory;
  question: string;
  options: string[];
  evidenceText: string;
  consequenceLine: string;
}

const CATEGORY_COLORS: Record<QuestionCategory, string> = {
  "entity-merge":          "border-purple-300 bg-purple-50 text-purple-700",
  "account-mapping":       "border-blue-300 bg-blue-50 text-blue-700",
  "extraction-correction": "border-amber-300 bg-amber-50 text-amber-700",
  "executed-version":      "border-green-300 bg-green-50 text-green-700",
  "dormancy-flag":         "border-slate-300 bg-slate-50 text-slate-700",
};

interface VerificationQueueProps {
  questions: VerificationQuestion[];
  answeredCount: number;
  targetCount: number;
  onAnswer: (questionId: string, option: string) => void;
  onSkip: () => void;
  onUndo: () => void;
  className?: string;
}

export function VerificationQueue({
  questions,
  answeredCount,
  targetCount,
  onAnswer,
  onSkip,
  onUndo,
  className,
}: VerificationQueueProps) {
  const current = questions[0];
  const confidencePct = targetCount > 0 ? Math.round((answeredCount / targetCount) * 100) : 0;

  useEffect(() => {
    if (!current) return;
    function onKey(e: KeyboardEvent) {
      const idx = parseInt(e.key, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= current.options.length) {
        onAnswer(current.id, current.options[idx - 1]);
      } else if (e.key === "s") {
        onSkip();
      } else if (e.key === "u") {
        onUndo();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [current, onAnswer, onSkip, onUndo]);

  return (
    <div className={cn("space-y-5", className)}>
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>{answeredCount} of {targetCount} questions answered</span>
          <span className="text-muted-foreground">{confidencePct}% corpus confidence</span>
        </div>
        <Progress value={confidencePct} className="h-2" aria-label="Corpus confidence" />
      </div>

      {/* Empty / celebration state */}
      {!current && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="text-base font-semibold">Queue empty — all caught up!</p>
            <p className="text-sm text-muted-foreground">
              Corpus confidence: {confidencePct}% · {answeredCount} questions answered
            </p>
          </CardContent>
        </Card>
      )}

      {/* Current question card */}
      {current && (
        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Category chip + question */}
            <div className="space-y-2">
              <Badge
                variant="outline"
                className={cn("text-xs", CATEGORY_COLORS[current.category])}
              >
                {current.category}
              </Badge>
              <p className="text-base font-semibold leading-snug">{current.question}</p>
            </div>

            {/* Evidence */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Evidence</p>
              <p className="text-sm">{current.evidenceText}</p>
            </div>

            {/* Options */}
            <div className="grid gap-2">
              {current.options.map((opt, idx) => (
                <button
                  key={opt}
                  onClick={() => onAnswer(current.id, opt)}
                  className="rounded-lg border border-border px-4 py-2.5 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
                >
                  {idx + 1}. {opt}
                </button>
              ))}
            </div>

            {/* Consequence line */}
            <p className="text-xs italic text-muted-foreground">{current.consequenceLine}</p>

            {/* Keyboard hints */}
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span><kbd className="rounded border border-border px-1">s</kbd> skip</span>
              <span><kbd className="rounded border border-border px-1">u</kbd> undo last</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
