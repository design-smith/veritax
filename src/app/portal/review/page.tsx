"use client";

import { useState } from "react";
import { ReviewQueue } from "@/components/portals/review/review-queue";
import { SignCeremony } from "@/components/portals/review/sign-ceremony";
import { HoursLog } from "@/components/portals/review/hours-log";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReviewAssignment } from "@/components/portals/review/review-queue";
import type { HoursEntry } from "@/components/portals/review/hours-log";

const DEMO_ASSIGNMENTS: ReviewAssignment[] = [
  { id: "a1", docName: "Veritax UK Local File FY2024", docType: "local-file", status: "assigned", redlineCount: 3 },
  { id: "a2", docName: "Group Master File FY2024", docType: "master-file", status: "in-progress", redlineCount: 0 },
  { id: "a3", docName: "Benchmark Study FY2022", docType: "benchmark", status: "signed", redlineCount: 0 },
];

const DEMO_HOURS: HoursEntry[] = [
  { id: "h1", docId: "a1", docName: "Veritax UK Local File FY2024", hours: 2.5, date: "2025-11-20" },
];

const noop = () => {};

export default function ReviewPortalPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hours, setHours] = useState<HoursEntry[]>(DEMO_HOURS);

  const selectedDoc = DEMO_ASSIGNMENTS.find((a) => a.id === selectedId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Review Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">Documents assigned to you for review.</p>
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          {selectedDoc && <TabsTrigger value="sign">Sign — {selectedDoc.docName}</TabsTrigger>}
          <TabsTrigger value="hours">Hours log</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4">
          <ReviewQueue assignments={DEMO_ASSIGNMENTS} onOpen={setSelectedId} />
        </TabsContent>

        {selectedDoc && (
          <TabsContent value="sign" className="mt-4">
            <SignCeremony
              docName={selectedDoc.docName}
              reviewerName="External Reviewer A"
              attestationText="I confirm that I have reviewed the above document and it accurately reflects the transfer pricing policies and arm's length nature of the intercompany transactions described herein, to the best of my knowledge."
              onSeal={noop}
            />
          </TabsContent>
        )}

        <TabsContent value="hours" className="mt-4">
          <HoursLog
            entries={hours}
            onAddEntry={(payload) => {
              setHours((prev) => [
                ...prev,
                { id: `h${Date.now()}`, docId: selectedId ?? "general", docName: selectedDoc?.docName ?? "General review", ...payload },
              ]);
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
