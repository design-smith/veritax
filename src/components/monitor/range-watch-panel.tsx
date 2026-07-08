"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface RangeWatchRow {
  id: string;
  testedParty: string;
  flowId: string;
  iqrLow: number;
  iqrHigh: number;
  ytdRate: number;
  projectedLanding: number;
  trueUpAmount: number;
  currency: string;
}

interface RangeWatchPanelProps {
  rows: RangeWatchRow[];
  onRetest: (rowId: string) => void;
  className?: string;
}

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function isOutOfRange(row: RangeWatchRow): boolean {
  return row.ytdRate < row.iqrLow || row.ytdRate > row.iqrHigh;
}

export function RangeWatchPanel({ rows, onRetest, className }: RangeWatchPanelProps) {
  return (
    <div className={cn("rounded-lg border border-border overflow-x-auto", className)}>
      <table className="min-w-[680px] w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Tested party</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">IQR band</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">YTD rate</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">True-up</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const outOfRange = isOutOfRange(row);
            return (
              <tr key={row.id} className="bg-card hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium">{row.testedParty}</p>
                  <p className="text-xs font-mono text-muted-foreground">{row.flowId}</p>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {pct(row.iqrLow)} – {pct(row.iqrHigh)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      data-testid={`range-status-${row.id}`}
                      className={cn(
                        "inline-flex items-center gap-1 text-sm font-semibold",
                        outOfRange ? "out-of-range text-danger-soft-foreground" : "in-range text-success-soft-foreground",
                      )}
                    >
                      {pct(row.ytdRate)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "text-sm font-semibold",
                    row.trueUpAmount < 0 ? "text-danger-soft-foreground" : "text-success-soft-foreground"
                  )}>
                    {row.trueUpAmount.toLocaleString()} {row.currency}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => onRetest(row.id)}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Re-test
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
