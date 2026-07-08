"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle, FileCheck, LockKeyhole, PackageCheck } from "lucide-react";
import { ExportDialog } from "@/components/patterns/pat-10-export";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FactoryWorkspace, type WorkspaceSection } from "./factory-workspace";
import { InlineDirectiveCanvas } from "./inline-directive-canvas";
import {
  PIPELINE_STAGES,
  isLegalTransition,
  type PipelineDocument,
  type PipelineStageId,
} from "./pipeline-data";
import { PipelineKanban } from "./pipeline-kanban";
import { RedlineToggle } from "./redline-toggle";

type CheckState = "pass" | "fail" | "pending";

interface SectionCheck {
  id: string;
  label: string;
  state: CheckState;
  citation?: string;
}

interface FactoryDocument extends PipelineDocument {
  subtitle: string;
  reviewState: "drafting" | "internal-approved" | "external-review" | "signed" | "filed";
  signGateRequested?: boolean;
  sections: WorkspaceSection[];
  checks: Record<string, SectionCheck[]>;
}

const INITIAL_DOCUMENTS: FactoryDocument[] = [
  {
    id: "pd1",
    name: "Veritax UK Local File FY2024",
    subtitle: "Draft v2 - internal review passed",
    fy: "2024",
    jurisdiction: "GB",
    version: 2,
    stage: "internal-review",
    reviewState: "internal-approved",
    redlineCount: 3,
    blockerChips: [],
    sections: [
      {
        id: "uk-intro",
        title: "1. Introduction",
        status: "generated",
        content:
          "This local file describes the transfer pricing policies of Veritax UK Ltd for the fiscal year ended 31 December 2024.",
        inputChips: [
          { label: "Entity profile", ref: "entity:uk" },
          { label: "FAR summary", ref: "doc:far-uk" },
        ],
      },
      {
        id: "uk-analysis",
        title: "2. Transfer Pricing Analysis",
        status: "stale",
        content:
          "The royalty rate applied to Veritax UK Ltd is 18%, charged by the US principal entity. The arm's length range established by the CUT benchmark study is 10-14%.",
        inputChips: [
          { label: "Benchmark study", ref: "doc:bench-cut" },
          { label: "TP Policy FY2024", ref: "doc:tp-policy" },
        ],
      },
      {
        id: "uk-conclusion",
        title: "3. Conclusions",
        status: "generated",
        content:
          "The UK local file can route to external review after the current internal-approved draft is staged.",
        inputChips: [{ label: "Finding FN-018", ref: "finding:fn-018" }],
      },
    ],
    checks: {
      "uk-intro": [{ id: "c1", label: "Entity name cited", state: "pass", citation: "doc:far-uk p.2" }],
      "uk-analysis": [{ id: "c2", label: "Range source stale since benchmark refresh", state: "pending" }],
      "uk-conclusion": [{ id: "c3", label: "No open blocker for external review", state: "pass" }],
    },
  },
  {
    id: "pd2",
    name: "Veritax GmbH Local File FY2024",
    subtitle: "Queued - ready to generate",
    fy: "2024",
    jurisdiction: "DE",
    version: 1,
    stage: "queued",
    reviewState: "drafting",
    redlineCount: 0,
    blockerChips: [],
    sections: [
      {
        id: "de-intro",
        title: "1. Scope",
        status: "generated",
        content:
          "The Germany local file is queued from the current Record scope for Helios GmbH distributor activities.",
        inputChips: [
          { label: "Entity profile", ref: "entity:de" },
          { label: "Agreement ICA-DE-24", ref: "agreement:ica-de-24" },
        ],
      },
      {
        id: "de-analysis",
        title: "2. Policy Evidence",
        status: "generated",
        content:
          "The file will cite the executed distributor agreement and the latest segmented P&L once generation starts.",
        inputChips: [{ label: "Segmented P&L", ref: "pl:de-2024" }],
      },
    ],
    checks: {
      "de-intro": [{ id: "c4", label: "Generation scope compiled", state: "pass" }],
      "de-analysis": [{ id: "c5", label: "Awaiting generated assertions", state: "pending" }],
    },
  },
  {
    id: "pd3",
    name: "Group Master File FY2024",
    subtitle: "Self-check failed",
    fy: "2024",
    jurisdiction: "US",
    version: 3,
    stage: "self-check",
    reviewState: "drafting",
    redlineCount: 0,
    blockerChips: ["failed assertion: section 4.2"],
    sections: [
      {
        id: "mf-overview",
        title: "4.2 Intangibles",
        status: "blocked",
        content:
          "The intangibles section conflicts with the executed royalty agreement and cannot move forward until the evidence is reconciled.",
        inputChips: [
          { label: "US royalty agreement", ref: "agreement:us-royalty" },
          { label: "Finding FN-024", ref: "finding:fn-024" },
        ],
      },
    ],
    checks: {
      "mf-overview": [
        { id: "c6", label: "Royalty rate contradicts executed agreement", state: "fail", citation: "agreement:us-royalty p.7" },
      ],
    },
  },
  {
    id: "pd4",
    name: "Singapore Local File FY2024",
    subtitle: "Generating",
    fy: "2024",
    jurisdiction: "SG",
    version: 1,
    stage: "generating",
    reviewState: "drafting",
    redlineCount: 0,
    blockerChips: [],
    sections: [
      {
        id: "sg-intro",
        title: "1. Entity Role",
        status: "pending-self-check",
        content:
          "The Singapore local file is compiling the service-provider profile from the current Record.",
        inputChips: [{ label: "Service provider profile", ref: "entity:sg" }],
      },
    ],
    checks: {
      "sg-intro": [{ id: "c7", label: "Self-check running", state: "pending" }],
    },
  },
];

