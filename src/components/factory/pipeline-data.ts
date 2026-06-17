export type PipelineStageId =
  | "queued"
  | "generating"
  | "self-check"
  | "internal-review"
  | "external-review"
  | "signed"
  | "filed";

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  nextStage: PipelineStageId | null;
  actionLabel: string | null;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { id: "queued",           label: "Queued",           nextStage: "generating",     actionLabel: "Generate" },
  { id: "generating",       label: "Generating",       nextStage: "self-check",     actionLabel: null },
  { id: "self-check",       label: "Self-check",       nextStage: "internal-review",actionLabel: "Send to internal review" },
  { id: "internal-review",  label: "Internal review",  nextStage: "external-review",actionLabel: "Send to external review" },
  { id: "external-review",  label: "External review",  nextStage: "signed",         actionLabel: "Request sign-off" },
  { id: "signed",           label: "Signed",           nextStage: "filed",          actionLabel: "Mark filed" },
  { id: "filed",            label: "Filed",            nextStage: null,             actionLabel: null },
];

const STAGE_ORDER: Record<PipelineStageId, number> = Object.fromEntries(
  PIPELINE_STAGES.map(({ id }, i) => [id, i])
) as Record<PipelineStageId, number>;

/** Only allow advancing to the immediately next stage — never backwards, never skipping. */
export function isLegalTransition(from: PipelineStageId, to: PipelineStageId): boolean {
  const fromIdx = STAGE_ORDER[from];
  const toIdx   = STAGE_ORDER[to];
  return toIdx === fromIdx + 1;
}

export interface PipelineDocument {
  id: string;
  name: string;
  fy: string;
  jurisdiction: string;
  version: number;
  stage: PipelineStageId;
  redlineCount: number;
  blockerChips: string[];
}
