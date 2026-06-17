"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { FlowPageContent } from "@/components/graph/flow-page-content";
import { mockFlows, mockEntities } from "@/lib/mock";

const DEMO_COVERAGE = [
  { jurisdiction: "United Kingdom", jurisdictionCode: "GB", hasLocalFile: true, documentId: "d2" },
  { jurisdiction: "United States", jurisdictionCode: "US", hasLocalFile: true, documentId: "d1" },
];

const noop = () => {};

export default function FlowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const flow = mockFlows.find((f) => f.id === id);
  if (!flow) notFound();

  const fromEntity = mockEntities.find((e) => e.id === flow.fromEntityId);
  const toEntity = mockEntities.find((e) => e.id === flow.toEntityId);
  if (!fromEntity || !toEntity) notFound();

  return (
    <FlowPageContent
      flow={flow}
      fromEntity={fromEntity}
      toEntity={toEntity}
      coverageByJurisdiction={DEMO_COVERAGE}
      onRetest={noop}
      onOpenInFactory={() => router.push("/factory")}
      onProposePolicyChange={noop}
    />
  );
}
