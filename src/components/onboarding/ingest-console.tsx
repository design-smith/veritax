"use client";

import { AlertTriangle, FileText, RefreshCw, SkipForward, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type DocType = "local-file" | "master-file" | "ica" | "benchmark" | "memo" | "other";
type ProblemType = "unreadable" | "duplicate" | "unsupported";
type FixAction = "retry" | "skip" | "mark-duplicate";

interface StreamItem {
  id: string;
  name: string;
  type: DocType;
}

interface ProblemItem {
  id: string;
  name: string;
  issue: ProblemType;
}

interface IngestCounters {
  docsTotal: number;
  docsByType: Partial<Record<DocType, number>>;
  entitiesDiscovered: number;
  agreementsFound: number;
}

interface IngestConsoleProps {
  counters: IngestCounters;
  streamItems: StreamItem[];
  problemItems: ProblemItem[];
  onContinue: () => void;
  onFixProblem: (itemId: string, action: FixAction) => void;
  className?: string;
}

const TYPE_COLORS: Record<DocType, string> = {
  "local-file": "border-transparent bg-info-soft text-info-soft-foreground",
  "master-file": "border-transparent bg-discovery-soft text-discovery-soft-foreground",
  ica: "border-transparent bg-success-soft text-success-soft-foreground",
  benchmark: "border-transparent bg-warning-soft text-warning-soft-foreground",
  memo: "border-border bg-surface-secondary text-muted-foreground",
  other: "border-border text-muted-foreground",
};

const PROBLEM_ACTIONS: Record<ProblemType, Array<{ label: string; action: FixAction; icon: React.ElementType }>> = {
  unreadable: [{ label: "Retry", action: "retry", icon: RefreshCw }],
  duplicate: [{ label: "Mark duplicate", action: "mark-duplicate", icon: Tag }, { label: "Skip", action: "skip", icon: SkipForward }],
  unsupported: [{ label: "Skip", action: "skip", icon: SkipForward }],
};

export function IngestConsole({
  counters,
  streamItems,
  problemItems,
  onContinue,
  onFixProblem,
  className,
}: IngestConsoleProps) {
  return (
    <div className={cn("space-y-6 max-w-3xl mx-auto", className)}>
      {/* Counters */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Documents ingested", value: counters.docsTotal, testId: "counter-docs" },
          { label: "Entities discovered", value: counters.entitiesDiscovered, testId: "counter-entities" },
          { label: "Agreements found", value: counters.agreementsFound, testId: "counter-agreements" },
        ].map(({ label, value, testId }) => (
          <Card key={testId}>
            <CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold" data-testid={testId}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 tablet:grid-cols-2">
        {/* Classification stream */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Classification stream</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-48">
              <div className="space-y-1 p-3">
                {streamItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-xs">{item.name}</span>
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] shrink-0", TYPE_COLORS[item.type])}
                    >
                      {item.type}
                    </Badge>
                  </div>
                ))}
                {streamItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Waiting for documents…</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Problem pile */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm">Problem pile</CardTitle>
              {problemItems.length > 0 && (
                <Badge variant="destructive" className="text-xs">{problemItems.length}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-48">
              <div className="space-y-2 p-3">
                {problemItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No problems — all documents processed cleanly.</p>
                )}
                {problemItems.map((item) => (
                  <div key={item.id} className="rounded-md border border-border bg-card p-2 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning-soft-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.name}</p>
                        <Badge variant="outline" className="text-[10px] mt-0.5">{item.issue}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {PROBLEM_ACTIONS[item.issue].map(({ label, action, icon: Icon }) => (
                        <Button
                          key={action}
                          size="sm"
                          variant="outline"
                          className="h-6 gap-1 px-2 text-[10px]"
                          onClick={() => onFixProblem(item.id, action)}
                        >
                          <Icon className="h-3 w-3" />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={onContinue} size="lg">
          Continue to Teach →
        </Button>
      </div>
    </div>
  );
}
