"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface RetentionSchedule {
  id: string;
  docClass: string;
  jurisdiction: string;
  daysToRetain: number;
  legalHold: boolean;
}

interface RetentionScheduleEditorProps {
  schedules: RetentionSchedule[];
  onChange: (updated: RetentionSchedule) => void;
  className?: string;
}

export function RetentionScheduleEditor({ schedules, onChange, className }: RetentionScheduleEditorProps) {
  const [local, setLocal] = useState<RetentionSchedule[]>(schedules);

  function toggleLegalHold(id: string) {
    const updated = local.map((s) => s.id === id ? { ...s, legalHold: !s.legalHold } : s);
    setLocal(updated);
    const item = updated.find((s) => s.id === id)!;
    onChange(item);
  }

  const anyHold = local.some((s) => s.legalHold);

  return (
    <div className={cn("space-y-3", className)}>
      {anyHold && (
        <div className="flex items-center gap-2 rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-xs text-warning-soft-foreground dark:border-warning/30 dark:bg-warning-soft dark:text-warning-soft-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Legal hold active — overrides normal retention schedule for flagged classes.
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Doc class", "Jurisdiction", "Days to retain", "Legal hold"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {local.map((s) => (
              <tr key={s.id} className={cn("bg-card", s.legalHold && "bg-warning-soft dark:bg-warning-soft")}>
                <td className="px-4 py-3 capitalize font-medium">{s.docClass}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.jurisdiction}</td>
                <td className="px-4 py-3 text-xs">
                  {s.legalHold ? (
                    <span className="font-medium text-warning-soft-foreground dark:text-warning-soft-foreground">∞ (hold active)</span>
                  ) : (
                    `${s.daysToRetain} days`
                  )}
                </td>
                <td className="px-4 py-3">
                  <Checkbox
                    checked={s.legalHold}
                    onCheckedChange={() => toggleLegalHold(s.id)}
                    aria-label={`Legal hold for ${s.docClass} ${s.jurisdiction}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