const REDLINE_SECTIONS = [
  {
    id: "uk-intro",
    title: "1. Introduction",
    currentText:
      "This local file describes the transfer pricing policies of Veritax UK Ltd for the fiscal year ended 31 December 2024.",
    priorText:
      "This local file describes the transfer pricing policies of Veritax UK Ltd for the fiscal year ended 31 December 2023.",
  },
  {
    id: "uk-analysis",
    title: "2. Transfer Pricing Analysis",
    currentText: "The royalty rate applied to Veritax UK Ltd is 18%.",
    priorText: "The royalty rate applied to Veritax UK Ltd is 12%.",
  },
];

function stageLabel(stage: PipelineStageId) {
  return PIPELINE_STAGES.find((item) => item.id === stage)?.label ?? stage;
}

function nextStageFor(stage: PipelineStageId) {
  return PIPELINE_STAGES.find((item) => item.id === stage)?.nextStage ?? null;
}

function actionLabelFor(stage: PipelineStageId) {
  return PIPELINE_STAGES.find((item) => item.id === stage)?.actionLabel ?? null;
}

function inlineStatusFor(section: WorkspaceSection) {
  if (section.status === "pending-self-check") return "pending-self-check" as const;
  if (section.status === "blocked") return "self-check-fail" as const;
  if (section.status === "generated" || section.status === "edited") return "self-check-pass" as const;
  return "idle" as const;
}

function hasBlockingChecks(doc: FactoryDocument) {
  return doc.blockerChips.length > 0 || Object.values(doc.checks).flat().some((check) => check.state === "fail");
}

