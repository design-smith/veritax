"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ComparableStatus = "accepted" | "rejected";

export interface Comparable {
  id: string;
  name: string;
  pli: number;
  status: "accepted" | "rejected";
  rejectionReason?: string;
  delistedFlag: boolean;
}

interface BenchmarkSetTableProps {
  comparables: Comparable[];
  onToggleStatus: (comparableId: string, newStatus: ComparableStatus) => void;
  className?: string;
}

export function BenchmarkSetTable({ comparables, onToggleStatus, className }: BenchmarkSetTableProps) {
  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {["Company", "PLI", "Status", "Actions"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {comparables.map((comp) => (
            <tr key={comp.id} className={cn("bg-card", comp.status === "rejected" && "opacity-60")}>
              <td className="px-4 py-3">
                <p className="font-medium">{comp.name}</p>
                {comp.rejectionReason && (
                  <p className="text-xs text-muted-foreground">{comp.rejectionReason}</p>
                )}
                {comp.delistedFlag && (
                  <Badge variant="outline" className="text-[10px] border-warning/25 text-warning-soft-foreground mt-0.5">
                    Delisted
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-xs">{(comp.pli * 100).toFixed(1)}%</td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    comp.status === "accepted" ? "border-transparent bg-success-soft text-success-soft-foreground" : "border-transparent bg-danger-soft text-danger-soft-foreground"
                  )}
                >
                  {comp.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => onToggleStatus(comp.id, comp.status === "accepted" ? "rejected" : "accepted")}
                >
                  {comp.status === "accepted" ? "Reject" : "Accept"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
