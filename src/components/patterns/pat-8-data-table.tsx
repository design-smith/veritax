"use client";

import { useCallback, useState } from "react";
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

interface DataTableProps<T extends { id: string }> {
  columns: Column<T>[];
  data: T[];
  onRowOpen?: (row: T) => void;
  onRowSelect?: (rows: T[]) => void;
  bulkActions?: React.ReactNode;
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  onRowOpen,
  onRowSelect,
  bulkActions,
  emptyState,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Sort
  const sorted = [...data].sort((a, b) => {
    if (!sortKey || !sortDir) return 0;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return 0;
    const aVal = String(col.render(a) ?? "");
    const bVal = String(col.render(b) ?? "");
    return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

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

  function toggleSelect(row: T) {
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
  }

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
      }
    },
    [sorted, focusedIndex, onRowOpen],
  );

  const hasSelection = selected.size > 0;

  return (
    <div className={cn("space-y-2", className)}>
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
                    <TableCell key={col.key} data-testid={`cell-${col.key}`}>
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
