"use client";

import { useRouter } from "next/navigation";
import { LibraryWorkspace } from "@/components/library/library-workspace";
import { mockDocuments, mockEntities, mockFlows } from "@/lib/mock";

export default function DemoLibraryPage() {
  const router = useRouter();
  return (
    <LibraryWorkspace
      documents={mockDocuments}
      entities={mockEntities}
      flows={mockFlows}
      onOpenDocument={(doc) => router.push(`/demo/library/${doc.id}`)}
    />
  );
}
