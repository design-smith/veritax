"use client";

import { useState } from "react";
import { FactoryWorkspace, type WorkspaceSection } from "@/components/factory/factory-workspace";
import { InlineDirectiveCanvas } from "@/components/factory/inline-directive-canvas";
import { RedlineToggle } from "@/components/factory/redline-toggle";
import { PipelineKanban } from "@/components/factory/pipeline-kanban";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEMO_SECTIONS: WorkspaceSection[] = [
  {
    id: "s1",
    title: "1. Introduction",
    status: "generated",
    content:
      "This local file describes the transfer pricing policies of Veritax UK Ltd for the fiscal year ended 31 December 2024. The company acts as a limited-risk distributor within the Veritax group.",
    inputChips: [
      { label: "Entity profile", ref: "e2" },
      { label: "FAR summary", ref: "d1" },
    ],
  },
  {
    id: "s2",
    title: "2. Transfer Pricing Analysis",
    status: "stale",
    content:
      "The royalty rate applied to Veritax UK Ltd is 18%, charged by the US principal entity. The arm's length range established by the CUT benchmark study is 10–14%.",
    inputChips: [
      { label: "Benchmark study", ref: "d5" },
      { label: "TP Policy FY2024", ref: "d7" },
    ],
  },
  {
    id: "s3",
    title: "3. Conclusions",
    status: "blocked",
    content:
      "The documentation is pending resolution of finding fn1 (UK royalty rate exceeds arm's length range). Export is blocked until the blocker is resolved.",
    inputChips: [],
  },
];

const REDLINE_SECTIONS = [
  {
    id: "s1",
    title: "1. Introduction",
    currentText:
      "This local file describes the transfer pricing policies of Veritax UK Ltd for the fiscal year ended 31 December 2024.",
    priorText:
      "This local file describes the transfer pricing policies of Veritax UK Ltd for the fiscal year ended 31 December 2023.",
  },
  {
    id: "s2",
    title: "2. Transfer Pricing Analysis",
    currentText: "The royalty rate applied to Veritax UK Ltd is 18%.",
    priorText: "The royalty rate applied to Veritax UK Ltd is 12%.",
  },
];

const noop = () => {};

export default function FactoryPage() {
  const [activeSectionId, setActiveSectionId] = useState("s1");

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <h1 className="text-base font-semibold">Veritax UK Local File FY2024</h1>
          <p className="text-xs text-muted-foreground">Draft v2 · Internal review pending</p>
        </div>
      </div>

      <Tabs defaultValue="workspace" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="shrink-0 justify-start rounded-none border-b border-border bg-transparent px-4 pb-0">
          <TabsTrigger value="workspace" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Workspace
          </TabsTrigger>
          <TabsTrigger value="redline" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Redline
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Pipeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="flex-1 overflow-hidden mt-0">
          <FactoryWorkspace sections={DEMO_SECTIONS} onSectionSelect={setActiveSectionId} className="h-full" />
        </TabsContent>

        <TabsContent value="redline" className="flex-1 overflow-auto mt-0 px-8 py-6">
          <RedlineToggle sections={REDLINE_SECTIONS} />
        </TabsContent>

        <TabsContent value="pipeline" className="flex-1 overflow-auto mt-0 p-4">
          <PipelineKanban
            documents={[
              { id: "pd1", name: "Veritax UK Local File FY2024", fy: "2024", jurisdiction: "GB", version: 2, stage: "internal-review", redlineCount: 3, blockerChips: [] },
              { id: "pd2", name: "Veritax GmbH Local File FY2024", fy: "2024", jurisdiction: "DE", version: 1, stage: "queued", redlineCount: 0, blockerChips: [] },
              { id: "pd3", name: "Group Master File FY2024", fy: "2024", jurisdiction: "US", version: 3, stage: "self-check", redlineCount: 0, blockerChips: ["failed-assertion:§4.2"] },
              { id: "pd4", name: "Singapore Local File FY2024", fy: "2024", jurisdiction: "SG", version: 1, stage: "generating", redlineCount: 0, blockerChips: [] },
            ]}
            onMoveStage={noop}
            onOpenWorkspace={noop}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
