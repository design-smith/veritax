"use client";

import { Edit3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface Extraction {
  id: string;
  fieldName: string;
  value: string;
  confidence: number;
  spanId: string;
  sourceSection: string;
}

interface ViewerExtractionsTabProps {
  extractions: Extraction[];
  onFieldClick: (spanId: string) => void;
  onCorrect: (extractionId: string) => void;
}

function confidenceColor(conf: number): string {
  if (conf >= 0.9) return "text-green-600";
  if (conf >= 0.7) return "text-amber-600";
  return "text-destructive";
}

export function ViewerExtractionsTab({ extractions, onFieldClick, onCorrect }: ViewerExtractionsTabProps) {
  return (
    <div className="divide-y divide-border">
      {extractions.map((ex) => (
        <div key={ex.id} className="flex items-start gap-2 py-2">
          <button
            className="flex flex-1 flex-col gap-0.5 text-left"
            onClick={() => onFieldClick(ex.spanId)}
          >
            <span className="text-xs font-medium">{ex.fieldName}</span>
            <span className="text-sm text-foreground">{ex.value}</span>
            <div className="flex items-center gap-2">
              <span className={cn("text-[10px]", confidenceColor(ex.confidence))}>
                {Math.round(ex.confidence * 100)}%
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">{ex.sourceSection}</span>
            </div>
          </button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 shrink-0 px-2 text-xs"
            aria-label="Correct"
            onClick={() => onCorrect(ex.id)}
          >
            <Edit3 className="h-3 w-3" />
            Correct
          </Button>
        </div>
      ))}
    </div>
  );
}
