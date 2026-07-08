"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Download,
  GitBranch,
  Network,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EntityInspector } from "@/components/graph/entity-inspector";
import { FlowInspector } from "@/components/graph/flow-inspector";
import { ExportDialog } from "@/components/patterns/pat-10-export";
import type { Entity, Flow } from "@/lib/mock/types";
import { cn } from "@/lib/utils";
import { toGraphEdges, toGraphNodes, type GraphNode } from "./graph-data";
import { applyGraphFilters, toggleFilter } from "./graph-filters";
import {
  computeSelectionState,
  searchGraphNodes,
} from "./graph-search-selection";
import {
  detectStructuralChanges,
  toOwnershipEdges,
  toTreeNodes,
  type OwnershipEntry,
} from "./graph-tree";

type GraphMode = "map" | "tree";

export interface GraphWorkspaceCommand {
  type: "export";
  payload: {
    format: string;
    destination: string;
    mode: GraphMode;
    asOf: string;
  };
}

interface GraphWorkspaceProps {
  entities: Entity[];
  flows: Flow[];
  ownership?: OwnershipEntry[];
  previousOwnership?: OwnershipEntry[];
  onOpenEntityPage?: (entityId: string) => void;
  onOpenFlowPage?: (flowId: string) => void;
  onCommand?: (command: GraphWorkspaceCommand) => void;
  className?: string;
}

const ALL_STATUSES: Flow["status"][] = ["exception", "drift", "verified"];
const ALL_KINDS: Flow["kind"][] = ["royalty", "service", "loan", "goods", "guarantee"];
const MATERIALITY_KEY = "veritax:graph:materiality-threshold";

export const DEFAULT_OWNERSHIP: OwnershipEntry[] = [
  { parentId: "e1", childId: "e2", ownershipPct: 100, elections: ["check-the-box"] },
  { parentId: "e1", childId: "e3", ownershipPct: 100, elections: [] },
  { parentId: "e1", childId: "e4", ownershipPct: 100, elections: ["disregarded-entity"] },
  { parentId: "e1", childId: "e5", ownershipPct: 100, elections: [] },
  { parentId: "e1", childId: "e6", ownershipPct: 100, elections: ["branch-election"] },
];

export const PREVIOUS_OWNERSHIP: OwnershipEntry[] = [
  { parentId: "e1", childId: "e2", ownershipPct: 100, elections: ["check-the-box"] },
  { parentId: "e1", childId: "e3", ownershipPct: 95, elections: [] },
  { parentId: "e1", childId: "e4", ownershipPct: 100, elections: ["disregarded-entity"] },
  { parentId: "e1", childId: "e5", ownershipPct: 100, elections: [] },
];

const STATUS_CLASSES: Record<Flow["status"], string> = {
  exception: "border-danger/25 bg-danger-soft text-danger-soft-foreground",
  drift: "border-warning/25 bg-warning-soft text-warning-soft-foreground",
  verified: "border-success/25 bg-success-soft text-success-soft-foreground",
};

