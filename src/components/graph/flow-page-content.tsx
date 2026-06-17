"use client";

import { ArrowRight, CheckCircle, Factory, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { Entity, Flow } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

export interface JurisdictionCoverage {
  jurisdiction: string;
  jurisdictionCode: string;
  hasLocalFile: boolean;
  documentId?: string;
}

interface FlowPageContentProps {
  flow: Flow;
  fromEntity: Entity;
  toEntity: Entity;
  coverageByJurisdiction: JurisdictionCoverage[];
  onRetest: () => void;
  onOpenInFactory: () => void;
  onProposePolicyChange: () => void;
}

const STATUS_COLORS: Record<Flow["status"], string> = {
  verified: "border-green-300 bg-green-50 text-green-700",
  drift:    "border-amber-300 bg-amber-50 text-amber-700",
  exception:"border-red-300 bg-red-50 text-red-700",
};

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

export function FlowPageContent({
  flow,
  fromEntity,
  toEntity,
  coverageByJurisdiction,
  onRetest,
  onOpenInFactory,
  onProposePolicyChange,
}: FlowPageContentProps) {
  const delta = flow.observedRate - flow.policyRate;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xl font-semibold flex-wrap">
          <span>{fromEntity.name}</span>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span>{toEntity.name}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">{flow.kind}</Badge>
          <Badge variant="outline" className="font-mono text-xs">{flow.method}</Badge>
          <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[flow.status])}>
            {flow.status}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onRetest} variant="outline" className="gap-1.5">
          <RefreshCw className="h-4 w-4" />
          Re-test range
        </Button>
        <Button onClick={onOpenInFactory} variant="outline" className="gap-1.5">
          <Factory className="h-4 w-4" />
          Open in Factory
        </Button>
        <Button
          onClick={onProposePolicyChange}
          variant="outline"
          className="gap-1.5 text-amber-700 hover:text-amber-800 border-amber-300"
        >
          Propose policy change
        </Button>
      </div>

      <Separator />

      {/* Policy vs Observed panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Policy vs Observed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Policy rate</p>
              <p className="text-2xl font-semibold">{pct(flow.policyRate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Observed rate</p>
              <p className={cn("text-2xl font-semibold", flow.status === "exception" ? "text-destructive" : "")}>
                {pct(flow.observedRate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Delta</p>
              <p className={cn("text-2xl font-semibold", delta > 0 ? "text-destructive" : "text-green-600")}>
                {delta > 0 ? "+" : ""}{pct(delta)}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Time-series chart with PAT-2 lineage on each data point will render here.
          </p>
        </CardContent>
      </Card>

      {/* Agreement card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Governing Agreement</CardTitle>
        </CardHeader>
        <CardContent>
          {flow.agreementId ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{flow.agreementId}</p>
                <p className="text-xs text-muted-foreground">Executed — current</p>
              </div>
              <Badge variant="outline" className="text-green-700 border-green-300">Executed</Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">No agreement found — gap</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentation coverage by jurisdiction */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Documentation Coverage by Jurisdiction</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {coverageByJurisdiction.map((cov) => (
              <div
                key={cov.jurisdictionCode}
                className={cn(
                  "flex items-center justify-between rounded-md border p-2.5 text-sm",
                  !cov.hasLocalFile ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950" : "border-border",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold">{cov.jurisdictionCode}</span>
                  <span className="text-muted-foreground">{cov.jurisdiction}</span>
                </div>
                {cov.hasLocalFile ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-xs text-green-700">Covered</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-xs font-medium text-destructive">Missing — flagged</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
