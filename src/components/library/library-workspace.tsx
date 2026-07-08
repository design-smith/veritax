"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { PlanConfirmationModal, type PlanSpec } from "@/components/patterns/pat-4-plan-confirmation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Document, Entity, Flow } from "@/lib/mock/types";
import { ICARegister, type ICAgreement } from "./ica-register";
import { LibraryList } from "./library-list";

interface Notice {
  message: string;
  href?: string;
  hrefLabel?: string;
}

interface PendingPlan {
  agreementId: string;
  plan: PlanSpec;
  runPrefix: string;
}

interface LibraryWorkspaceProps {
  documents: Document[];
  entities: Entity[];
  flows: Flow[];
  onOpenDocument?: (doc: Document) => void;
}

function entityName(entityId: string, entities: Entity[]) {
  return entities.find((entity) => entity.id === entityId)?.name ?? entityId;
}

function partiesFromFlow(flow: Flow, entities: Entity[]) {
  return [entityName(flow.fromEntityId, entities), entityName(flow.toEntityId, entities)];
}

function demoAgreements(flows: Flow[], entities: Entity[]): ICAgreement[] {
  const f1 = flows.find((flow) => flow.id === "f1") ?? flows[0];
  const f10 = flows.find((flow) => flow.id === "f10") ?? flows[1] ?? f1;
  const f5 = flows.find((flow) => flow.id === "f5") ?? flows.find((flow) => !flow.agreementId) ?? f1;

  return [
    {
      id: "a1",
      name: "IC Royalty Agreement — US↔UK (2021)",
      status: "executed",
      parties: f1 ? partiesFromFlow(f1, entities) : ["US principal", "UK counterparty"],
      renewalDate: "2026-12-31",
      linkedFlowIds: ["f1", "f7"],
    },
    {
      id: "a2",
      name: "Commissionnaire Agreement — US↔France (2020)",
      status: "expired",
      parties: f10 ? partiesFromFlow(f10, entities) : ["US principal", "France counterparty"],
      renewalDate: "2023-12-31",
      linkedFlowIds: ["f10", "f11"],
    },
    {
      id: `gap-${f5?.id ?? "flow"}`,
      name: `Flow ${f5?.id ?? "unknown"} — no executed ICA`,
      status: "missing",
      parties: f5 ? partiesFromFlow(f5, entities) : ["Principal", "Counterparty"],
      renewalDate: null,
      linkedFlowIds: [f5?.id ?? "unknown"],
      isGapRow: true,
    },
  ];
}

function uploadDocument(file: File, index: number): Document {
  return {
    id: `upload-${Date.now()}-${index}`,
    name: file.name,
    type: "memo",
    custody: "extract-only",
    sensitivity: "standard",
    jurisdiction: "US",
    fy: "2024",
    version: 1,
    hash: `sha256:pending-${index}`,
    sourcePath: `/upload/${file.name}`,
    entityIds: [],
  };
}

function buildIcaPlan(kind: "draft" | "renewal", targetId: string): PendingPlan {
  const isDraft = kind === "draft";
  const title = isDraft ? "Create agreement draft" : "Draft renewal";
  return {
    agreementId: targetId,
    runPrefix: isDraft ? "agreement-draft" : "renewal-draft",
    plan: {
      intent: `${title} for ${targetId}.`,
      steps: [
        { id: "source", description: "Collect counterparties, linked flows, and prior agreement terms.", scope: targetId },
        { id: "draft", description: "Create a governed agreement draft in Factory." },
        { id: "gate", description: "Route the draft to Legal or manager review before use." },
      ],
      produces: [`${title.toLowerCase()} work item`, "Factory draft shell", "review gate request"],
      invalidates: ["unworked agreement gap status"],
      estimatedDuration: "30s-2min",
      costClass: "standard",
      instruction: `${title} using current intercompany record support.`,
      permissionCheck: "allowed",
      tier: "run",
    },
  };
}

