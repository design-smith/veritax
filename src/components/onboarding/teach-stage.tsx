"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface VerificationQuestion {
  id: string;
  question: string;
  options: string[];
  evidenceText: string;
  consequenceLine: string;
}

interface TeachStageProps {
  questions: VerificationQuestion[];
  answeredCount: number;
  targetCount: number;
  onAnswer: (questionId: string, option: string) => void;
  onSkip: () => void;
  onUndo: () => void;
  onContinue: () => void;
  className?: string;
}

export function TeachStage({
  questions,
  answeredCount,
  targetCount,
  onAnswer,
  onSkip,
  onUndo,
  onContinue,
  className,
}: TeachStageProps) {
  const current = questions[0];
  const confidencePercent = Math.round((answeredCount / targetCount) * 100);
  const canContinue = answeredCount >= targetCount;

  // Keyboard model: 1-4 select option, s skip, u undo
  useEffect(() => {
    if (!current) return;
    function handleKey(e: KeyboardEvent) {
      const idx = parseInt(e.key, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= current.options.length) {
        onAnswer(current.id, current.options[idx - 1]);
      } else if (e.key === "s") {
        onSkip();
      } else if (e.key === "u") {
        onUndo();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [current, onAnswer, onSkip, onUndo]);

  return (
    <div className={cn("space-y-6 max-w-2xl mx-auto", className)}>
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">{answeredCount} of {targetCount} questions answered</span>
          <span className="text-muted-foreground">{confidencePercent}% corpus confidence</span>
        </div>
        <Progress
          value={confidencePercent}
          className="h-2"
          aria-label="Corpus confidence"
        />
      </div>

      {/* Question card */}
      {current ? (
        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Question */}
            <p className="text-base font-semibold">{current.question}</p>

            {/* Evidence */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Evidence</p>
              <p className="text-sm">{current.evidenceText}</p>
            </div>

            {/* Options */}
            <div className="grid gap-2">
              {current.options.map((option, idx) => (
                <button
                  key={option}
                  onClick={() => onAnswer(current.id, option)}
                  className="rounded-lg border border-border px-4 py-3 text-left text-sm transition-colors hover:border-primary hover:bg-primary/5"
                >
                  {idx + 1}. {option}
                </button>
              ))}
            </div>

            {/* Consequence line */}
            <p className="text-xs text-muted-foreground italic">{current.consequenceLine}</p>

            {/* Controls */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="cursor-pointer hover:text-foreground" onClick={onSkip}>
                <kbd className="rounded border border-border px-1">s</kbd> skip
              </span>
              <span className="cursor-pointer hover:text-foreground" onClick={onUndo}>
                <kbd className="rounded border border-border px-1">u</kbd> undo last
              </span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">All questions answered!</p>
            <p className="text-xs text-muted-foreground mt-1">Corpus confidence: {confidencePercent}%</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="flex justify-end">
        <Button onClick={onContinue} disabled={!canContinue} size="lg">
          Continue to Reveal →
        </Button>
      </div>
    </div>
  );
}
