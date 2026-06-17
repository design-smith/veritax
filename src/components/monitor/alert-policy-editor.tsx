"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type AlertCadence = "realtime" | "daily" | "weekly" | "never";

export interface AlertPolicy {
  id: string;
  category: string;
  cadence: AlertCadence;
  threshold: number;
  lastQuarterCount: number;
}

interface AlertPolicyEditorProps {
  policies: AlertPolicy[];
  onChange: (updated: AlertPolicy) => void;
  className?: string;
}

const CADENCES: AlertCadence[] = ["realtime", "daily", "weekly", "never"];

export function AlertPolicyEditor({ policies, onChange, className }: AlertPolicyEditorProps) {
  const [local, setLocal] = useState<AlertPolicy[]>(policies);

  function update(id: string, patch: Partial<AlertPolicy>) {
    const updated = local.map((p) => p.id === id ? { ...p, ...patch } : p);
    setLocal(updated);
    const policy = updated.find((p) => p.id === id)!;
    onChange(policy);
  }

  return (
    <div className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      {local.map((policy) => {
        const wouldSend = policy.lastQuarterCount >= policy.threshold
          ? policy.cadence === "never"
            ? 0
            : policy.lastQuarterCount
          : 0;

        return (
          <div key={policy.id} className="grid gap-4 px-5 py-4 bg-card tablet:grid-cols-3">
            {/* Category label */}
            <div className="space-y-1">
              <p className="text-sm font-medium">{policy.category}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Info className="h-3 w-3" />
                <span>
                  This policy would have sent{" "}
                  <span className="font-medium text-foreground">{policy.lastQuarterCount}</span>{" "}
                  items last quarter
                </span>
              </div>
            </div>

            {/* Cadence */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cadence</Label>
              <select
                value={policy.cadence}
                onChange={(e) => update(policy.id, { cadence: e.target.value as AlertCadence })}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              >
                {CADENCES.map((c) => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            </div>

            {/* Threshold */}
            <div className="space-y-1.5">
              <Label className="text-xs">Threshold (min items)</Label>
              <input
                type="number"
                min={1}
                value={policy.threshold}
                onChange={(e) => update(policy.id, { threshold: parseInt(e.target.value, 10) || 1 })}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
