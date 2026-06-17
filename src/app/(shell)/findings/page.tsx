"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BulkActionsBar } from "@/components/findings/bulk-actions-bar";
import { FindingsList } from "@/components/findings/findings-list";
import { SavedViewsBar, useSavedViews } from "@/components/findings/saved-views";
import { TriageSubView } from "@/components/findings/triage-sub-view";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockFindings } from "@/lib/mock";
import type { Finding } from "@/lib/mock/types";

const DEFAULT_VIEWS = [
  { id: "open", label: "Open", filters: { status: "open" } },
  { id: "all", label: "All", filters: {} },
  { id: "triage", label: "Candidates", filters: { triage: true } },
];

const noop = () => {};

export default function FindingsPage() {
  const router = useRouter();
  const [selectedFindings, setSelectedFindings] = useState<Finding[]>([]);
  const [currentViewId, setCurrentViewId] = useState("open");
  const { views, saveView } = useSavedViews(DEFAULT_VIEWS);

  const openFindings = mockFindings.filter(
    (f) => f.status !== "resolved" && f.status !== "verify-next-cycle"
  );

  return (
    <div className="space-y-4 px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Findings</h1>
      </div>

      <Tabs defaultValue="findings">
        <TabsList>
          <TabsTrigger value="findings">Findings</TabsTrigger>
          <TabsTrigger value="triage">Triage candidates</TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="space-y-3 mt-4">
          <SavedViewsBar
            currentViewId={currentViewId}
            views={views}
            onSwitchView={setCurrentViewId}
            onSaveView={saveView}
          />

          {selectedFindings.length > 0 && (
            <BulkActionsBar
              selected={selectedFindings}
              onAssign={noop}
              onWatch={noop}
              onExportList={noop}
              onMoveToTriage={noop}
            />
          )}

          <FindingsList
            findings={openFindings}
            onRowOpen={(f) => router.push(`/findings/${f.id}`)}
            onRowSelect={setSelectedFindings}
          />
        </TabsContent>

        <TabsContent value="triage" className="mt-4">
          <TriageSubView
            candidates={mockFindings.slice(0, 3)}
            onPromote={noop}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