function formatMoney(value: number, currency = "USD") {
  const amount = Math.abs(value) >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)}M` : value.toLocaleString();
  return `${currency} ${amount}`;
}

function readMateriality() {
  if (typeof window === "undefined") return 0;
  const saved = window.localStorage.getItem(MATERIALITY_KEY);
  return saved ? Number(saved) || 0 : 0;
}

function entityById(entities: Entity[]) {
  return new Map(entities.map((entity) => [entity.id, entity]));
}

function nodePosition(node: GraphNode) {
  return {
    left: 12 + (node.position.x / 750) * 70,
    top: 18 + (node.position.y / 500) * 58,
  };
}

export function GraphWorkspace({
  entities,
  flows,
  ownership = DEFAULT_OWNERSHIP,
  previousOwnership = PREVIOUS_OWNERSHIP,
  onOpenEntityPage,
  onOpenFlowPage,
  onCommand,
  className,
}: GraphWorkspaceProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<GraphMode>("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<Flow["status"][]>([]);
  const [kindFilters, setKindFilters] = useState<Flow["kind"][]>([]);
  const [materiality, setMateriality] = useState(readMateriality);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedFlowIds, setSelectedFlowIds] = useState<string[]>([]);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const nodes = useMemo(() => toGraphNodes(entities), [entities]);
  const edges = useMemo(() => toGraphEdges(flows), [flows]);
  const entitiesById = useMemo(() => entityById(entities), [entities]);
  const filteredFlows = useMemo(
    () =>
      applyGraphFilters(flows, {
        statuses: statusFilters,
        kinds: kindFilters,
        materialityThreshold: materiality,
      }),
    [flows, kindFilters, materiality, statusFilters],
  );
  const searchResult = useMemo(() => searchGraphNodes(nodes, searchQuery), [nodes, searchQuery]);
  const matchingNodeIds = new Set(searchResult.matchIds);
  const selectionState = useMemo(
    () => computeSelectionState(nodes, edges, selectedEntityIds),
    [edges, nodes, selectedEntityIds],
  );
  const dimmedNodeIds = new Set(selectionState.dimmedNodeIds);
  const selectedEntity = selectedEntityIds.length === 1 ? entitiesById.get(selectedEntityIds[0]) : undefined;
  const selectedFlow = selectedFlowId ? flows.find((flow) => flow.id === selectedFlowId) : undefined;
  const compareFlows = selectedFlowIds
    .map((flowId) => flows.find((flow) => flow.id === flowId))
    .filter((flow): flow is Flow => Boolean(flow));
  const selectedAsOf = entities[0]?.asOf ?? "current";

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MATERIALITY_KEY, String(materiality));
    }
  }, [materiality]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        event.key === "/" &&
        target?.tagName !== "INPUT" &&
        target?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function selectEntity(entityId: string, additive: boolean) {
    setSelectedFlowId(null);
    setSelectedFlowIds([]);
    setSelectedEntityIds((current) => {
      if (!additive) return [entityId];
      return current.includes(entityId)
        ? current.filter((id) => id !== entityId)
        : [...current, entityId];
    });
  }

  function selectFlow(flowId: string, additive: boolean) {
    setSelectedEntityIds([]);
    setSelectedFlowId(flowId);
    setSelectedFlowIds((current) => {
      if (!additive) return [flowId];
      return current.includes(flowId)
        ? current.filter((id) => id !== flowId)
        : [...current, flowId];
    });
  }

  return (
    <div className={cn("flex h-[calc(100dvh-3.5rem)] overflow-hidden bg-background", className)}>
      <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-surface-secondary p-4">
        <div className="space-y-1">
          <h1 className="text-base font-semibold">Intercompany Graph</h1>
          <p
            role="status"
            aria-label={`${entities.length} entities, ${filteredFlows.length} visible flows`}
            className="text-xs text-muted-foreground"
          >
            {entities.length} entities, {filteredFlows.length} visible flows
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "map" ? "default" : "ghost"}
            onClick={() => setMode("map")}
          >
            <Network className="h-3.5 w-3.5" />
            Map
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "tree" ? "default" : "ghost"}
            onClick={() => setMode("tree")}
          >
            <GitBranch className="h-3.5 w-3.5" />
            Tree
          </Button>
        </div>

        <label className="relative block">
          <span className="sr-only">Search graph</span>
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search graph"
            className="h-8 pl-8 text-sm"
          />
        </label>
        {searchQuery && (
          <p className="text-xs text-muted-foreground">
            Search highlights {searchResult.matchIds.length} entit{searchResult.matchIds.length === 1 ? "y" : "ies"}
          </p>
        )}

        <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilters((current) => toggleFilter(current, status))}
                  aria-pressed={statusFilters.includes(status)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs capitalize transition-colors",
                    statusFilters.includes(status)
                      ? STATUS_CLASSES[status]
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Transaction type</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setKindFilters((current) => toggleFilter(current, kind))}
                  aria-pressed={kindFilters.includes(kind)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs capitalize transition-colors",
                    kindFilters.includes(kind)
                      ? "border-info/25 bg-info-soft text-info-soft-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium" htmlFor="materiality-threshold">
              Materiality threshold:{" "}
              {materiality > 0 ? formatMoney(materiality) : "None"}
            </label>
            <input
              id="materiality-threshold"
              type="range"
              value={materiality}
              onChange={(event) => setMateriality(Number(event.target.value))}
              min={0}
              max={5_000_000}
              step={100_000}
              className="w-full accent-primary"
            />
          </div>
        </div>

        <Button variant="outline" onClick={() => setIsExportOpen(true)}>
          <Download className="h-4 w-4" />
          Export chart
        </Button>
        {exportNotice && (
          <div role="status" className="rounded-lg border border-border bg-surface p-2 text-xs text-muted-foreground">
            {exportNotice}
          </div>
        )}
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden">
        {mode === "map" ? (
          <MapCanvas
            nodes={nodes}
            flows={filteredFlows}
            entitiesById={entitiesById}
            matchingNodeIds={matchingNodeIds}
            hasSearch={Boolean(searchQuery.trim())}
            selectedEntityIds={selectedEntityIds}
            selectedFlowIds={selectedFlowIds}
            dimmedNodeIds={dimmedNodeIds}
            onSelectEntity={selectEntity}
            onSelectFlow={selectFlow}
            onOpenEntityPage={onOpenEntityPage}
            onOpenFlowPage={onOpenFlowPage}
          />
        ) : (
          <TreeCanvas
            entitiesById={entitiesById}
            ownership={ownership}
            previousOwnership={previousOwnership}
            selectedEntityIds={selectedEntityIds}
            onSelectEntity={selectEntity}
            onOpenEntityPage={onOpenEntityPage}
          />
        )}
      </main>

      {(selectedEntity || selectedFlow || compareFlows.length > 1) && (
        <aside className="w-[360px] shrink-0 overflow-hidden border-l border-border bg-background">
          {compareFlows.length > 1 ? (
            <CompareFlowsPanel
              flows={compareFlows}
              entitiesById={entitiesById}
              onClose={() => {
                setSelectedFlowIds([]);
                setSelectedFlowId(null);
              }}
            />
          ) : null}
          {compareFlows.length <= 1 && selectedEntity ? (
            <EntityInspector entity={selectedEntity} onClose={() => setSelectedEntityIds([])} />
          ) : null}
          {compareFlows.length <= 1 && selectedFlow ? (
            <FlowInspector
              flow={selectedFlow}
              fromEntity={entitiesById.get(selectedFlow.fromEntityId)!}
              toEntity={entitiesById.get(selectedFlow.toEntityId)!}
              onClose={() => {
                setSelectedFlowIds([]);
                setSelectedFlowId(null);
              }}
            />
          ) : null}
        </aside>
      )}

      <ExportDialog
        open={isExportOpen}
        artifactClass="communication"
        artifactName={`Intercompany Graph ${mode} view, as-of ${selectedAsOf}`}
        onClose={() => setIsExportOpen(false)}
        onExport={(payload) => {
          setExportNotice(`${payload.format} export queued to ${payload.destination} with as-of footer ${selectedAsOf}.`);
          setIsExportOpen(false);
          onCommand?.({
            type: "export",
            payload: {
              ...payload,
              mode,
              asOf: selectedAsOf,
            },
          });
        }}
      />
    </div>
  );
}

function MapCanvas({
  nodes,
  flows,
  entitiesById,
  matchingNodeIds,
  hasSearch,
  selectedEntityIds,
  selectedFlowIds,
  dimmedNodeIds,
  onSelectEntity,
  onSelectFlow,
  onOpenEntityPage,
  onOpenFlowPage,
}: {
  nodes: GraphNode[];
  flows: Flow[];
  entitiesById: Map<string, Entity>;
  matchingNodeIds: Set<string>;
  hasSearch: boolean;
  selectedEntityIds: string[];
  selectedFlowIds: string[];
  dimmedNodeIds: Set<string>;
  onSelectEntity: (entityId: string, additive: boolean) => void;
  onSelectFlow: (flowId: string, additive: boolean) => void;
  onOpenEntityPage?: (entityId: string) => void;
  onOpenFlowPage?: (flowId: string) => void;
}) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return (
    <section aria-label="Graph map canvas" className="relative h-full overflow-hidden bg-surface-secondary">
      <svg className="pointer-events-none absolute inset-0 h-full w-full text-border-strong" aria-hidden="true">
        {flows.map((flow) => {
          const source = nodeById.get(flow.fromEntityId);
          const target = nodeById.get(flow.toEntityId);
          if (!source || !target) return null;
          const start = nodePosition(source);
          const end = nodePosition(target);
          return (
            <line
              key={flow.id}
              x1={`${start.left}%`}
              y1={`${start.top}%`}
              x2={`${end.left}%`}
              y2={`${end.top}%`}
              stroke="currentColor"
              strokeWidth={flow.status === "exception" ? 3 : 2}
              strokeDasharray={flow.status === "drift" ? "6 4" : undefined}
            />
          );
        })}
      </svg>

      {flows.map((flow, index) => {
        const source = nodeById.get(flow.fromEntityId);
        const target = nodeById.get(flow.toEntityId);
        const from = entitiesById.get(flow.fromEntityId);
        const to = entitiesById.get(flow.toEntityId);
        if (!source || !target || !from || !to) return null;
        const start = nodePosition(source);
        const end = nodePosition(target);
        const left = (start.left + end.left) / 2;
        const top = (start.top + end.top) / 2 + (index % 3) * 2;

        return (
          <button
            key={flow.id}
            type="button"
            aria-label={`Open flow ${from.name} to ${to.name}`}
            onClick={(event) => onSelectFlow(flow.id, event.shiftKey)}
            onDoubleClick={() => onOpenFlowPage?.(flow.id)}
            className={cn(
              "absolute z-10 max-w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-surface px-2 py-1 text-left text-[11px] shadow-hairline transition",
              STATUS_CLASSES[flow.status],
              selectedFlowIds.includes(flow.id) && "ring-2 ring-ring/35",
            )}
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <span className="block truncate capitalize">{flow.kind}</span>
            <span className="block truncate font-mono">{formatMoney(flow.exposure, flow.currency)}</span>
          </button>
        );
      })}

      {nodes.map((node) => {
        const entity = entitiesById.get(node.id);
        if (!entity) return null;
        const position = nodePosition(node);
        const isSelected = selectedEntityIds.includes(node.id);
        const isDimmed = dimmedNodeIds.has(node.id);
        const isSearchHit = hasSearch && matchingNodeIds.has(node.id);
        const isHiddenBySearch = hasSearch && !matchingNodeIds.has(node.id);

        return (
          <button
            key={node.id}
            type="button"
            aria-label={`Open ${entity.name}`}
            data-graph-node={node.id}
            data-search-hit={isSearchHit ? "true" : "false"}
            onClick={(event) => onSelectEntity(node.id, event.shiftKey)}
            onDoubleClick={() => onOpenEntityPage?.(node.id)}
            className={cn(
              "absolute z-20 w-44 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-3 text-left shadow-elevation-100 transition",
              "hover:border-border-strong hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
              isSelected && "border-primary ring-2 ring-ring/35",
              isDimmed && "opacity-35",
              isSearchHit && "border-info/50 bg-info-soft",
              isHiddenBySearch && "opacity-25",
            )}
            style={{ left: `${position.left}%`, top: `${position.top}%` }}
          >
            <span className="block truncate text-sm font-semibold">{entity.name}</span>
            <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">
                {entity.jurisdictionCode}
              </Badge>
              {entity.role}
            </span>
          </button>
        );
      })}
    </section>
  );
}

function TreeCanvas({
  entitiesById,
  ownership,
  previousOwnership,
  selectedEntityIds,
  onSelectEntity,
  onOpenEntityPage,
}: {
  entitiesById: Map<string, Entity>;
  ownership: OwnershipEntry[];
  previousOwnership: OwnershipEntry[];
  selectedEntityIds: string[];
  onSelectEntity: (entityId: string, additive: boolean) => void;
  onOpenEntityPage?: (entityId: string) => void;
}) {
  const nodes = toTreeNodes(ownership);
  const edges = toOwnershipEdges(ownership);
  const structuralChanges = detectStructuralChanges(previousOwnership, ownership);
  const changedEntityIds = new Set(structuralChanges.map((change) => change.childId));

  return (
    <section aria-label="Graph tree canvas" className="h-full overflow-auto bg-surface-secondary p-6">
      <div className="mx-auto max-w-4xl space-y-3">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">Ownership tree</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Ownership percentages, elections, and structural markers are bound to the current Fiscal-Year Lens.
          </p>
        </div>

        {nodes.map((node) => {
          const entity = entitiesById.get(node.id);
          const incomingEdge = edges.find((edge) => edge.target === node.id);
          if (!entity) return null;
          return (
            <button
              key={node.id}
              type="button"
              aria-label={`Open ${entity.name} in tree`}
              onClick={(event) => onSelectEntity(entity.id, event.shiftKey)}
              onDoubleClick={() => onOpenEntityPage?.(entity.id)}
              className={cn(
                "flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface p-3 text-left shadow-hairline transition hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                selectedEntityIds.includes(entity.id) && "border-primary ring-2 ring-ring/35",
              )}
              style={{ marginLeft: `${node.depth * 32}px`, width: `calc(100% - ${node.depth * 32}px)` }}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{entity.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{entity.jurisdictionCode}</Badge>
                  <span>{entity.role}</span>
                  {incomingEdge && <span>{incomingEdge.label} owned</span>}
                  {node.elections.map((election) => (
                    <Badge key={election} variant="secondary" className="text-[10px]">
                      {election}
                    </Badge>
                  ))}
                </span>
              </span>
              {changedEntityIds.has(entity.id) && (
                <Badge variant="outline" className="border-warning/25 bg-warning-soft text-warning-soft-foreground">
                  Structural change
                </Badge>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CompareFlowsPanel({
  flows,
  entitiesById,
  onClose,
}: {
  flows: Flow[];
  entitiesById: Map<string, Entity>;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h2 className="text-base font-semibold">Compare flows</h2>
          <p className="text-xs text-muted-foreground">{flows.length} selected flows</p>
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {flows.map((flow) => {
            const from = entitiesById.get(flow.fromEntityId);
            const to = entitiesById.get(flow.toEntityId);
            return (
              <div key={flow.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="truncate">{from?.name}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{to?.name}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <Badge variant="outline" className="capitalize">{flow.kind}</Badge>
                  <Badge variant="outline">{flow.method}</Badge>
                  <Badge variant="outline" className={STATUS_CLASSES[flow.status]}>
                    {flow.status}
                  </Badge>
                  <Badge variant="outline">{formatMoney(flow.exposure, flow.currency)}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
