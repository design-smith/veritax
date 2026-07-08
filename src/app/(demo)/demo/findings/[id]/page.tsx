"use client";

import { use } from "react";
import { notFound, useRouter } from "next/navigation";
import { FindingDetailPageContent } from "@/components/findings/finding-detail-page-content";
import { mockDocuments, mockEntities, mockFindings, mockFlows, mockUsers } from "@/lib/mock";

export default function DemoFindingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const finding = mockFindings.find((f) => f.id === id);

  if (!finding) notFound();

  return (
    <FindingDetailPageContent
      finding={finding}
      flows={mockFlows}
      entities={mockEntities}
      documents={mockDocuments}
      users={mockUsers}
      onClose={() => router.push("/demo/findings")}
    />
  );
}
