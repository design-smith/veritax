"use client";

import { use } from "react";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { DocumentViewerPageContent } from "@/components/library/document-viewer-page-content";
import { mockDocuments, mockFindings, mockUsers } from "@/lib/mock";

export default function DemoDocumentViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const document = mockDocuments.find((doc) => doc.id === id);

  if (!document) notFound();

  return (
    <DocumentViewerPageContent
      document={document}
      users={mockUsers}
      findings={mockFindings}
      originLabel={searchParams.get("returnLabel") ?? "Library"}
      initialAnchorId={searchParams.get("anchor") ?? undefined}
      onBack={() => router.push(searchParams.get("returnTo") ?? "/demo/library")}
    />
  );
}
