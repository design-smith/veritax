"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { AskSearchResult } from "./ask-search";
import { cn } from "@/lib/utils";

interface GoToResultsProps {
  results: AskSearchResult;
  onNavigate: (href: string) => void;
  className?: string;
}

const SECTION_LABELS: Record<keyof AskSearchResult, string> = {
  entities: "Entities",
  flows: "Flows",
  findings: "Findings",
  documents: "Documents",
  runs: "Runs",
};

function ResultItem({
  label,
  sublabel,
  typeBadge,
  onClick,
}: {
  label: string;
  sublabel?: string;
  typeBadge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted"
    >
      {typeBadge && (
        <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px]">{typeBadge}</Badge>
      )}
      <div className="min-w-0">
        <p className="text-sm truncate">{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground truncate">{sublabel}</p>}
      </div>
    </button>
  );
}

export function GoToResults({ results, onNavigate, className }: GoToResultsProps) {
  const totalResults = Object.values(results).reduce((s, arr) => s + arr.length, 0);

  if (totalResults === 0) {
    return (
      <p className={cn("py-6 text-center text-xs text-muted-foreground", className)}>
        Nothing found — try a different search
      </p>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {/* Entities */}
      {results.entities.length > 0 && (
        <div>
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {SECTION_LABELS.entities}
          </p>
          {results.entities.map((e) => (
            <ResultItem
              key={e.id}
              label={e.name}
              sublabel={`${e.jurisdictionCode} · ${e.role}`}
              typeBadge="entity"
              onClick={() => onNavigate(`/graph/entities/${e.id}`)}
            />
          ))}
        </div>
      )}

      {/* Flows */}
      {results.flows.length > 0 && (
        <div>
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {SECTION_LABELS.flows}
          </p>
          {results.flows.map((f) => (
            <ResultItem
              key={f.id}
              label={`Flow ${f.id} — ${f.kind}`}
              sublabel={`${f.status} · ${f.method}`}
              typeBadge="flow"
              onClick={() => onNavigate(`/graph/flows/${f.id}`)}
            />
          ))}
        </div>
      )}

      {/* Findings */}
      {results.findings.length > 0 && (
        <div>
          {(results.entities.length > 0 || results.flows.length > 0) && <Separator className="my-1" />}
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {SECTION_LABELS.findings}
          </p>
          {results.findings.map((f) => (
            <ResultItem
              key={f.id}
              label={f.id}
              sublabel={f.title}
              typeBadge={f.severity}
              onClick={() => onNavigate(`/findings/${f.id}`)}
            />
          ))}
        </div>
      )}

      {/* Documents */}
      {results.documents.length > 0 && (
        <div>
          <Separator className="my-1" />
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {SECTION_LABELS.documents}
          </p>
          {results.documents.map((d) => (
            <ResultItem
              key={d.id}
              label={d.name}
              sublabel={`${d.type} · ${d.jurisdiction} · FY${d.fy}`}
              typeBadge={d.custody}
              onClick={() => onNavigate(`/library/${d.id}`)}
            />
          ))}
        </div>
      )}

      {/* Runs */}
      {results.runs.length > 0 && (
        <div>
          <Separator className="my-1" />
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {SECTION_LABELS.runs}
          </p>
          {results.runs.map((r) => (
            <ResultItem
              key={r.id}
              label={r.stage}
              sublabel={`${r.scope} · ${r.status}`}
              typeBadge="run"
              onClick={() => onNavigate(`/runs/${r.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
