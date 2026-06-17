"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export type SectionStatus = "generated" | "edited" | "stale" | "blocked" | "pending-self-check";

const STATUS_DOT_COLORS: Record<SectionStatus, string> = {
  generated:          "bg-green-500",
  edited:             "bg-blue-500",
  stale:              "bg-amber-500",
  blocked:            "bg-red-500",
  "pending-self-check": "bg-amber-400 animate-pulse",
};

export interface WorkspaceSection {
  id: string;
  title: string;
  status: SectionStatus;
  content: string;
  inputChips: Array<{ label: string; ref: string }>;
}

const CONTEXT_TABS = ["Sources", "Comments", "Checks"] as const;
type ContextTab = (typeof CONTEXT_TABS)[number];

interface FactoryWorkspaceProps {
  sections: WorkspaceSection[];
  onSectionSelect: (sectionId: string) => void;
  className?: string;
}

export function FactoryWorkspace({ sections, onSectionSelect, className }: FactoryWorkspaceProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "");
  const [activeContextTab, setActiveContextTab] = useState<ContextTab>("Sources");

  const currentSection = sections.find((s) => s.id === activeSection) ?? sections[0];

  function handleSectionClick(sectionId: string) {
    setActiveSection(sectionId);
    onSectionSelect(sectionId);
  }

  return (
    <div className={cn("flex h-full overflow-hidden", className)}>
      {/* ── Left: Outline panel ── */}
      <aside className="w-52 shrink-0 overflow-y-auto border-r border-border bg-muted/10">
        <div className="p-3 space-y-0.5">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Outline
          </p>
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => handleSectionClick(section.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                activeSection === section.id && "bg-muted font-medium",
              )}
            >
              <span
                data-testid={`status-dot-${section.id}`}
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  STATUS_DOT_COLORS[section.status],
                  section.status,
                )}
              />
              <span className="truncate">{section.title}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Centre: Canvas ── */}
      <main className="flex-1 overflow-y-auto">
        {currentSection && (
          <div className="px-8 py-6 max-w-3xl mx-auto space-y-4">
            {/* Section header + input chips */}
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">{currentSection.title}</h2>
              {currentSection.inputChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {currentSection.inputChips.map((chip) => (
                    <Badge key={chip.ref} variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-muted">
                      {chip.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Section content */}
            <div className="prose prose-sm max-w-none">
              <p className="text-sm leading-relaxed">{currentSection.content}</p>
            </div>

            {/* Status notice */}
            {currentSection.status === "blocked" && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                This section is blocked — resolve the conflict before exporting.
              </div>
            )}
            {currentSection.status === "stale" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Source inputs have changed. Regenerate this section.
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Right: Context panel ── */}
      <aside className="w-64 shrink-0 overflow-y-auto border-l border-border bg-muted/10">
        {/* Simple state-driven tabs (same pattern as EntityPageContent) */}
        <div role="tablist" className="flex border-b border-border">
          {CONTEXT_TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeContextTab === tab}
              onClick={() => setActiveContextTab(tab)}
              className={cn(
                "flex-1 border-b-2 py-2 text-xs transition-colors",
                activeContextTab === tab
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="p-3">
          {activeContextTab === "Sources" && (
            <p className="text-xs text-muted-foreground">Source documents for {currentSection?.title}…</p>
          )}
          {activeContextTab === "Comments" && (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          )}
          {activeContextTab === "Checks" && (
            <p className="text-xs text-muted-foreground">Self-check results appear here after regeneration.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
