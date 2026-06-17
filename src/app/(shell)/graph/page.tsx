"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityInspector } from "@/components/graph/entity-inspector";
import { FlowInspector } from "@/components/graph/flow-inspector";
import { applyGraphFilters, toggleFilter } from "@/components/graph/graph-filters";
import { searchGraphNodes } from "@/components/graph/graph-search-selection";
import { toGraphNodes, toGraphEdges } from "@/components/graph/graph-data";
import { mockEntities, mockFlows } from "@/lib/mock";
import type { Entity, Flow } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const ALL_STATUSES: Flow["status"][] = ["verified", "exception", "drift"];
const ALL_KINDS: Flow["kind"][] = ["royalty", "service", "loan", "goods", "guarantee"];

const STATUS_COLORS: Record<Flow["status"], string> = {
  verified: "border-green-300 bg-green-50 text-green-700",
  drift:    "border-amber-300 bg-amber-50 text-amber-700",
  exception:"border-red-300 bg-red-50 text-red-700",
};

const noop = () => {};

export default function GraphPage() {
  const router = useRouter();
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<Flow["status"][]>([]);
  const [kindFilters, setKindFilters] = useState<Flow["kind"][]>([]);
  const [materiality, setMateriality] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const nodes = toGraphNodes(mockEntities);
  const edges = toGraphEdges(mockFlows);
  const searchResult = searchGraphNodes(nodes, searchQuery);
  const filteredFlows = applyGraphFilters(mockFlows, {
    statuses: statusFilters,
    kinds: kindFilters,
    materialityThreshold: materiality,
  });

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* Sidebar controls */}
      <div className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-background p-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entities…"
            className="pl-8 h-8 text-sm"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-2 justify-start"
          onClick={() => setShowFilters((s) => !s)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters {(statusFilters.length + kindFilters.length) > 0 && `(${statusFilters.length + kindFilters.length})`}
        </Button>

        {showFilters && (
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Status</p>
              <div className="flex flex-wrap gap-1">
                {ALL_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilters((f) => toggleFilter(f, s))}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs transition-all",
                      statusFilters.includes(s)
                        ? STATUS_COLORS[s]
                        : "border-border text-muted-foreground hover:border-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Transaction type</p>
              <div className="flex flex-wrap gap-1">
                {ALL_KINDS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setKindFilters((f) => toggleFilter(f, k))}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-xs transition-all",
                      kindFilters.includes(k) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Materiality threshold: {materiality > 0 ? `$${(materiality / 1_000_000).toFixed(1)}M` : "None"}
              </p>
              <input
                type="range"
                value={materiality}
                onChange={(e) => setMateriality(Number(e.target.value))}
                min={0}
                max={5_000_000}
                step={100_000}
                className="mt-2 w-full accent-primary"
              />
            </div>
          </div>
        )}

        {/* Entity list */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Entities ({searchResult.matchIds.length})
          </p>
          {mockEntities
            .filter((e) => searchResult.matchIds.includes(e.id))
            .map((entity) => (
              <button
                key={entity.id}
                onClick={() => { setSelectedEntity(entity); setSelectedFlow(null); }}
                className={cn(
                  "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  selectedEntity?.id === entity.id && "bg-muted font-medium",
                )}
              >
                <span className="block truncate">{entity.name}</span>
                <span className="text-xs text-muted-foreground">{entity.jurisdictionCode}</span>
              </button>
            ))}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Flows ({filteredFlows.length})
          </p>
          {filteredFlows.slice(0, 8).map((flow) => {
            const from = mockEntities.find((e) => e.id === flow.fromEntityId);
            const to = mockEntities.find((e) => e.id === flow.toEntityId);
            return (
              <button
                key={flow.id}
                onClick={() => { setSelectedFlow(flow); setSelectedEntity(null); }}
                className={cn(
                  "w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                  selectedFlow?.id === flow.id && "bg-muted font-medium",
                )}
              >
                <span className="block truncate text-xs">{from?.name} → {to?.name}</span>
                <Badge
                  variant="outline"
                  className={cn("text-[10px] mt-0.5", STATUS_COLORS[flow.status])}
                >
                  {flow.kind}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* Canvas placeholder */}
      <div className="flex-1 bg-muted/20 flex items-center justify-center relative">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Interactive canvas</p>
          <p className="text-xs text-muted-foreground">
            React Flow canvas renders entity nodes and flow edges here.
          </p>
          <p className="text-xs text-muted-foreground">
            {mockEntities.length} entities · {filteredFlows.length} flows visible
          </p>
          <div className="flex gap-2 justify-center flex-wrap mt-4">
            {mockEntities.map((e) => (
              <button
                key={e.id}
                onClick={() => { setSelectedEntity(e); setSelectedFlow(null); }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-sm hover:border-primary transition-colors"
              >
                <div className="font-medium">{e.name}</div>
                <div className="text-muted-foreground">{e.jurisdictionCode}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right inspector panel */}
      {(selectedEntity || selectedFlow) && (
        <div className="w-80 shrink-0 border-l border-border overflow-hidden">
          {selectedEntity && (
            <EntityInspector
              entity={selectedEntity}
              onClose={() => setSelectedEntity(null)}
            />
          )}
          {selectedFlow && (() => {
            const from = mockEntities.find((e) => e.id === selectedFlow.fromEntityId);
            const to = mockEntities.find((e) => e.id === selectedFlow.toEntityId);
            if (!from || !to) return null;
            return (
              <FlowInspector
                flow={selectedFlow}
                fromEntity={from}
                toEntity={to}
                onClose={() => setSelectedFlow(null)}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}
