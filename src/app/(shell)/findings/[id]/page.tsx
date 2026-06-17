"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { FindingActionsRow } from "@/components/findings/finding-actions-row";
import { FindingDetailInspector } from "@/components/findings/finding-detail-inspector";
import { FindingHistoryTab } from "@/components/findings/finding-history-tab";
import { FindingLifecycleIndicator } from "@/components/findings/finding-lifecycle-indicator";
import { ProvenanceBlock } from "@/components/findings/provenance-block";
import { RemediationPaths } from "@/components/findings/remediation-paths";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockFindings } from "@/lib/mock";

const DEMO_EXHIBITS = [
  { id: "ex1", docName: "UK Local File FY2024", section: "§4.2", snippet: "The royalty rate applied is 18%", confidence: 0.91, extractorVersion: "v2.4.1" },
  { id: "ex2", docName: "TP Policy FY2024", section: "§3.1", snippet: "Policy rate shall be 12%", confidence: 0.95, extractorVersion: "v2.4.1" },
];

const DEMO_PATHS = [
  { id: "p1", title: "Adjust royalty rate to upper quartile", description: "Amend the ICA to cap the rate at the CUT upper quartile.", effortClass: "medium" as const, affectedObjects: ["UK Local File §4.2", "UK Tax Return"] },
  { id: "p2", title: "Commission new benchmark study", description: "Engage external firm to refresh comparables.", effortClass: "high" as const, affectedObjects: ["Benchmark Study FY2024"] },
];

const noop = () => {};

export default function FindingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const finding = mockFindings.find((f) => f.id === id) ?? mockFindings[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
      {/* Lifecycle */}
      <FindingLifecycleIndicator status={finding.status} />

      <Separator />

      {/* Detail inspector (narrative, exposure, exhibits) */}
      <FindingDetailInspector
        finding={finding}
        exhibits={DEMO_EXHIBITS}
        onClose={() => router.push("/findings")}
      />

      <Separator />

      {/* Provenance */}
      <ProvenanceBlock
        ruleId={finding.ruleId}
        ruleDescription="Rate materially exceeds benchmark upper quartile"
        extractorVersion="v2.4.1"
        modelVersion="claude-sonnet-4-6"
        confidence={finding.confidence / 100}
        calibrationNote="Well-calibrated on IC royalty comparisons"
        comparisonSpans={[
          { label: "Policy rate", text: "Applicable rate: 12%", docName: "TP Policy FY2024", section: "§3.1" },
          { label: "Observed rate", text: "Charged rate: 18%", docName: "UK Local File FY2024", section: "§4.2" },
        ]}
      />

      <Separator />

      {/* Remediation paths */}
      <div>
        <h2 className="mb-3 text-sm font-semibold">Remediation paths</h2>
        <RemediationPaths paths={DEMO_PATHS} onSelectPath={noop} />
      </div>

      <Separator />

      {/* Actions row */}
      <FindingActionsRow
        findingId={finding.id}
        findingType="exception"
        reviewerState={finding.reviewerState}
        onConfirm={noop}
        onDismiss={noop}
        onAssign={noop}
        onComment={noop}
        onExportMemo={noop}
      />

      <Separator />

      {/* History tab */}
      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="mt-3">
          <FindingHistoryTab events={[]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
