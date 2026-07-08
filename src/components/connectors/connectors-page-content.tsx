"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { mockUsers } from "@/lib/mock";
import { cn } from "@/lib/utils";

type SourceType = "ERP" | "HRIS" | "email" | "sharepoint" | "license-db" | "messaging";
type CustodyClass = "shared" | "personal";
type SourceHealth = "healthy" | "stale" | "down" | "paused";
type PolicyState = "self-serve" | "request" | "disabled";

interface ConnectorSource {
  id: string;
  name: string;
  type: SourceType;
  custodyClass: CustodyClass;
  scope: string;
  itCeiling: string;
  lastSync: string;
  lagHours: number;
  volumeDocs: number;
  ownerId: string;
  health: SourceHealth;
  syncLog: string[];
}

interface CatalogEntry {
  id: string;
  name: string;
  type: SourceType;
  policyState: PolicyState;
  description: string;
}

interface SourceRequest {
  id: string;
  sourceName: string;
  justification: string;
  status: "pending IT" | "approved";
}

interface BackfillRequest {
  id: string;
  sourceName: string;
  scope: string;
  estimate: string;
  status: "manager approval required" | "queued";
}

type ActivePanel =
  | { type: "none" }
  | { type: "sync-log"; sourceId: string }
  | { type: "scope"; sourceId: string }
  | { type: "disconnect"; sourceId: string }
  | { type: "backfill"; sourceId: string }
  | { type: "request"; catalogId: string };

const INITIAL_SOURCES: ConnectorSource[] = [
  {
    id: "s1",
    name: "SAP ERP",
    type: "ERP",
    custodyClass: "shared",
    scope: "Full GL, all periods",
    itCeiling: "IT permits: GL read-only",
    lastSync: "2025-11-22T06:00:00Z",
    lagHours: 0,
    volumeDocs: 18420,
    ownerId: "u2",
    health: "healthy",
    syncLog: ["06:00 sync completed", "18,420 records indexed", "No schema drift detected"],
  },
  {
    id: "s2",
    name: "Payroll System",
    type: "HRIS",
    custodyClass: "shared",
    scope: "Headcount and payroll extracts",
    itCeiling: "IT permits: payroll read-only",
    lastSync: "2025-10-28T06:00:00Z",
    lagHours: 648,
    volumeDocs: 1200,
    ownerId: "u2",
    health: "stale",
    syncLog: ["06:00 sync failed", "Credential rotation required", "Last successful sync: 28 Oct"],
  },
  {
    id: "s3",
    name: "email forward",
    type: "email",
    custodyClass: "personal",
    scope: "Label-scoped read-only",
    itCeiling: "IT permits: label-scoped read-only",
    lastSync: "2025-11-21T14:00:00Z",
    lagHours: 22,
    volumeDocs: 47,
    ownerId: "u3",
    health: "healthy",
    syncLog: ["14:00 forward mailbox processed", "47 receipts indexed", "No privileged content retained"],
  },
];

const CATALOG: CatalogEntry[] = [
  { id: "cat-license", name: "License Database", type: "license-db", policyState: "self-serve", description: "Read-only license and royalty comparable source." },
  { id: "cat-workday", name: "Workday HRIS", type: "HRIS", policyState: "request", description: "Shared HRIS source; requires IT policy review." },
  { id: "cat-sharepoint", name: "SharePoint", type: "sharepoint", policyState: "request", description: "Document library connector for tax folders." },
  { id: "cat-slack", name: "Slack", type: "messaging", policyState: "disabled", description: "Messaging ingestion disabled by IT ceiling." },
];

const FORWARD_ADDRESS = "ingest-abc123@veritax.io";

function ownerName(ownerId: string) {
  return mockUsers.find((user) => user.id === ownerId)?.name ?? "Unassigned";
}

function healthClass(health: SourceHealth) {
  if (health === "healthy") return "border-transparent bg-success-soft text-success-soft-foreground";
  if (health === "stale") return "border-transparent bg-warning-soft text-warning-soft-foreground";
  if (health === "down") return "border-transparent bg-danger-soft text-danger-soft-foreground";
  return "border-border text-muted-foreground";
}

