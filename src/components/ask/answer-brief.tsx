"use client";

import { AlertTriangle, ArrowUpRight, Bookmark, Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CitationChip } from "@/components/patterns/pat-1-citation-chip";
import {
  createAskAnswerAcceptedEvent,
  DEMO_FRONTEND_TELEMETRY_CONTEXT,
  recordFrontendTelemetryEvent,
} from "@/lib/telemetry/product-telemetry";
import { cn } from "@/lib/utils";

const CONFIDENCE_THRESHOLD = 0.85;

export interface AnswerExhibit {
  id: string;
  docName: string;
  section: string;
  confidence: number;
  extractorVersion: string;
  snippet?: string;
}

interface AnswerBriefProps {
  question: string;
  answer: string;
  exhibits: AnswerExhibit[];
  confidence: number;
  answerId?: string;
  telemetrySurface?: string;
  isRefusal?: boolean;
  onOpenAsView: () => void;
  onExport: () => void;
  onSave: () => void;
  onEscalate?: () => void;
  className?: string;
}

export function AnswerBrief({
  question,
  answer,
  exhibits,
  confidence,
  answerId = "ask-answer",
  telemetrySurface = "ask",
  isRefusal = false,
  onOpenAsView,
  onExport,
  onSave,
  onEscalate,
  className,
}: AnswerBriefProps) {
  const showEscalate = confidence < CONFIDENCE_THRESHOLD && onEscalate;

  function handleOpenAsView() {
    recordFrontendTelemetryEvent(
      createAskAnswerAcceptedEvent({
        ...DEMO_FRONTEND_TELEMETRY_CONTEXT,
        surface: telemetrySurface,
        answerId,
        confidenceBand: confidenceBandForAnswer(confidence, isRefusal),
      }),
    );
    onOpenAsView();
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Question echo */}
      <p className="text-xs text-muted-foreground">{question}</p>

      {/* Refusal notice */}
      {isRefusal && (
        <div className="flex items-center gap-2 rounded-md border border-warning/25 bg-warning-soft p-2 text-xs text-warning-soft-foreground dark:border-warning/30 dark:bg-warning-soft dark:text-warning-soft-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>No source found — absence-evidence answer</span>
        </div>
      )}

      {/* Answer text */}
      <p className={cn("text-sm leading-relaxed", isRefusal && "italic text-muted-foreground")}>
        {answer}
      </p>

      {/* Exhibits */}
      {exhibits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Sources ({exhibits.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {exhibits.map((ex) => (
              <CitationChip
                key={ex.id}
                docName={ex.docName}
                section={ex.section}
                confidence={ex.confidence}
                extractorVersion={ex.extractorVersion}
                snippet={ex.snippet}
                telemetrySurface={telemetrySurface}
                telemetryObjectRef={{ objectType: "ask-answer", objectId: answerId }}
              />
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Confidence badge */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "text-xs",
            confidence >= 0.9
              ? "border-transparent bg-success-soft text-success-soft-foreground"
              : confidence >= CONFIDENCE_THRESHOLD
                ? "border-transparent bg-warning-soft text-warning-soft-foreground"
                : "border-transparent bg-danger-soft text-danger-soft-foreground",
          )}
        >
          {Math.round(confidence * 100)}% confidence
        </Badge>
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleOpenAsView}>
          <ExternalLink className="h-3.5 w-3.5" />
          Open as view
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onExport}>
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onSave}>
          <Bookmark className="h-3.5 w-3.5" />
          Save
        </Button>
        {showEscalate && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-warning-soft-foreground border-warning/25 hover:bg-warning-soft"
            onClick={onEscalate}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Escalate to triage
          </Button>
        )}
      </div>
    </div>
  );
}

function confidenceBandForAnswer(confidence: number, isRefusal: boolean) {
  if (isRefusal) return "refusal";
  if (confidence >= 0.9) return "high";
  if (confidence >= CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}
