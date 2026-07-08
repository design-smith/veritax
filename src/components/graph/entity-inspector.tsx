"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyLinkButton } from "@/components/patterns/copy-link-button";
import { EmptyState } from "@/components/surface-states";
import type { Entity } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const TAB_NAMES = ["Overview", "Financials", "Substance", "Pillar 2", "Agreements", "Findings", "Filings", "Audit history"] as const;

interface EntityInspectorProps {
  entity: Entity;
  onClose: () => void;
  className?: string;
}

export function EntityInspector({ entity, onClose, className }: EntityInspectorProps) {
  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="space-y-1 min-w-0">
          <h2 className="truncate text-base font-semibold leading-tight">{entity.name}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">
              {entity.role}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {entity.jurisdictionCode}
            </Badge>
            <span className="text-xs text-muted-foreground">as-of <span>{entity.asOf}</span></span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CopyLinkButton target={{ type: "entity", id: entity.id }} className="h-7 w-7" />
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Close" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="Overview" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="w-full justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-0 shrink-0">
          {TAB_NAMES.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-none border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_NAMES.map((tab) => (
          <TabsContent key={tab} value={tab} className="flex-1 overflow-y-auto p-4 mt-0">
            <EmptyState
              heading={tab}
              description={`${tab} data for ${entity.name} loads here.`}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
