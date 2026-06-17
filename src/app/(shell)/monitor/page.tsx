"use client";

import { MonitorPeriodHeader } from "@/components/monitor/monitor-period-header";
import { Pillar2Panel, type Pillar2Row } from "@/components/monitor/pillar2-panel";
import { RangeWatchPanel, type RangeWatchRow } from "@/components/monitor/range-watch-panel";
import { ScenarioSandbox } from "@/components/monitor/scenario-sandbox";
import { AlertPolicyEditor } from "@/components/monitor/alert-policy-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

const PILLAR2_ROWS: Pillar2Row[] = [
  {
    jurisdictionCode: "DE",
    jurisdiction: "Germany",
    globeETR: 0.124,
    safeharbourTests: [
      { name: "De Minimis", passed: true },
      { name: "ETR Test", passed: false },
      { name: "Substance Based Income", passed: true },
    ],
    qdmttAccrual: 240_000,
    currency: "EUR",
  },
  {
    jurisdictionCode: "GB",
    jurisdiction: "United Kingdom",
    globeETR: 0.25,
    safeharbourTests: [
      { name: "De Minimis", passed: true },
      { name: "ETR Test", passed: true },
      { name: "Substance Based Income", passed: true },
    ],
    qdmttAccrual: 0,
    currency: "GBP",
  },
  {
    jurisdictionCode: "FR",
    jurisdiction: "France",
    globeETR: 0.228,
    safeharbourTests: [
      { name: "De Minimis", passed: false },
      { name: "ETR Test", passed: true },
      { name: "Substance Based Income", passed: true },
    ],
    qdmttAccrual: 0,
    currency: "EUR",
  },
];

const RANGE_ROWS: RangeWatchRow[] = [
  {
    id: "rw1",
    testedParty: "Veritax UK Ltd",
    flowId: "f1",
    iqrLow: 0.10,
    iqrHigh: 0.14,
    ytdRate: 0.18,
    projectedLanding: 0.18,
    trueUpAmount: -180_000,
    currency: "USD",
  },
  {
    id: "rw2",
    testedParty: "Veritax GmbH",
    flowId: "f2",
    iqrLow: 0.10,
    iqrHigh: 0.14,
    ytdRate: 0.135,
    projectedLanding: 0.135,
    trueUpAmount: -35_000,
    currency: "EUR",
  },
  {
    id: "rw3",
    testedParty: "Veritax France SAS",
    flowId: "f10",
    iqrLow: 0.09,
    iqrHigh: 0.13,
    ytdRate: 0.17,
    projectedLanding: 0.17,
    trueUpAmount: -120_000,
    currency: "EUR",
  },
];

const noop = () => {};

const BASE_RESULT = { globeETR: 0.124, qdmttAccrual: 240_000, trueUpAmount: -180_000, currency: "EUR" };

const ALERT_POLICIES = [
  { id: "findings", category: "Findings", cadence: "realtime" as const, threshold: 1, lastQuarterCount: 12 },
  { id: "runs",     category: "Runs",     cadence: "daily" as const,    threshold: 5, lastQuarterCount: 47 },
  { id: "gates",    category: "Gate requests", cadence: "realtime" as const, threshold: 1, lastQuarterCount: 8 },
];

export default function MonitorPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <h1 className="text-2xl font-semibold">Monitor</h1>

      <MonitorPeriodHeader fiscalYear="FY2024" quarter="Q4" daysToClose={12} checklistTotal={8} checklistDone={5} />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="alerts">Alert policy</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-8">
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Pillar 2 — GloBE ETR by Jurisdiction</h2>
            <Pillar2Panel rows={PILLAR2_ROWS} />
          </section>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Range Watch</h2>
            <RangeWatchPanel rows={RANGE_ROWS} onRetest={noop} />
          </section>
        </TabsContent>

        <TabsContent value="scenarios" className="mt-6">
          <ScenarioSandbox base={BASE_RESULT} onExportMemo={noop} />
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <AlertPolicyEditor policies={ALERT_POLICIES} onChange={noop} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
