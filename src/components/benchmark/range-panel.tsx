"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }

interface RangePanelProps {
  pliOptions: string[];
  selectedPli: string;
  onSelectPli: (pli: string) => void;
  iqrLow: number;
  iqrHigh: number;
  median: number;
  weightedAverage: number;
  testedPartyRate: number;
  onRefresh: () => void;
  weightedAverageEnabled?: boolean;
  onToggleWeightedAverage?: (enabled: boolean) => void;
  onRetest?: () => void;
  className?: string;
}

export function RangePanel({
  pliOptions,
  selectedPli,
  onSelectPli,
  iqrLow,
  iqrHigh,
  median,
  weightedAverage,
  testedPartyRate,
  onRefresh,
  weightedAverageEnabled = false,
  onToggleWeightedAverage,
  onRetest,
  className,
}: RangePanelProps) {
  const outOfRange = testedPartyRate < iqrLow || testedPartyRate > iqrHigh;

  return (
    <div className={cn("space-y-5", className)}>
      {/* PLI selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="pli-select" className="text-xs whitespace-nowrap">PLI</Label>
        <select
          id="pli-select"
          value={selectedPli}
          onChange={(e) => onSelectPli(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          {pliOptions.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={onRefresh}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh from license
        </Button>
        {onRetest && (
          <Button size="sm" variant="outline" onClick={onRetest}>
            Re-test tested party
          </Button>
        )}
      </div>

      {onToggleWeightedAverage && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Switch
            id="weighted-average"
            checked={weightedAverageEnabled}
            onCheckedChange={onToggleWeightedAverage}
          />
          <Label htmlFor="weighted-average" className="text-sm">
            Weighted average
          </Label>
        </div>
      )}

      {/* Range visualization */}
      <div className="grid grid-cols-2 gap-4 tablet:grid-cols-4">
        {[
          { label: "Lower quartile (Q1)", value: pct(iqrLow) },
          { label: "Median",              value: pct(median) },
          { label: "Upper quartile (Q3)", value: pct(iqrHigh) },
          { label: "Weighted average",    value: pct(weightedAverage) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Tested party rate */}
      <div className={cn(
        "rounded-lg border p-4 flex items-center justify-between",
        outOfRange ? "border-danger/25 bg-danger-soft dark:border-danger/30 dark:bg-danger-soft" : "border-success/25 bg-success-soft dark:border-success/30 dark:bg-success-soft"
      )}>
        <div>
          <p className="text-xs text-muted-foreground">Tested party rate</p>
          <p className="text-2xl font-bold">{pct(testedPartyRate)}</p>
        </div>
        <p className={cn(
          "text-sm font-medium",
          outOfRange ? "text-danger-soft-foreground dark:text-danger-soft-foreground" : "text-success-soft-foreground dark:text-success-soft-foreground"
        )}>
          {outOfRange
            ? testedPartyRate > iqrHigh ? "Above upper quartile — out of range" : "Below lower quartile — out of range"
            : "Within arm's length range"}
        </p>
      </div>
    </div>
  );
}
