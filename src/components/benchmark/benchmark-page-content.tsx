"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BenchmarkSetTable, type Comparable } from "./benchmark-set-table";
import { RangePanel } from "./range-panel";
import { ScreeningCascade, type CascadeStage } from "./screening-cascade";

const INITIAL_STAGES: CascadeStage[] = [
  { id: "universe", label: "Universe", totalIn: 1200, totalOut: 1200, criteria: "All public software companies in RoyaltyStat." },
  { id: "revenue", label: "Revenue", totalIn: 1200, totalOut: 480, criteria: "Revenue $50M-$5B across three years." },
  { id: "segment", label: "Segment", totalIn: 480, totalOut: 82, criteria: "Software licensing at least 50% of revenue." },
  { id: "geo", label: "Geography", totalIn: 82, totalOut: 24, criteria: "OECD registered with comparable markets." },
  { id: "final", label: "Final set", totalIn: 24, totalOut: 12, criteria: "Remove outliers and retain accepted comparables." },
];

const INITIAL_COMPARABLES: Comparable[] = [
  { id: "c1", name: "Acme Software Inc", pli: 0.142, status: "accepted", delistedFlag: false },
  { id: "c2", name: "Beta Tech Corp", pli: 0.089, status: "accepted", delistedFlag: false },
  {
    id: "c3",
    name: "Gamma Systems Ltd",
    pli: 0.201,
    status: "rejected",
    rejectionReason: "Segment mismatch - hardware above 50%",
    delistedFlag: false,
  },
  { id: "c4", name: "Delta Analytics", pli: 0.156, status: "accepted", delistedFlag: true },
  { id: "c5", name: "Epsilon IP Holding", pli: 0.118, status: "accepted", delistedFlag: false },
];

const REFRESH_ADDITIONS: Comparable[] = [
  { id: "c6", name: "Orion Licensing PLC", pli: 0.131, status: "accepted", delistedFlag: false },
  { id: "c7", name: "Nova Royalty Analytics", pli: 0.109, status: "accepted", delistedFlag: false },
];

const REFRESH_DROPS = ["Gamma Systems Ltd"];

