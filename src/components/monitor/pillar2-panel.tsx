"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SafeharbourTest {
  name: string;
  passed: boolean;
}

export interface Pillar2Row {
  jurisdictionCode: string;
  jurisdiction: string;
  globeETR: number;
  safeharbourTests: SafeharbourTest[];
  qdmttAccrual: number;
  currency: string;
}

interface Pillar2PanelProps {
  rows: Pillar2Row[];
  className?: string;
}

export function Pillar2Panel({ rows, className }: Pillar2PanelProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  function toggleRow(code: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(code)) { next.delete(code); } else { next.add(code); }
      return next;
    });
  }

  return (
    <div className={cn("rounded-lg border border-border overflow-hidden", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Jurisdiction</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">GloBE ETR</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Safe harbour tests</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">QDMTT accrual</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const failedTests = row.safeharbourTests.filter((t) => !t.passed);
            const isExpanded = expandedRows.has(row.jurisdictionCode);

            return (
              <>
                <tr key={row.jurisdictionCode} className="bg-card hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold">{row.jurisdictionCode}</span>
                    <span className="ml-2 text-muted-foreground">{row.jurisdiction}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "font-semibold",
                      row.globeETR < 0.15 ? "text-destructive" : "text-foreground"
                    )}>
                      {(row.globeETR * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.safeharbourTests.map((test) => (
                        <Badge
                          key={test.name}
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            test.passed
                              ? "border-green-300 bg-green-50 text-green-700"
                              : "border-red-300 bg-red-50 text-red-700"
                          )}
                        >
                          {test.passed ? "pass" : "fail"}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={row.qdmttAccrual > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>
                        {row.qdmttAccrual > 0
                          ? row.qdmttAccrual.toLocaleString()
                          : "—"}
                        {row.qdmttAccrual > 0 && ` ${row.currency}`}
                      </span>
                      {failedTests.length > 0 && (
                        <button
                          onClick={() => toggleRow(row.jurisdictionCode)}
                          className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                          aria-label="Why"
                        >
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          Why
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && failedTests.length > 0 && (
                  <tr key={`${row.jurisdictionCode}-expanded`} className="bg-muted/10">
                    <td colSpan={4} className="px-6 py-3">
                      <div className="space-y-1">
                        {failedTests.map((test) => (
                          <div key={test.name} className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{test.name}</span>
                            {" — "}
                            <span>ETR test math: {(row.globeETR * 100).toFixed(1)}% &lt; 15% minimum rate</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
