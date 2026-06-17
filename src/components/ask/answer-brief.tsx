"use client";

import { AlertTriangle, ArrowUpRight, Bookmark, Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CitationChip } from "@/components/patterns/pat-1-citation-chip";
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
  isRefusal = false,
  onOpenAsView,
  onExport,
  onSave,
  onEscalate,
  className,
}: AnswerBriefProps) {
  const showEscalate = confidence < CONFIDENCE_THRESHOLD && onEscalate;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Question echo */}
      <p className="text-xs text-muted-foreground">{question}</p>

      {/* Refusal notice */}
      {isRefusal && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
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
              ? "border-green-300 bg-green-50 text-green-700"
              : confidence >= CONFIDENCE_THRESHOLD
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-red-300 bg-red-50 text-red-700",
          )}
        >
          {Math.round(confidence * 100)}% confidence
        </Badge>
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpenAsView}>
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
            className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
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
