"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  isLegalTransition,
  type PipelineDocument,
  type PipelineStageId,
} from "./pipeline-data";

interface PipelineKanbanProps {
  documents: PipelineDocument[];
  onMoveStage: (docId: string, toStage: PipelineStageId) => void;
  onBatchMoveStage?: (docIds: string[], toStage: PipelineStageId) => void;
  onOpenWorkspace: (docId: string) => void;
  className?: string;
}

export function PipelineKanban({
  documents,
  onMoveStage,
  onBatchMoveStage,
  onOpenWorkspace,
  className,
}: PipelineKanbanProps) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [dragIllegal, setDragIllegal] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [batchTarget, setBatchTarget] = useState<{
    stage: PipelineStageId;
    nextStage: PipelineStageId;
    documentIds: string[];
  } | null>(null);

  function handleDrop(targetStage: PipelineStageId) {
    if (!draggingId) return;
    const doc = documents.find((d) => d.id === draggingId);
    if (!doc || !isLegalTransition(doc.stage, targetStage)) {
      setDragIllegal(true);
      setTimeout(() => setDragIllegal(false), 3000);
    }
    setDraggingId(null);
  }

  return (
    <div className={cn("space-y-3", className)}>
      {dragIllegal && (
        <Alert role="alert" variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Drag is illegal — stage moves are not allowed by dragging. Use the action buttons on each card.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {PIPELINE_STAGES.map((stage) => {
          const stageDocs = documents.filter((d) => d.stage === stage.id);
          const batchEligibleDocs = stage.nextStage
            ? stageDocs.filter((doc) => doc.blockerChips.length === 0 && isLegalTransition(doc.stage, stage.nextStage!))
            : [];
          const showBatchAction =
            onBatchMoveStage &&
            stage.id === "internal-review" &&
            stage.nextStage &&
            batchEligibleDocs.length > 0;
          return (
            <div
              key={stage.id}
              data-testid={`pipeline-col-${stage.id}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage.id)}
              className="flex w-52 shrink-0 flex-col gap-2"
            >
              {/* Column header */}
              <div className="space-y-2 rounded-md bg-muted/50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">{stage.label}</p>
                  <Badge variant="secondary" className="text-[10px]">{stageDocs.length}</Badge>
                </div>
                {showBatchAction && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-full text-[11px]"
                    onClick={() =>
                      setBatchTarget({
                        stage: stage.id,
                        nextStage: stage.nextStage!,
                        documentIds: batchEligibleDocs.map((doc) => doc.id),
                      })
                    }
                  >
                    Send all internal-approved to external review
                  </Button>
                )}
              </div>

              {/* Cards */}
              {stageDocs.map((doc) => {
                const stageConfig = PIPELINE_STAGES.find((s) => s.id === doc.stage)!;
                const isSelected = selectedCard === doc.id;
                const actionBlocked = doc.blockerChips.length > 0;
                return (
                  <div
                    key={doc.id}
                    data-testid={`pipeline-card-${doc.id}`}
                    draggable
                    onClick={() => setSelectedCard(isSelected ? null : doc.id)}
                    onDoubleClick={() => onOpenWorkspace(doc.id)}
                    onDragStart={() => setDraggingId(doc.id)}
                    className={cn(
                      "cursor-pointer rounded-lg border border-border bg-card p-3 space-y-2 transition-colors",
                      isSelected && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <p className="text-xs font-medium leading-snug">{doc.name}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-[10px]">FY{doc.fy}</Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">{doc.jurisdiction}</Badge>
                      <Badge variant="outline" className="text-[10px]">v{doc.version}</Badge>
                      {doc.redlineCount > 0 && (
                        <Badge variant="outline" className="text-[10px] border-warning/25 text-warning-soft-foreground">
                          {doc.redlineCount} changes
                        </Badge>
                      )}
                    </div>
                    {doc.blockerChips.map((chip) => (
                      <Badge key={chip} variant="destructive" className="text-[10px] w-full justify-start">
                        {chip}
                      </Badge>
                    ))}

                    {/* Stage action — visible when selected */}
                    {isSelected && stageConfig.nextStage && stageConfig.actionLabel && (
                      <Button
                        size="sm"
                        className="w-full text-xs h-7"
                        disabled={actionBlocked}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (actionBlocked) return;
                          onMoveStage(doc.id, stageConfig.nextStage!);
                        }}
                      >
                        {actionBlocked ? "Resolve blockers first" : stageConfig.actionLabel}
                      </Button>
                    )}
                    {isSelected && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full text-xs h-7 gap-1"
                        onClick={(e) => { e.stopPropagation(); onOpenWorkspace(doc.id); }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Open workspace
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {batchTarget && (
        <div role="dialog" aria-label="Batch stage confirmation" className="rounded-lg border border-border bg-card p-3">
          <p className="text-sm font-medium">Confirm batch stage move</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The following documents will move from Internal review to External review.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {batchTarget.documentIds.map((id) => {
              const doc = documents.find((item) => item.id === id);
              return doc ? <li key={id}>{doc.name}</li> : null;
            })}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                onBatchMoveStage?.(batchTarget.documentIds, batchTarget.nextStage);
                setBatchTarget(null);
              }}
            >
              Confirm batch move
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBatchTarget(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
