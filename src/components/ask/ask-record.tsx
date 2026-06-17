"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AnswerBrief } from "./answer-brief";
import { GoToResults } from "./goto-results";
import { RunModePanel, type AskStage } from "./run-mode-panel";
import { CreateModePanel } from "./create-mode-panel";
import { inferAskMode } from "./ask-mode";
import { searchAskObjects } from "./ask-search";
import { mockEntities, mockFlows, mockFindings, mockDocuments, mockRuns, mockUsers } from "@/lib/mock";
import { cn } from "@/lib/utils";

const CORPUS = {
  entities: mockEntities,
  flows: mockFlows,
  findings: mockFindings,
  documents: mockDocuments,
  runs: mockRuns,
};

const DEMO_STAGES: AskStage[] = [
  { id: "ic-scan", name: "IC Scan", description: "Scan all intercompany flows for TP issues", tier: "run" },
  { id: "local-file-generate", name: "Local File Generate", description: "Generate a local file for an entity", tier: "run" },
  { id: "benchmark-refresh", name: "Benchmark Refresh", description: "Refresh comparable set from license database", tier: "methodology" },
  { id: "pillar2-compute", name: "Pillar 2 Compute", description: "Compute GloBE ETR for all jurisdictions", tier: "run" },
];

const MODE_LABELS = { ask: "ask", goto: "go-to", run: "run", create: "create" } as const;
const MODE_COLORS = {
  ask: "border-primary/30 bg-primary/5 text-primary",
  goto: "border-blue-300 bg-blue-50 text-blue-700",
  run: "border-green-300 bg-green-50 text-green-700",
  create: "border-purple-300 bg-purple-50 text-purple-700",
} as const;

const DEMO_ANSWER = {
  question: "",
  answer: "The royalty rate charged to Veritax UK Ltd is 18.0%, which exceeds the arm's length range of 10–14% established by the CUT benchmark study (v.418). This is classified as an exception finding (fn1, severity: critical).",
  exhibits: [
    { id: "ex1", docName: "UK Local File FY2024", section: "§4.2", confidence: 0.91, extractorVersion: "v2.4.1", snippet: "The royalty rate applied is 18%" },
    { id: "ex2", docName: "TP Policy FY2024", section: "§3.1", confidence: 0.95, extractorVersion: "v2.4.1", snippet: "Policy rate shall be 12%" },
  ],
  confidence: 0.88,
};

interface AskRecordProps {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function AskRecord({ open, onClose, initialQuery = "" }: AskRecordProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [showAnswer, setShowAnswer] = useState(false);

  const { mode, payload } = inferAskMode(query, true);
  const gotoResults = mode === "goto" ? searchAskObjects(payload, CORPUS) : null;

  useEffect(() => {
    if (open) { setQuery(initialQuery); setShowAnswer(false); }
  }, [open, initialQuery]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleNavigate(href: string) {
    onClose();
    router.push(href);
  }

  function handleAskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "ask" && query.trim()) setShowAnswer(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Input */}
        <form onSubmit={handleAskSubmit}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Badge variant="outline" className={cn("shrink-0 text-xs", MODE_COLORS[mode])}>
              {MODE_LABELS[mode]}
            </Badge>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowAnswer(false); }}
              placeholder="Ask anything · @go-to · >run · /create"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="text-xs text-muted-foreground">Esc</kbd>
          </div>
        </form>

        {/* Results panel */}
        <div className="max-h-[28rem] overflow-y-auto">
          {!query.trim() && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Start typing to ask, search, or launch a stage
            </p>
          )}

          {/* Ask mode — answer */}
          {mode === "ask" && showAnswer && (
            <div className="p-4">
              <AnswerBrief
                {...DEMO_ANSWER}
                question={query}
                onOpenAsView={() => { onClose(); router.push("/findings"); }}
                onExport={() => {}}
                onSave={() => { onClose(); router.push("/ask/saved"); }}
                onEscalate={() => {}}
              />
            </div>
          )}

          {/* Go-to mode */}
          {mode === "goto" && gotoResults && (
            <GoToResults results={gotoResults} onNavigate={handleNavigate} />
          )}

          {/* Run mode */}
          {mode === "run" && (
            <RunModePanel
              payload={payload}
              stages={DEMO_STAGES}
              onSelectStage={(id) => { onClose(); router.push(`/runs?stage=${id}`); }}
            />
          )}

          {/* Create mode */}
          {mode === "create" && (
            <CreateModePanel
              users={mockUsers}
              onSubmit={(payload) => { onClose(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