export function FactoryPageContent() {
  const [documents, setDocuments] = useState<FactoryDocument[]>(INITIAL_DOCUMENTS);
  const [selectedDocId, setSelectedDocId] = useState(INITIAL_DOCUMENTS[0].id);
  const [selectedSectionId, setSelectedSectionId] = useState(INITIAL_DOCUMENTS[0].sections[0].id);
  const [activeTab, setActiveTab] = useState("workspace");
  const [notice, setNotice] = useState("Factory is scoped to FY2024 and current Record v418.");
  const [exportOpen, setExportOpen] = useState(false);

  const selectedDocument = documents.find((doc) => doc.id === selectedDocId) ?? documents[0];
  const selectedSection =
    selectedDocument.sections.find((section) => section.id === selectedSectionId) ?? selectedDocument.sections[0];
  const nextStage = nextStageFor(selectedDocument.stage);
  const nextAction = actionLabelFor(selectedDocument.stage);
  const exportBlockers = useMemo(() => {
    const failedChecks = Object.values(selectedDocument.checks).flat().filter((check) => check.state === "fail").length;
    return failedChecks + selectedDocument.blockerChips.length;
  }, [selectedDocument]);

  function selectDocument(docId: string) {
    const doc = documents.find((item) => item.id === docId);
    if (!doc) return;
    setSelectedDocId(doc.id);
    setSelectedSectionId(doc.sections[0]?.id ?? "");
    setActiveTab("workspace");
    setNotice(`${doc.name} opened in the workspace.`);
  }

  function moveDocument(docId: string, toStage: PipelineStageId) {
    const doc = documents.find((item) => item.id === docId);
    if (!doc || !isLegalTransition(doc.stage, toStage)) {
      setNotice("Stage move refused because the requested transition is not legal.");
      return;
    }
    if (hasBlockingChecks(doc)) {
      setNotice(`${doc.name} cannot move until blockers clear.`);
      return;
    }
    if (toStage === "signed") {
      setDocuments((current) =>
        current.map((item) =>
          item.id === docId
            ? {
                ...item,
                signGateRequested: true,
                blockerChips: item.blockerChips.includes("sign-off gate pending")
                  ? item.blockerChips
                  : [...item.blockerChips, "sign-off gate pending"],
              }
            : item,
        ),
      );
      setNotice(`${doc.name} sign-off gate requested for designated signer.`);
      return;
    }
    setDocuments((current) =>
      current.map((item) =>
        item.id === docId
          ? {
              ...item,
              stage: toStage,
              reviewState:
                toStage === "external-review"
                  ? "external-review"
                  : toStage === "filed"
                    ? "filed"
                    : item.reviewState,
            }
          : item,
      ),
    );
    setNotice(`${doc.name} moved to ${stageLabel(toStage)}.`);
  }

  function batchMoveDocuments(docIds: string[], toStage: PipelineStageId) {
    docIds.forEach((docId) => moveDocument(docId, toStage));
    setNotice(`${docIds.length} document moved to ${stageLabel(toStage)}.`);
  }

  function handleInlineInstruction(sectionId: string, selectedText: string, instruction?: string) {
    setDocuments((current) =>
      current.map((doc) => {
        if (doc.id !== selectedDocument.id) return doc;
        return {
          ...doc,
          sections: doc.sections.map((section) =>
            section.id === sectionId ? { ...section, status: "pending-self-check" } : section,
          ),
          checks: {
            ...doc.checks,
            [sectionId]: [
              {
                id: `directive-${Date.now()}`,
                label: `Inline directive queued: ${instruction || selectedText}`,
                state: "pending",
              },
            ],
          },
        };
      }),
    );
    setNotice(`Run created for inline directive on ${selectedText}.`);
  }

  function markDirectiveSelection(sectionId: string, selectedText: string) {
    const section = selectedDocument.sections.find((item) => item.id === sectionId);
    setNotice(`Instruction captured for ${section?.title ?? "section"}: ${selectedText}.`);
  }

  function renderContextPanel(tab: "Sources" | "Comments" | "Checks", section: WorkspaceSection | undefined) {
    if (!section) return null;
    if (tab === "Sources") {
      return (
        <div className="space-y-2 text-xs">
          <p className="font-medium">Input chips</p>
          {section.inputChips.length === 0 ? (
            <p className="text-muted-foreground">No input chips on this section.</p>
          ) : (
            section.inputChips.map((chip) => (
              <div key={chip.ref} className="rounded-md border border-border bg-card p-2">
                <p className="font-medium">{chip.label}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{chip.ref}</p>
              </div>
            ))
          )}
        </div>
      );
    }
    if (tab === "Comments") {
      return (
        <div className="space-y-2 text-xs">
          <p className="font-medium">Anchored comments</p>
          <div className="rounded-md border border-border bg-card p-2 text-muted-foreground">
            Manager review notes remain anchored to this section and route through Digest.
          </div>
        </div>
      );
    }
    const checks = selectedDocument.checks[section.id] ?? [];
    return (
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <p className="font-medium">Self-check results</p>
          <Badge variant={checks.some((check) => check.state === "fail") ? "destructive" : "secondary"}>
            {checks.some((check) => check.state === "fail") ? "Blocked" : "Ready"}
          </Badge>
        </div>
        {checks.map((check) => (
          <div key={check.id} className="rounded-md border border-border bg-card p-2">
            <p className="font-medium">{check.label}</p>
            <p className="mt-1 capitalize text-muted-foreground">{check.state}</p>
            {check.citation && <p className="mt-1 font-mono text-[11px] text-muted-foreground">{check.citation}</p>}
          </div>
        ))}
        {exportBlockers > 0 && <p className="text-danger-soft-foreground">Export blocked until failures clear.</p>}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div>
          <h1 className="text-base font-semibold">{selectedDocument.name}</h1>
          <p className="text-xs text-muted-foreground">
            {selectedDocument.subtitle} | {stageLabel(selectedDocument.stage)} | v{selectedDocument.version}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {nextStage && nextAction && (
            <Button
              size="sm"
              onClick={() => moveDocument(selectedDocument.id, nextStage)}
              disabled={hasBlockingChecks(selectedDocument)}
            >
              {selectedDocument.signGateRequested
                ? "Sign-off gate pending"
                : hasBlockingChecks(selectedDocument)
                  ? "Resolve blockers first"
                  : nextAction}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
            Export
          </Button>
        </div>
      </div>

      <div role="status" className="border-b border-border bg-muted/20 px-5 py-2 text-xs text-muted-foreground">
        {notice}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="shrink-0 justify-start rounded-none border-b border-border bg-transparent px-4 pb-0">
          <TabsTrigger value="workspace" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Workspace
          </TabsTrigger>
          <TabsTrigger value="redline" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Redline
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
            Pipeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="mt-0 flex-1 overflow-hidden">
          <FactoryWorkspace
            sections={selectedDocument.sections}
            selectedSectionId={selectedSection?.id}
            onSectionSelect={setSelectedSectionId}
            onInputChipOpen={(chip) => setNotice(`Opened source chip ${chip.label}.`)}
            renderSectionCanvas={(section) => (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">source language</Badge>
                  <ArrowRight className="h-3.5 w-3.5" />
                  <Badge variant="outline">EN counterpart tracked</Badge>
                </div>
                <InlineDirectiveCanvas
                  sectionId={section.id}
                  content={section.content}
                  status={inlineStatusFor(section)}
                  conflictRef="/findings/fn1"
                  onInstruct={markDirectiveSelection}
                  onDirectiveSubmit={handleInlineInstruction}
                />
              </div>
            )}
            renderContextPanel={renderContextPanel}
            className="h-full"
          />
        </TabsContent>

        <TabsContent value="redline" className="mt-0 flex-1 overflow-auto px-8 py-6">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <FileCheck className="h-4 w-4" />
            Redline compares against the prior filed year. Per-change accept is unavailable because edits flow through directives.
          </div>
          <RedlineToggle sections={REDLINE_SECTIONS} />
        </TabsContent>

        <TabsContent value="pipeline" className="mt-0 flex-1 overflow-auto p-4">
          <div className="mb-3 grid gap-3 tablet:grid-cols-3">
            <div className="rounded-lg border border-border bg-card p-3 text-xs">
              <PackageCheck className="mb-2 h-4 w-4 text-primary" />
              <p className="font-medium">Stage moves only through actions</p>
              <p className="mt-1 text-muted-foreground">Drag remains refused so every transition has an audit path.</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-xs">
              <CheckCircle className="mb-2 h-4 w-4 text-success-soft-foreground" />
              <p className="font-medium">External review requires internal pass</p>
              <p className="mt-1 text-muted-foreground">Cards with blockers must clear checks before routing.</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-xs">
              <LockKeyhole className="mb-2 h-4 w-4 text-muted-foreground" />
              <p className="font-medium">Signed and filed stages are controlled</p>
              <p className="mt-1 text-muted-foreground">Sign-off produces a gate before final record export.</p>
            </div>
          </div>
          <PipelineKanban
            documents={documents}
            onMoveStage={moveDocument}
            onBatchMoveStage={batchMoveDocuments}
            onOpenWorkspace={selectDocument}
          />
        </TabsContent>
      </Tabs>

      <ExportDialog
        open={exportOpen}
        artifactClass="record"
        artifactName={selectedDocument.name}
        isSigned={selectedDocument.stage === "signed" || selectedDocument.stage === "filed"}
        uncitedClaimCount={exportBlockers}
        onClose={() => setExportOpen(false)}
        onExport={(payload) => {
          setExportOpen(false);
          setNotice(`${selectedDocument.name} exported to ${payload.destination}.`);
        }}
      />
    </div>
  );
}
