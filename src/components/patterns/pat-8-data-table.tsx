"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
}

type SortDir = "asc" | "desc" | null;
type Density = "compact" | "comfortable" | "spacious";

interface SavedView {
  id: string;
  label: string;
  filterText: string;
}

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  onRowOpen?: (row: T) => void;
  onRowEdit?: (row: T) => void;
  onRowComment?: (row: T) => void;
  onRowJump?: (row: T) => void;
  onRowSelect?: (rows: T[]) => void;
  bulkActions?: React.ReactNode;
  emptyState?: React.ReactNode;
  enableFiltering?: boolean;
  enableDensity?: boolean;
  enableSavedViews?: boolean;
  shareBasePath?: string;
  onShareView?: (href: string) => void;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onRowOpen,
  onRowEdit,
  onRowComment,
  onRowJump,
  onRowSelect,
  bulkActions,
  emptyState,
  enableFiltering = false,
  enableDensity = false,
  enableSavedViews = false,
  shareBasePath,
  onShareView,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [filterText, setFilterText] = useState("");
  const [density, setDensity] = useState<Density>("comfortable");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  const filteredData = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return data;
    return data.filter((row) =>
      columns
        .map((col) => String(col.render(row) ?? ""))
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [columns, data, filterText]);

  // Sort
  const sorted = useMemo(() => [...filteredData].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return 0;
    const aVal = String(col.render(a) ?? "");
    const bVal = String(col.render(b) ?? "");
    return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  }), [columns, filteredData, sortDir, sortKey]);

  function handleSortClick(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  }

  const toggleSelect = useCallback((row: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.add(row.id);
      }
      return next;
    });
    // Notify parent after next render — read current selected from closure
    const next = new Set(selected);
    if (next.has(row.id)) { next.delete(row.id); } else { next.add(row.id); }
    onRowSelect?.(sorted.filter((r) => next.has(r.id)));
  }, [onRowSelect, selected, sorted]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "j") {
        setFocusedIndex((i) => Math.min(i + 1, sorted.length - 1));
      } else if (e.key === "k") {
        setFocusedIndex((i) => Math.max(i - 1, 0));
      } else if ((e.key === "o" || e.key === "Enter") && focusedIndex >= 0) {
        onRowOpen?.(sorted[focusedIndex]);
      } else if (e.key === "x" && focusedIndex >= 0) {
        toggleSelect(sorted[focusedIndex]);
      } else if (e.key === "e" && focusedIndex >= 0) {
        onRowEdit?.(sorted[focusedIndex]);
      } else if (e.key === "c" && focusedIndex >= 0) {
        onRowComment?.(sorted[focusedIndex]);
      } else if (e.key === "g" && focusedIndex >= 0) {
        onRowJump?.(sorted[focusedIndex]);
      }
    },
    [sorted, focusedIndex, onRowOpen, onRowEdit, onRowComment, onRowJump, toggleSelect],
  );

  const hasSelection = selected.size > 0;
  const hasToolbar = enableFiltering || enableDensity || enableSavedViews || Boolean(shareBasePath || onShareView);

  function handleSaveView() {
    setSavedViews((views) => [
      ...views,
      {
        id: `view-${views.length + 1}`,
        label: `View ${views.length + 1}`,
        filterText,
      },
    ]);
  }

  function handleShareView() {
    const params = new URLSearchParams();
    if (filterText) params.set("filter", filterText);
    if (sortKey && sortDir) {
      params.set("sort", sortKey);
      params.set("dir", sortDir);
    }
    const href = `${shareBasePath ?? "#"}${params.toString() ? `?${params.toString()}` : ""}`;
    onShareView?.(href);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-2">
          {enableFiltering && (
            <label className="flex min-w-48 flex-1 items-center gap-2 text-xs text-muted-foreground">
              <span>Filter table</span>
              <input
                aria-label="Filter table"
                value={filterText}
                onChange={(event) => setFilterText(event.target.value)}
                className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/35"
                placeholder="Filter rows..."
              />
            </label>
          )}
          {enableDensity && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Density</span>
              <select
                aria-label="Density"
                value={density}
                onChange={(event) => setDensity(event.target.value as Density)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
              >
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="spacious">Spacious</option>
              </select>
            </label>
          )}
          {enableSavedViews && (
            <div className="flex flex-wrap items-center gap-1">
              <Button size="sm" variant="outline" onClick={handleSaveView}>
                Save view
              </Button>
              {savedViews.map((view) => (
                <Button
                  key={view.id}
                  size="sm"
                  variant="ghost"
                  onClick={() => setFilterText(view.filterText)}
                >
                  {view.label}
                </Button>
              ))}
            </div>
          )}
          {(shareBasePath || onShareView) && (
            <Button size="sm" variant="ghost" onClick={handleShareView}>
              Share view
            </Button>
          )}
        </div>
      )}

      {/* Bulk actions bar */}
      {hasSelection && (
        <div
          role="region"
          aria-label="bulk actions"
          className="flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 px-4 py-2"
        >
          <span className="text-sm font-medium">{selected.size} selected</span>
          {bulkActions}
        </div>
      )}

      <div>
        <Table
          tabIndex={0}
          onKeyDown={handleKeyDown}
          data-density={density}
          className="focus:outline-none"
        >
          <TableHeader>
            <TableRow>
              {onRowSelect && <TableHead className="w-10"><span className="sr-only">Select</span></TableHead>}
              {columns.map((col) => (
                <TableHead key={col.key}>
                  {col.sortable ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-auto p-1 font-medium"
                      aria-label={`Sort by ${col.header.toLowerCase()}`}
                      onClick={() => handleSortClick(col.key)}
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
                      )}
                    </Button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 && emptyState ? (
              <TableRow>
                <TableCell colSpan={columns.length + (onRowSelect ? 1 : 0)}>
                  {emptyState}
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row, idx) => (
                <TableRow
                  key={row.id}
                  data-testid={`row-${row.id}`}
                  className={cn(
                    "cursor-pointer",
                    selected.has(row.id) && "bg-primary/5",
                    focusedIndex === idx && "focused ring-1 ring-inset ring-primary/40",
                  )}
                  onClick={() => onRowOpen?.(row)}
                >
                  {onRowSelect && (
                    <TableCell onClick={(e) => { e.stopPropagation(); toggleSelect(row); }}>
                      <Checkbox checked={selected.has(row.id)} />
                    </TableCell>
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      data-testid={`cell-${col.key}`}
                      className={cn(
                        density === "compact" && "py-1.5 text-xs",
                        density === "spacious" && "py-4",
                      )}
                    >
                      {col.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
