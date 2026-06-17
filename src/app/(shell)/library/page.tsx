"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ICARegister } from "@/components/library/ica-register";
import { LibraryList } from "@/components/library/library-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockDocuments } from "@/lib/mock";
import type { Document } from "@/lib/mock/types";

const DEMO_AGREEMENTS = [
  { id: "a1", name: "IC Royalty Agreement — US↔UK (2021)", status: "executed" as const, parties: ["Veritax Corp (US)", "Veritax UK Ltd"], renewalDate: "2026-12-31", linkedFlowIds: ["f1", "f7"] },
  { id: "a2", name: "Commissionnaire Agreement — US↔France (2020)", status: "expired" as const, parties: ["Veritax Corp (US)", "Veritax France SAS"], renewalDate: "2023-12-31", linkedFlowIds: ["f10", "f11"] },
  { id: "a3", name: "Flow f5 — US↔Japan (no ICA)", status: "missing" as const, parties: ["Veritax Corp (US)", "Veritax KK"], renewalDate: null, linkedFlowIds: ["f5"], isGapRow: true },
];

const noop = () => {};

export default function LibraryPage() {
  const router = useRouter();

  return (
    <div className="space-y-4 px-6 py-6">
      <h1 className="text-2xl font-semibold">Library</h1>

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="ica">ICA Register</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4">
          <LibraryList
            documents={mockDocuments}
            onOpen={(doc: Document) => router.push(`/library/${doc.id}`)}
            onDownload={noop}
          />
        </TabsContent>

        <TabsContent value="ica" className="mt-4">
          <ICARegister
            agreements={DEMO_AGREEMENTS}
            onDraftRenewal={noop}
            onRequestExecution={noop}
            onOpen={noop}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
