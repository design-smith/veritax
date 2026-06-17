"use client";

import { useState } from "react";
import { Download, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { computeScenario, type BaseResult, type ScenarioParameters, type ScenarioResult } from "./scenario-compute";
import { cn } from "@/lib/utils";

const MAX_SCENARIOS = 3;

interface SavedScenario {
  id: string;
  name: string;
  params: ScenarioParameters;
  result: ScenarioResult;
}

interface ScenarioSandboxProps {
  base: BaseResult;
  onExportMemo: () => void;
  className?: string;
}

function DiffBadge({ value }: { value: number }) {
  const label = value > 0 ? `+${value.toFixed(3)}` : value.toFixed(3);
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs ml-2",
        value > 0 ? "border-red-300 text-red-700" : value < 0 ? "border-green-300 text-green-700" : "",
      )}
    >
      {label}
    </Badge>
  );
}

export function ScenarioSandbox({ base, onExportMemo, className }: ScenarioSandboxProps) {
  const [params, setParams] = useState<ScenarioParameters>({
    adjustedRate: base.globeETR,
    qdmttElection: false,
    trueUpOffset: 0,
  });
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [saved, setSaved] = useState<SavedScenario[]>([]);

  function handleCompute() {
    setResult(computeScenario(base, params));
  }

  function handleSave() {
    if (!result || saved.length >= MAX_SCENARIOS) return;
    const scenario: SavedScenario = {
      id: `s${Date.now()}`,
      name: `Scenario ${saved.length + 1}`,
      params,
      result,
    };
    setSaved((prev) => [...prev, scenario]);
  }

  const canSave = result !== null && saved.length < MAX_SCENARIOS;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Parameter sheet */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Parameter sheet</CardTitle></CardHeader>
        <CardContent className="grid gap-4 tablet:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="adj-rate">Adjusted rate</Label>
            <input
              id="adj-rate"
              type="number"
              step="0.001"
              min={0}
              max={1}
              value={params.adjustedRate}
              onChange={(e) => setParams((p) => ({ ...p, adjustedRate: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              aria-label="Adjusted rate"
            />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <input
              id="qdmtt-election"
              type="checkbox"
              checked={params.qdmttElection}
              onChange={(e) => setParams((p) => ({ ...p, qdmttElection: e.target.checked }))}
              className="h-4 w-4"
            />
            <Label htmlFor="qdmtt-election">QDMTT election</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trueup-offset">True-up offset ({base.currency})</Label>
            <input
              id="trueup-offset"
              type="number"
              step="1000"
              value={params.trueUpOffset}
              onChange={(e) => setParams((p) => ({ ...p, trueUpOffset: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              aria-label="True-up offset"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleCompute}>Compute</Button>
        {result && (
          <>
            <Button variant="outline" onClick={handleSave} disabled={!canSave}>
              <Plus className="h-4 w-4 mr-1.5" />
              Save scenario
            </Button>
            <Button variant="outline" onClick={onExportMemo}>
              <Download className="h-4 w-4 mr-1.5" />
              Export memo
            </Button>
          </>
        )}
      </div>

      {/* Results diff */}
      {result && (
        <Card data-testid="scenario-results">
          <CardHeader><CardTitle className="text-sm">Results vs base</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">GloBE ETR</span>
              <span>
                {(result.globeETR * 100).toFixed(1)}%
                <DiffBadge value={result.diff.globeETR} />
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">QDMTT accrual</span>
              <span>
                {result.qdmttAccrual.toLocaleString()} {base.currency}
                <DiffBadge value={result.diff.qdmttAccrual} />
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">True-up</span>
              <span>
                {result.trueUpAmount.toLocaleString()} {base.currency}
                <DiffBadge value={result.diff.trueUpAmount} />
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground pt-1">
              Scenarios are read-only — they never write to the Record. Promote via Propose policy change.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Saved scenarios comparison */}
      {saved.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Saved scenarios ({saved.length}/{MAX_SCENARIOS})
          </p>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${saved.length}, 1fr)` }}>
            {saved.map((s) => (
              <Card key={s.id} data-testid={`saved-scenario-${s.id}`}>
                <CardContent className="pt-4 space-y-2 text-xs">
                  <p className="font-semibold">{s.name}</p>
                  <p>ETR: {(s.result.globeETR * 100).toFixed(1)}%</p>
                  <p>QDMTT: {s.result.qdmttAccrual.toLocaleString()}</p>
                  <p>True-up: {s.result.trueUpAmount.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
