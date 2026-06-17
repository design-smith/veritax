"use client";

import { AddSourceCatalog } from "@/components/connectors/add-source-catalog";
import { SourcesTable } from "@/components/connectors/sources-table";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEMO_SOURCES = [
  { id: "s1", name: "SAP ERP", type: "ERP" as const, custodyClass: "shared" as const, scope: "Full GL, all periods", lastSync: "2025-11-22T06:00:00Z", lagHours: 0, volumeDocs: 18_420, ownerId: "u2", health: "healthy" as const },
  { id: "s2", name: "Payroll System", type: "HRIS" as const, custodyClass: "shared" as const, scope: "Headcount, payroll", lastSync: "2025-10-28T06:00:00Z", lagHours: 648, volumeDocs: 1_200, ownerId: "u2", health: "stale" as const },
  { id: "s3", name: "ingest-abc123@veritax.io (email forward)", type: "email" as const, custodyClass: "personal" as const, scope: "Label-scoped read-only", lastSync: "2025-11-21T14:00:00Z", lagHours: 22, volumeDocs: 47, ownerId: "u3", health: "healthy" as const },
];

const DEMO_CATALOG = [
  { id: "cat1", name: "SAP ERP", type: "ERP" as const, itPolicyState: "self-serve" as const },
  { id: "cat2", name: "Workday HRIS", type: "HRIS" as const, itPolicyState: "request" as const },
  { id: "cat3", name: "SharePoint", type: "sharepoint" as const, itPolicyState: "request" as const },
  { id: "cat4", name: "Slack", type: "messaging" as const, itPolicyState: "disabled" as const },
];

const noop = () => {};

export default function ConnectorsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <h1 className="text-2xl font-semibold">Connectors & Sources</h1>
      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active sources</TabsTrigger>
          <TabsTrigger value="add">Add source</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          <SourcesTable sources={DEMO_SOURCES} onPause={noop} onDisconnect={noop} />
        </TabsContent>
        <TabsContent value="add" className="mt-4">
          <AddSourceCatalog entries={DEMO_CATALOG} onConnect={noop} onRequest={noop} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
