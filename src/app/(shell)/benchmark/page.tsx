"use client";

import { useState } from "react";
import { BenchmarkSetTable, type Comparable } from "@/components/benchmark/benchmark-set-table";
import { RangePanel } from "@/components/benchmark/range-panel";
import { ScreeningCascade } from "@/components/benchmark/screening-cascade";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STAGES = [
  { id: "universe", label: "Universe",       totalIn: 1200, totalOut: 1200, criteria: "All public software companies in CapIQ" },
  { id: "revenue",  label: "Revenue",        totalIn: 1200, totalOut: 480,  criteria: "Revenue $50M–$5B (trailing 3 years)" },
  { id: "segment",  label: "Segment",        totalIn: 480,  totalOut: 82,   criteria: "Software licensing ≥ 50% of revenue" },
  { id: "geo",      label: "Geography",      totalIn: 82,   totalOut: 24,   criteria: "OECD-registered, comparable markets" },
  { id: "final",    label: "Final set",      totalIn: 24,   totalOut: 12,   criteria: "Remove outliers (Grubbs test, p<0.05)" },
];

const COMPARABLES = [
  { id: "c1", name: "Acme Software Inc",   pli: 0.142, status: "accepted" as const, delistedFlag: false },
  { id: "c2", name: "Beta Tech Corp",      pli: 0.089, status: "accepted" as const, delistedFlag: false },
  { id: "c3", name: "Gamma Systems Ltd",   pli: 0.201, status: "rejected" as const, rejectionReason: "Segment mismatch — hardware >50%", delistedFlag: false },
  { id: "c4", name: "Delta Analytics",     pli: 0.156, status: "accepted" as const, delistedFlag: true },
  { id: "c5", name: "Epsilon IP Holding",  pli: 0.118, status: "accepted" as const, delistedFlag: false },
];

const noop = () => {};

export default function BenchmarkPage() {
  const [comparables, setComparables] = useState<Comparable[]>(COMPARABLES);

  function toggleStatus(id: string, newStatus: "accepted" | "rejected") {
    setComparables((cs) => cs.map((c) => c.id === id ? { ...c, status: newStatus } : c));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <h1 className="text-2xl font-semibold">Benchmark Studio</h1>

      <Tabs defaultValue="cascade">
        <TabsList>
          <TabsTrigger value="cascade">Screening cascade</TabsTrigger>
          <TabsTrigger value="set">Comparable set</TabsTrigger>
          <TabsTrigger value="range">Range panel</TabsTrigger>
        </TabsList>

        <TabsContent value="cascade" className="mt-4">
          <ScreeningCascade stages={STAGES} onSelectStage={noop} />
        </TabsContent>

        <TabsContent value="set" className="mt-4">
          <BenchmarkSetTable comparables={comparables} onToggleStatus={toggleStatus} />
        </TabsContent>

        <TabsContent value="range" className="mt-4">
          <RangePanel
            pliOptions={["CUT — royalty rate", "TNMM — operating margin"]}
            selectedPli="CUT — royalty rate"
            onSelectPli={noop}
            iqrLow={0.10}
            iqrHigh={0.14}
            median={0.12}
            weightedAverage={0.121}
            testedPartyRate={0.18}
            onRefresh={noop}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