function policyClass(policyState: PolicyState) {
  if (policyState === "self-serve") return "border-transparent bg-success-soft text-success-soft-foreground";
  if (policyState === "request") return "border-transparent bg-warning-soft text-warning-soft-foreground";
  return "border-border text-muted-foreground";
}

export function ConnectorsPageContent() {
  const [sources, setSources] = useState<ConnectorSource[]>(INITIAL_SOURCES);
  const [activePanel, setActivePanel] = useState<ActivePanel>({ type: "none" });
  const [notice, setNotice] = useState("Sources ready for review.");
  const [scopeDraft, setScopeDraft] = useState("");
  const [backfillScope, setBackfillScope] = useState("FY2024");
  const [requests, setRequests] = useState<SourceRequest[]>([]);
  const [requestJustification, setRequestJustification] = useState("");
  const [backfills, setBackfills] = useState<BackfillRequest[]>([]);

  const selectedSource =
    activePanel.type !== "none" && activePanel.type !== "request"
      ? sources.find((source) => source.id === activePanel.sourceId)
      : null;
  const selectedCatalog = activePanel.type === "request" ? CATALOG.find((entry) => entry.id === activePanel.catalogId) : null;

  const sourceRows = useMemo(() => sources, [sources]);

  function pauseSource(sourceId: string) {
    const source = sources.find((item) => item.id === sourceId);
    setSources((current) =>
      current.map((item) => (item.id === sourceId ? { ...item, health: "paused" } : item)),
    );
    setNotice(`${source?.name ?? "Source"} paused.`);
  }

  function beginScopeEdit(source: ConnectorSource) {
    setScopeDraft(source.scope);
    setActivePanel({ type: "scope", sourceId: source.id });
  }

  function saveScope() {
    if (activePanel.type !== "scope") return;
    setSources((current) =>
      current.map((source) =>
        source.id === activePanel.sourceId ? { ...source, scope: scopeDraft.trim() || source.scope } : source,
      ),
    );
    setNotice("Source scope updated within IT ceiling.");
    setActivePanel({ type: "none" });
  }

  function disconnectSource() {
    if (activePanel.type !== "disconnect" || !selectedSource) return;
    setSources((current) => current.filter((source) => source.id !== selectedSource.id));
    setNotice(`${selectedSource.name} disconnected; reference-orphan consequence recorded.`);
    setActivePanel({ type: "none" });
  }

  function submitBackfill() {
    if (activePanel.type !== "backfill" || !selectedSource) return;
    setBackfills((current) => [
      ...current,
      {
        id: `bf-${Date.now()}`,
        sourceName: selectedSource.name,
        scope: backfillScope,
        estimate: selectedSource.custodyClass === "shared" ? "2,400 records, batch class" : "120 records, fast class",
        status: selectedSource.custodyClass === "shared" ? "manager approval required" : "queued",
      },
    ]);
    setNotice(
      selectedSource.custodyClass === "shared"
        ? "Backfill request routed for manager approval."
        : "Backfill request queued.",
    );
    setActivePanel({ type: "none" });
  }

  function connectSelfServe(entry: CatalogEntry) {
    setSources((current) => [
      ...current,
      {
        id: `source-${entry.id}`,
        name: entry.name,
        type: entry.type,
        custodyClass: "shared",
        scope: "Policy-scoped read-only",
        itCeiling: "IT permits: source-scoped read-only",
        lastSync: new Date().toISOString(),
        lagHours: 0,
        volumeDocs: 0,
        ownerId: "u2",
        health: "healthy",
        syncLog: ["Connector created", "Initial sync queued"],
      },
    ]);
    setNotice(`${entry.name} connected under self-serve policy.`);
  }

  function submitSourceRequest() {
    if (!selectedCatalog) return;
    setRequests((current) => [
      ...current,
      {
        id: `req-${selectedCatalog.id}`,
        sourceName: selectedCatalog.name,
        justification: requestJustification.trim(),
        status: "pending IT",
      },
    ]);
    setRequestJustification("");
    setNotice(`${selectedCatalog.name} request routed to IT.`);
    setActivePanel({ type: "none" });
  }

  function copyForwardAddress() {
    setNotice(`Forward address copied: ${FORWARD_ADDRESS}`);
  }

  function connectMailboxOAuth() {
    setSources((current) => [
      ...current,
      {
        id: "source-mailbox-oauth",
        name: "Mailbox OAuth",
        type: "email",
        custodyClass: "personal",
        scope: "User-approved mailbox labels",
        itCeiling: "IT permits: personal mailbox OAuth for Tax labels",
        lastSync: new Date().toISOString(),
        lagHours: 0,
        volumeDocs: 0,
        ownerId: "u3",
        health: "healthy",
        syncLog: ["OAuth consent captured", "Initial label scan queued"],
      },
    ]);
    setNotice("Mailbox OAuth connected within personal policy.");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connectors & Sources</h1>
          <p className="text-sm text-muted-foreground">
            Source health, custody, IT ceilings, and backfill requests for the Record.
          </p>
        </div>
        <div role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
          {notice}
        </div>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active sources</TabsTrigger>
          <TabsTrigger value="add">Add source</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <section aria-label="Sources table" className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-[1160px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Source", "Type", "Custody", "Scope summary", "Health", "Volume", "Owner", "Actions"].map((heading) => (
                    <th key={heading} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sourceRows.map((source) => (
                  <tr key={source.id} className="bg-card transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{source.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Last sync {format(parseISO(source.lastSync), "MMM d, HH:mm")} | lag {source.lagHours}h
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">{source.type}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs capitalize">{source.custodyClass}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div>{source.scope}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{source.itCeiling}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn("text-xs capitalize", healthClass(source.health))}>
                        {source.health}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{source.volumeDocs.toLocaleString()}</td>
                    <td className="px-4 py-3">{ownerName(source.ownerId)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setActivePanel({ type: "sync-log", sourceId: source.id })}>
                          Open sync log
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => pauseSource(source.id)}>
                          Pause
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => beginScopeEdit(source)}>
                          Edit scope
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setActivePanel({ type: "backfill", sourceId: source.id })}>
                          Request backfill
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setActivePanel({ type: "disconnect", sourceId: source.id })}>
                          Disconnect
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {activePanel.type === "sync-log" && selectedSource ? (
            <section aria-label="Sync log" className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">{selectedSource.name} sync log</h2>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {selectedSource.syncLog.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {activePanel.type === "scope" && selectedSource ? (
            <section aria-label="Edit source scope" className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Edit scope</h2>
              <p className="mt-1 text-sm text-muted-foreground">{selectedSource.itCeiling}</p>
              <label className="mt-3 block space-y-1 text-xs font-medium text-muted-foreground">
                <span>Scope summary</span>
                <Input value={scopeDraft} onChange={(event) => setScopeDraft(event.target.value)} />
              </label>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={saveScope}>Save scope</Button>
              </div>
            </section>
          ) : null}

          {activePanel.type === "backfill" && selectedSource ? (
            <section aria-label="Historical backfill" className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Historical backfill</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedSource.custodyClass === "shared" ? "Manager approval required for shared sources." : "Personal backfills queue within policy."}
              </p>
              <label className="mt-3 block max-w-sm space-y-1 text-xs font-medium text-muted-foreground">
                <span>Backfill scope</span>
                <select
                  className="h-8 w-full rounded-md border border-input bg-surface px-2 text-sm text-foreground"
                  value={backfillScope}
                  onChange={(event) => setBackfillScope(event.target.value)}
                >
                  <option value="FY2024">FY2024</option>
                  <option value="FY2023-FY2024">FY2023-FY2024</option>
                  <option value="FY2022-FY2024">FY2022-FY2024</option>
                </select>
              </label>
              <div className="mt-3 text-sm text-muted-foreground">Estimate: 2,400 records, batch class</div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={submitBackfill}>Submit backfill request</Button>
              </div>
            </section>
          ) : null}

          {activePanel.type === "disconnect" && selectedSource ? (
            <section aria-label="Disconnect consequence" className="rounded-lg border border-danger/25 bg-danger-soft p-4">
              <h2 className="text-sm font-semibold text-danger-soft-foreground">Disconnect consequence</h2>
              <p className="mt-2 text-sm text-danger-soft-foreground">
                {selectedSource.volumeDocs.toLocaleString()} documents become reference-orphaned.
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setActivePanel({ type: "none" })}>Cancel</Button>
                <Button size="sm" variant="destructive" onClick={disconnectSource}>Confirm disconnect</Button>
              </div>
            </section>
          ) : null}

          {backfills.length > 0 ? (
            <section aria-label="Backfill status" className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Backfill status</h2>
              <div className="mt-3 space-y-2">
                {backfills.map((request) => (
                  <div key={request.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                    <span className="font-medium">{request.sourceName}</span> | {request.scope} | {request.estimate} | {request.status}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="add" className="space-y-4">
          <section aria-label="Add source catalog" className="grid gap-3 md:grid-cols-2">
            {CATALOG.map((entry) => (
              <article
                key={entry.id}
                aria-label={entry.name}
                className={cn("rounded-lg border border-border bg-card p-4", entry.policyState === "disabled" && "opacity-55")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{entry.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{entry.description}</p>
                  </div>
                  <Badge variant="outline" className={cn("capitalize", policyClass(entry.policyState))}>
                    {entry.policyState === "self-serve" ? "Self-serve" : entry.policyState === "request" ? "Request" : "Disabled"}
                  </Badge>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  {entry.policyState === "self-serve" ? (
                    <Button size="sm" onClick={() => connectSelfServe(entry)}>Connect</Button>
                  ) : null}
                  {entry.policyState === "request" ? (
                    <Button size="sm" variant="outline" onClick={() => setActivePanel({ type: "request", catalogId: entry.id })}>
                      Request access
                    </Button>
                  ) : null}
                  {entry.policyState === "disabled" ? (
                    <Button size="sm" variant="outline" disabled>Disabled by IT</Button>
                  ) : null}
                </div>
              </article>
            ))}
          </section>

          <section aria-label="Personal email ladder" className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Personal email ladder</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-border bg-surface p-3">
                <p className="text-sm font-medium">Forward-address always available</p>
                <p className="mt-1 font-mono text-sm text-muted-foreground">{FORWARD_ADDRESS}</p>
                <Button size="sm" className="mt-3" variant="outline" onClick={copyForwardAddress}>Copy forward address</Button>
              </div>
              <div className="rounded-md border border-border bg-surface p-3">
                <p className="text-sm font-medium">Mailbox OAuth where permitted</p>
                <p className="mt-1 text-sm text-muted-foreground">IT permits: personal mailbox OAuth for Tax labels.</p>
                <Button size="sm" className="mt-3" onClick={connectMailboxOAuth}>Connect mailbox OAuth</Button>
              </div>
            </div>
          </section>

          {activePanel.type === "request" && selectedCatalog ? (
            <section aria-label="Source request form" className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Request {selectedCatalog.name}</h2>
              <label className="mt-3 block space-y-1 text-xs font-medium text-muted-foreground">
                <span>Business justification</span>
                <Textarea value={requestJustification} onChange={(event) => setRequestJustification(event.target.value)} />
              </label>
              <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={submitSourceRequest}>Submit source request</Button>
              </div>
            </section>
          ) : null}

          {requests.length > 0 ? (
            <section aria-label="Source request status" className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Source request status</h2>
              <div className="mt-3 space-y-2">
                {requests.map((request) => (
                  <div key={request.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                    <span className="font-medium">{request.sourceName}</span> | {request.status} | {request.justification}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