export function BenchmarkPageContent() {
  const [stages, setStages] = useState(INITIAL_STAGES);
  const [activeStageId, setActiveStageId] = useState(INITIAL_STAGES[0].id);
  const [criteriaDraft, setCriteriaDraft] = useState(INITIAL_STAGES[0].criteria);
  const [editingCriteria, setEditingCriteria] = useState(false);
  const [comparables, setComparables] = useState(INITIAL_COMPARABLES);
  const [selectedPli, setSelectedPli] = useState("CUT - royalty rate");
  const [weightedAverageEnabled, setWeightedAverageEnabled] = useState(false);
  const [notice, setNotice] = useState("Benchmark set is current to license pull RS-2024-11.");
  const [licenseRefreshStatus, setLicenseRefreshStatus] = useState("");
  const [refreshDiffOpen, setRefreshDiffOpen] = useState(false);

  const activeStage = stages.find((stage) => stage.id === activeStageId) ?? stages[0];
  const acceptedComparables = useMemo(
    () => comparables.filter((comparable) => comparable.status === "accepted"),
    [comparables],
  );
  const median = selectedPli === "TNMM - operating margin" ? 0.108 : 0.12;
  const weightedAverage = weightedAverageEnabled ? 0.124 : 0.121;

  function selectStage(stageId: string) {
    const stage = stages.find((item) => item.id === stageId);
    if (!stage) return;
    setActiveStageId(stage.id);
    setCriteriaDraft(stage.criteria);
    setEditingCriteria(false);
  }

  function submitCriteriaProposal() {
    setStages((current) =>
      current.map((stage) =>
        stage.id === activeStage.id ? { ...stage, criteria: criteriaDraft } : stage,
      ),
    );
    setEditingCriteria(false);
    setNotice(`${activeStage.label} criteria proposal routed to manager gate.`);
  }

  function toggleComparableStatus(id: string, newStatus: "accepted" | "rejected") {
    setComparables((current) =>
      current.map((comparable) =>
        comparable.id === id
          ? {
              ...comparable,
              status: newStatus,
              rejectionReason: newStatus === "rejected" ? "Manager excluded from set" : undefined,
            }
          : comparable,
      ),
    );
  }

  function refreshFromLicense() {
    setLicenseRefreshStatus("License refresh produced a diff sheet with 2 added and 1 dropped comparable.");
    setRefreshDiffOpen(true);
    setNotice("Benchmark license refresh completed and is awaiting manager accept.");
  }

  function acceptRefreshDiff() {
    setComparables((current) => [
      ...current.filter((comparable) => !REFRESH_DROPS.includes(comparable.name)),
      ...REFRESH_ADDITIONS.filter((addition) => !current.some((comparable) => comparable.id === addition.id)),
    ]);
    setRefreshDiffOpen(false);
    setNotice("Benchmark refresh accepted; comparable set updated and routed to manager gate.");
  }

  function retestTestedParty() {
    setNotice(`Re-test plan created for ${selectedPli} using ${acceptedComparables.length} accepted comparables.`);
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-6xl flex-col overflow-hidden px-6 py-6">
      <div className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Benchmark Studio</h1>
            <p className="text-sm text-muted-foreground">CUT royalty set for Veritax UK Ltd, FY2024.</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
            <p className="font-medium">{acceptedComparables.length} accepted comparables</p>
            <p className="text-muted-foreground">Manager gate required for methodology edits</p>
          </div>
        </div>
        <div role="status" className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </div>
      </div>

      <Tabs defaultValue="cascade" className="mt-5 flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0">
          <TabsTrigger value="cascade">Screening cascade</TabsTrigger>
          <TabsTrigger value="set">Comparable set</TabsTrigger>
          <TabsTrigger value="range">Range panel</TabsTrigger>
        </TabsList>

        <TabsContent value="cascade" className="mt-4 min-h-0 flex-1 overflow-auto">
          <div className="grid gap-4 laptop:grid-cols-[1fr_320px]">
            <ScreeningCascade stages={stages} onSelectStage={selectStage} />
            <aside className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{activeStage.label} criteria</p>
                  <p className="text-xs text-muted-foreground">methodology-tier change</p>
                </div>
                <Badge variant="outline">{activeStage.totalOut} remaining</Badge>
              </div>
              {editingCriteria ? (
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-medium" htmlFor="criteria-text">
                    Criteria text
                  </label>
                  <Textarea
                    id="criteria-text"
                    value={criteriaDraft}
                    onChange={(event) => setCriteriaDraft(event.target.value)}
                    rows={4}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={submitCriteriaProposal}>
                      Submit criteria proposal
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingCriteria(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-muted-foreground">{activeStage.criteria}</p>
                  <Button size="sm" variant="outline" onClick={() => setEditingCriteria(true)}>
                    Edit criteria
                  </Button>
                </div>
              )}
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="set" className="mt-4 min-h-0 flex-1 overflow-auto">
          <BenchmarkSetTable comparables={comparables} onToggleStatus={toggleComparableStatus} />
        </TabsContent>

        <TabsContent value="range" className="mt-4 min-h-0 flex-1 overflow-auto">
          <div className="space-y-4">
            {licenseRefreshStatus && (
              <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
                {licenseRefreshStatus}
              </div>
            )}
            {refreshDiffOpen && (
              <section
                aria-label="Refresh diff gate"
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Refresh diff gate</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Manager accept is required before the refreshed license set becomes current.
                    </p>
                  </div>
                  <Badge variant="outline">methodology gate</Badge>
                </div>
                <div className="mt-3 grid gap-3 tablet:grid-cols-2">
                  <div className="rounded-md border border-border bg-muted/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Added</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {REFRESH_ADDITIONS.map((item) => (
                        <li key={item.id}>{item.name}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-md border border-border bg-muted/20 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dropped</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {REFRESH_DROPS.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <Button size="sm" className="mt-3" onClick={acceptRefreshDiff}>
                  Accept refresh diff
                </Button>
              </section>
            )}
            <RangePanel
              pliOptions={["CUT - royalty rate", "TNMM - operating margin"]}
              selectedPli={selectedPli}
              onSelectPli={setSelectedPli}
              iqrLow={selectedPli === "TNMM - operating margin" ? 0.08 : 0.1}
              iqrHigh={selectedPli === "TNMM - operating margin" ? 0.13 : 0.14}
              median={median}
              weightedAverage={weightedAverage}
              testedPartyRate={selectedPli === "TNMM - operating margin" ? 0.151 : 0.18}
              onRefresh={refreshFromLicense}
              weightedAverageEnabled={weightedAverageEnabled}
              onToggleWeightedAverage={setWeightedAverageEnabled}
              onRetest={retestTestedParty}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
