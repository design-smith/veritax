"use client";

import { Fragment, useState } from "react";
import { parseISO, format } from "date-fns";
import { AlertTriangle, Pause, Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SourceType = "ERP" | "HRIS" | "email" | "sharepoint" | "license-db" | "other";
type CustodyClass = "shared" | "personal";
type SourceHealth = "healthy" | "stale" | "down";

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  custodyClass: CustodyClass;
  scope: string;
  lastSync: string;
  lagHours: number;
  volumeDocs: number;
  ownerId: string;
  health: SourceHealth;
}

const HEALTH_COLORS: Record<SourceHealth, string> = {
  healthy: "border-transparent bg-success-soft text-success-soft-foreground",
  stale:   "border-transparent bg-warning-soft text-warning-soft-foreground",
  down:    "border-transparent bg-danger-soft text-danger-soft-foreground",
};

interface SourcesTableProps {
  sources: Source[];
  onPause: (sourceId: string) => void;
  onDisconnect: (sourceId: string) => void;
  className?: string;
}

export function SourcesTable({ sources, onPause, onDisconnect, className }: SourcesTableProps) {
  const [confirmingDisconnect, setConfirmingDisconnect] = useState<string | null>(null);

  return (
    <div className={cn("rounded-lg border border-border overflow-x-auto", className)}>
      <table className="min-w-[760px] w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {["Source", "Type", "Custody", "Last sync", "Volume", "Health", "Actions"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sources.map((src) => (
            <Fragment key={src.id}>
              <tr className="bg-card hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium">{src.name}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[140px]">{src.scope}</p>
                </td>
                <td className="px-4 py-3"><Badge variant="secondary" className="text-xs">{src.type}</Badge></td>
                <td className="px-4 py-3"><Badge variant="outline" className="text-xs capitalize">{src.custodyClass}</Badge></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {format(parseISO(src.lastSync), "d MMM, HH:mm")}
                </td>
                <td className="px-4 py-3 text-xs">{src.volumeDocs.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={cn("text-xs", HEALTH_COLORS[src.health])}>
                    {src.health}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs"
                      onClick={() => onPause(src.id)}>
                      <Pause className="h-3 w-3" />
                      Pause
                    </Button>
                    <Button size="sm" variant="ghost"
                      className="h-7 gap-1 px-2 text-xs text-danger-soft-foreground hover:text-danger-soft-foreground"
                      onClick={() => setConfirmingDisconnect(src.id)}>
                      <Plug className="h-3 w-3" />
                      Disconnect
                    </Button>
                  </div>
                </td>
              </tr>
              {confirmingDisconnect === src.id && (
                <tr key={`${src.id}-confirm`} className="bg-danger-soft dark:bg-danger-soft">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-danger-soft-foreground shrink-0" />
                      <p className="text-sm text-danger-soft-foreground dark:text-danger-soft-foreground">
                        <span className="font-medium">Consequence:</span> Documents from this source become reference-orphaned.
                      </p>
                      <div className="flex gap-2 ml-auto shrink-0">
                        <Button size="sm" variant="destructive" className="h-7 text-xs"
                          onClick={() => { onDisconnect(src.id); setConfirmingDisconnect(null); }}>
                          Confirm disconnect
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => setConfirmingDisconnect(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
