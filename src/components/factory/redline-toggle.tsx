"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, GitCompare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { computeDiff } from "./redline-diff";
import { cn } from "@/lib/utils";

interface RedlineSection {
  id: string;
  title: string;
  currentText: string;
  priorText: string;
}

interface RedlineToggleProps {
  sections: RedlineSection[];
  className?: string;
}

function RedlineText({ current, prior }: { current: string; prior: string }) {
  const changes = computeDiff(prior, current);

  if (changes.length === 0) {
    return <span>{current}</span>;
  }

  const priorWords = prior.split(/(\s+)/);
  const currWords = current.split(/(\s+)/);

  // Simple rendering: show deletions (from prior) in red, insertions (in current) in green
  const deletedWords = new Set(
    changes.filter((c) => c.type === "delete").map((c) => c.text.trim())
  );
  const insertedWords = new Set(
    changes.filter((c) => c.type === "insert").map((c) => c.text.trim())
  );

  return (
    <>
      {/* Deleted from prior */}
      {priorWords
        .filter((w) => deletedWords.has(w.trim()) && w.trim())
        .map((word, i) => (
          <span
            key={`del-${i}`}
            data-testid="redline-delete"
            className="line-through decoration-red-500 text-red-600 dark:text-red-400 mr-1"
          >
            {word}
          </span>
        ))}
      {/* Current text with inserts highlighted */}
      {currWords.map((word, i) => {
        if (!word.trim()) return <span key={i}>{word}</span>;
        if (insertedWords.has(word.trim())) {
          return (
            <span
              key={`ins-${i}`}
              data-testid="redline-insert"
              className="underline decoration-green-500 text-green-700 dark:text-green-400 mr-1"
            >
              {word}
            </span>
          );
        }
        return <span key={i}>{word} </span>;
      })}
    </>
  );
}

export function RedlineToggle({ sections, className }: RedlineToggleProps) {
  const [active, setActive] = useState(false);
  const [changeIdx, setChangeIdx] = useState(0);

  const totalChanges = sections.filter(
    (s) => computeDiff(s.priorText, s.currentText).length > 0
  ).length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          size="sm"
          variant={active ? "default" : "outline"}
          className="gap-1.5"
          onClick={() => setActive((a) => !a)}
        >
          <GitCompare className="h-4 w-4" />
          Redline vs prior
        </Button>

        {active && (
          <>
            <Badge variant="secondary" className="text-xs">
              {totalChanges} changes
            </Badge>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label="Prev change"
                onClick={() => setChangeIdx((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {changeIdx + 1} / {Math.max(1, totalChanges)}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label="Next change"
                onClick={() => setChangeIdx((i) => Math.min(totalChanges - 1, i + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.id} className="space-y-1">
            <h3 className="text-sm font-semibold">{section.title}</h3>
            <p className="text-sm leading-relaxed">
              {active ? (
                <RedlineText current={section.currentText} prior={section.priorText} />
              ) : (
                section.currentText
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
