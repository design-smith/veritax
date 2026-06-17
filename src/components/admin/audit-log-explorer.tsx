"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Event } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  finding_created:    "border-red-200 text-red-700",
  finding_resolved:   "border-green-200 text-green-700",
  run_completed:      "border-blue-200 text-blue-700",
  gate_requested:     "border-amber-200 text-amber-700",
  document_ingested:  "border-purple-200 text-purple-700",
  staleness_detected: "border-amber-200 text-amber-700",
  obligation_due:     "border-red-200 text-red-700",
};

interface AuditLogExplorerProps {
  events: Event[];
  className?: string;
}

export function AuditLogExplorer({ events, className }: AuditLogExplorerProps) {
  const [search, setSearch] = useState("");

  const visible = search.trim()
    ? events.filter((e) => e.type.includes(search.toLowerCase()) || e.objectType.includes(search.toLowerCase()))
    : events;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search event types…"
          className="pl-9 h-8 text-sm"
        />
      </div>

      {/* Table — shows metadata only, NEVER content */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Timestamp", "Event type", "Object type", "Object ref"].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((event) => (
              <tr key={event.id} className="bg-card text-xs">
                <td className="px-4 py-2.5 font-mono text-muted-foreground">
                  {format(parseISO(event.timestamp), "d MMM HH:mm:ss")}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className={cn("text-[10px]", TYPE_COLORS[event.type] ?? "")}>
                    {event.type}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground capitalize">{event.objectType}</td>
                <td className="px-4 py-2.5 font-mono text-muted-foreground">{event.objectRef}</td>
                {/* NOTE: event.description is intentionally NOT rendered — admin no-content principle */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