export function LibraryWorkspace({
  documents,
  entities,
  flows,
  onOpenDocument,
}: LibraryWorkspaceProps) {
  const [libraryDocs, setLibraryDocs] = useState(documents);
  const [agreements] = useState(() => demoAgreements(flows, entities));
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<Document | null>(null);
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);

  const documentCount = libraryDocs.length;
  const referenceCount = useMemo(
    () => libraryDocs.filter((doc) => doc.custody === "reference").length,
    [libraryDocs],
  );

  function handleUpload(files: FileList) {
    const uploaded = Array.from(files).map(uploadDocument);
    setLibraryDocs((current) => [...uploaded, ...current]);
    const runId = `ingest-${uploaded[0]?.id ?? "document"}`;
    setNotice({
      message: `Ingestion run created for ${uploaded.length} document${uploaded.length === 1 ? "" : "s"}.`,
      href: `/demo/gathering?run=${runId}`,
      hrefLabel: "View gathering run",
    });
  }

  function confirmPromotion() {
    if (!pendingPromotion) return;
    setLibraryDocs((current) =>
      current.map((doc) =>
        doc.id === pendingPromotion.id ? { ...doc, custody: "materialized", version: doc.version + 1 } : doc,
      ),
    );
    setNotice({ message: `${pendingPromotion.name} promoted to materialized custody.` });
    setPendingPromotion(null);
  }

  function handleDownload(doc: Document) {
    setNotice({ message: `${doc.name} download prepared under policy gate.` });
  }

  function handleOpenAgreement(agreementId: string) {
    const agreement = agreements.find((item) => item.id === agreementId);
    setNotice({ message: `${agreement?.name ?? agreementId} opened in the ICA register.` });
  }

  function handleRequestExecution(agreementId: string) {
    const agreement = agreements.find((item) => item.id === agreementId);
    setNotice({ message: `Data request routed to Legal for ${agreement?.name ?? agreementId}.` });
  }

  function runPlan() {
    if (!pendingPlan) return undefined;
    const runId = `${pendingPlan.runPrefix}-${pendingPlan.agreementId}`;
    setNotice({
      message: `${pendingPlan.plan.intent} Run created.`,
      href: `/demo/gathering?run=${runId}`,
      hrefLabel: "View gathering run",
    });
    return {
      id: runId,
      href: `/demo/gathering?run=${runId}`,
    };
  }

  return (
    <div className="space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="text-sm text-muted-foreground">
            {documentCount} documents in the record, {referenceCount} reference-custody source
            {referenceCount === 1 ? "" : "s"}.
          </p>
        </div>
      </div>

      {notice && (
        <Alert role="status">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            {notice.message}
            {notice.href && (
              <>
                {" "}
                <a href={notice.href} className="font-medium underline underline-offset-2">
                  {notice.hrefLabel ?? "Open"}
                </a>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {pendingPromotion && (
        <Alert className="border-warning/25 bg-warning-soft">
          <AlertTriangle className="h-4 w-4 text-warning-soft-foreground" />
          <AlertDescription className="space-y-2 text-warning-soft-foreground">
            <p>
              Promoting <strong>{pendingPromotion.name}</strong> creates a managed materialized copy,
              records custody, and routes future drift against the record copy.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmPromotion}>
                Confirm promotion
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPendingPromotion(null)}>
                Cancel
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="ica">ICA Register</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4">
          <LibraryList
            documents={libraryDocs}
            entities={entities}
            onOpen={(doc) => onOpenDocument?.(doc)}
            onDownload={handleDownload}
            onPromoteToMaterialized={setPendingPromotion}
            onUpload={handleUpload}
          />
        </TabsContent>

        <TabsContent value="ica" className="mt-4">
          <ICARegister
            agreements={agreements}
            onDraftRenewal={(agreementId) => setPendingPlan(buildIcaPlan("renewal", agreementId))}
            onRequestExecution={handleRequestExecution}
            onOpen={handleOpenAgreement}
            onCreateDraft={(flowId) => setPendingPlan(buildIcaPlan("draft", flowId))}
          />
        </TabsContent>
      </Tabs>

      {pendingPlan && (
        <PlanConfirmationModal
          open={Boolean(pendingPlan)}
          plan={pendingPlan.plan}
          onRun={runPlan}
          onCancel={() => setPendingPlan(null)}
        />
      )}
    </div>
  );
}
