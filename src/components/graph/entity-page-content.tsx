"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/surface-states";
import type { Document, Entity, Finding, Flow } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

interface EntityPageContentProps {
  entity: Entity;
  relatedFlows: Flow[];
  relatedFindings: Finding[];
  relatedDocuments: Document[];
  defaultTab?: string;
}

const STATUS_COLORS: Record<Flow["status"], string> = {
  verified: "bg-green-100 text-green-700",
  drift:    "bg-amber-100 text-amber-700",
  exception:"bg-red-100 text-red-700",
};

// ── Tab contents ─────────────────────────────────────────────────────────────

function OverviewTab({ entity }: { entity: Entity }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Functional Profile</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm">{entity.functionalProfile}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">FAR Summary</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Functions, Assets & Risks summary with citation references will be shown here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function FinancialsTab() {
  const [gaap, setGaap] = useState<"local" | "ifrs">("local");
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={gaap === "local" ? "default" : "outline"}
          onClick={() => setGaap("local")}
          aria-label="Local GAAP"
        >
          Local GAAP
        </Button>
        <Button
          size="sm"
          variant={gaap === "ifrs" ? "default" : "outline"}
          onClick={() => setGaap("ifrs")}
          aria-label="IFRS GAAP"
        >
          IFRS / US GAAP
        </Button>
      </div>
      <EmptyState
        heading="Financials"
        description={`${gaap === "local" ? "Local GAAP" : "IFRS / US GAAP"} financial statements with PAT-2 lineage will render here.`}
      />
    </div>
  );
}

function SubstanceTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Headcount</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Headcount by period (from payroll system).</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Payroll</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Payroll by jurisdiction.</CardContent>
      </Card>
    </div>
  );
}

function PillarTwoTab() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">GloBE Attributes</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "GloBE ETR", value: "—" },
          { label: "QDMTT applicability", value: "—" },
          { label: "Substance-based exclusion", value: "—" },
          { label: "MNE group", value: "Veritax Group" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-medium">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgreementsTab({ flows }: { flows: Flow[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Flows and their agreement status
      </p>
      {flows.length === 0 ? (
        <EmptyState heading="No flows" description="No intercompany flows touch this entity." />
      ) : (
        flows.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-md border border-border p-2.5 text-sm">
            <span>{f.kind} — {f.method}</span>
            <div className="flex items-center gap-2">
              {f.agreementId ? (
                <Badge variant="outline" className="text-xs text-green-700 border-green-300">ICA: {f.agreementId}</Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-red-700 border-red-300">Gap — no ICA</Badge>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FindingsTab({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <EmptyState heading="No findings" description="No findings are associated with this entity's flows." />;
  }
  return (
    <div className="space-y-2">
      {findings.map((f) => (
        <div key={f.id} className="flex items-center gap-3 rounded-md border border-border p-2.5 text-sm">
          <Badge variant="outline" className="font-mono text-xs shrink-0">{f.id}</Badge>
          <span className="truncate text-sm">{f.title}</span>
          <span className={cn("ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs capitalize", f.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>{f.severity}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function EntityPageContent({ entity, relatedFlows, relatedFindings, relatedDocuments, defaultTab = "Overview" }: EntityPageContentProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <div className="space-y-6 px-6 py-6">
      {/* Page header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{entity.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">{entity.role}</Badge>
              <Badge variant="outline" className="font-mono text-xs">{entity.jurisdictionCode}</Badge>
              <span className="text-sm text-muted-foreground">as-of {entity.asOf}</span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      {/* Simple state tabs — avoids Radix Presence unmounting in non-browser envs */}
      <div>
        <div role="tablist" className="flex flex-wrap gap-1 border-b border-border pb-0">
          {["Overview","Financials","Substance","Pillar 2","Agreements","Findings","Filings","Audit history"].map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-t-md border-b-2 px-3 py-2 text-sm transition-colors",
                activeTab === tab
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === "Overview"      && <OverviewTab entity={entity} />}
          {activeTab === "Financials"    && <FinancialsTab />}
          {activeTab === "Substance"     && <SubstanceTab />}
          {activeTab === "Pillar 2"      && <PillarTwoTab />}
          {activeTab === "Agreements"    && <AgreementsTab flows={relatedFlows} />}
          {activeTab === "Findings"      && <FindingsTab findings={relatedFindings} />}
          {activeTab === "Filings"       && <EmptyState heading="Filings" description="Obligation history and filing evidence for this entity." />}
          {activeTab === "Audit history" && <EmptyState heading="Audit history" description="Full event trail for this entity." />}
        </div>
      </div>
    </div>
  );
}
