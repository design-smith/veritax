"use client";

import { useCallback, useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { CitationChip } from "@/components/patterns/pat-1-citation-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  createVerificationAnswerSubmittedEvent,
  DEMO_FRONTEND_TELEMETRY_CONTEXT,
  recordFrontendTelemetryEvent,
} from "@/lib/telemetry/product-telemetry";
import { cn } from "@/lib/utils";

export type QuestionCategory =
  | "entity-merge"
  | "account-mapping"
  | "extraction-correction"
  | "executed-version"
  | "dormancy-flag"
  | "allocation-key";

export interface VerificationQuestion {
  id: string;
  category: QuestionCategory;
  question: string;
  options: string[];
  evidenceText: string;
  consequenceLine: string;
}

const CATEGORY_COLORS: Record<QuestionCategory, string> = {
  "entity-merge":          "border-transparent bg-discovery-soft text-discovery-soft-foreground",
  "account-mapping":       "border-transparent bg-info-soft text-info-soft-foreground",
  "extraction-correction": "border-transparent bg-warning-soft text-warning-soft-foreground",
  "executed-version":      "border-transparent bg-success-soft text-success-soft-foreground",
  "dormancy-flag":         "border-border bg-surface-secondary text-muted-foreground",
  "allocation-key":         "border-transparent bg-discovery-soft text-discovery-soft-foreground",
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

function CategoryCardDetail({ question }: { question: VerificationQuestion }) {
  if (question.category === "entity-merge") {
    return (
      <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
        <p className="text-xs font-medium text-muted-foreground sm:col-span-2">Side-by-side profiles</p>
        <div className="rounded-md border border-border bg-surface p-2">
          <p className="text-sm font-medium">Veritax Corp (US)</p>
          <p className="text-xs text-muted-foreground">EIN 12-3456789 - principal - active</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-2">
          <p className="text-sm font-medium">Veritax Holdings Inc</p>
          <p className="text-xs text-muted-foreground">EIN 12-3456789 - holding company - active</p>
        </div>
      </div>
    );
  }

  if (question.category === "executed-version") {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">Version diff</p>
        <p className="mt-1 text-sm">v3 is draft-only. v1 is the executed version with signature manifest.</p>
      </div>
    );
  }

  if (question.category === "account-mapping") {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">Account mapping candidate</p>
        <p className="mt-1 text-sm">GL 47200 {"->"} IC royalties, 91% confidence, 87% coverage.</p>
      </div>
    );
  }

  if (question.category === "dormancy-flag") {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">Dormancy check</p>
        <p className="mt-1 text-sm">No ledger activity after 2023-12-31, but FY2024 filing evidence exists.</p>
      </div>
    );
  }

  if (question.category === "allocation-key") {
    return (
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">Allocation-key confirmation</p>
        <p className="mt-1 text-sm">Headcount basis source reconciles to payroll extract as of FY2024 Q4.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">Extraction correction</p>
      <p className="mt-1 text-sm">Click the cited field to send a verification answer with provenance.</p>
    </div>
  );
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

  const submitAnswer = useCallback((option: string, optionIndex: number) => {
    if (!current) return;

    recordFrontendTelemetryEvent(
      createVerificationAnswerSubmittedEvent({
        ...DEMO_FRONTEND_TELEMETRY_CONTEXT,
        category: current.category,
        answerIndex: optionIndex + 1,
      }),
    );
    onAnswer(current.id, option);
  }, [current, onAnswer]);

  useEffect(() => {
    if (!current) return;
    function onKey(e: KeyboardEvent) {
      const idx = parseInt(e.key, 10);
      if (!isNaN(idx) && idx >= 1 && idx <= current.options.length) {
        submitAnswer(current.options[idx - 1], idx - 1);
      } else if (e.key === "s") {
        onSkip();
      } else if (e.key === "u") {
        onUndo();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [current, onSkip, onUndo, submitAnswer]);

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
            <CheckCircle className="h-10 w-10 text-success-soft-foreground" />
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
              <div className="mt-2 flex flex-wrap gap-2">
                <CitationChip
                  docName="Record evidence packet"
                  section="evidence"
                  confidence={0.91}
                  extractorVersion="extractor-2024.11"
                  snippet={current.evidenceText}
                  telemetrySurface="verification-queue"
                  telemetryObjectRef={{ objectType: "verification-question", objectId: current.id }}
                />
              </div>
            </div>

            <CategoryCardDetail question={current} />

            {/* Options */}
            <div className="grid gap-2">
              {current.options.map((opt, idx) => (
                <button
                  key={opt}
                  onClick={() => submitAnswer(opt, idx)}
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
