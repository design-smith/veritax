"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { SensitivityNotice } from "@/components/patterns/pat-11-sensitivity";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Comment } from "@/components/patterns/pat-12-comments";
import type { Document, Finding, User } from "@/lib/mock/types";
import { useAnchorNavigation } from "./anchor-navigation";
import { SpanHighlight } from "./span-highlight";
import { useViewerPageState } from "./viewer-page-state";
import { ViewerCommentsTab } from "./viewer-comments-tab";
import { ViewerExtractionsTab, type Extraction } from "./viewer-extractions-tab";
import { ViewerHeader } from "./viewer-header";
import { ViewerMentionsTab, type DocumentMention } from "./viewer-mentions-tab";
import { ViewerOutlineTab, type OutlineSection } from "./viewer-outline-tab";
import { ViewerVersionsTab, type DocumentVersion } from "./viewer-versions-tab";

interface Notice {
  message: string;
  href?: string;
  hrefLabel?: string;
}

interface DocumentViewerPageContentProps {
  document: Document;
  users: User[];
  findings: Finding[];
  originLabel?: string;
  initialAnchorId?: string;
  onBack?: () => void;
}

const SECTIONS: OutlineSection[] = [
  { id: "intro", title: "1. Introduction", level: 1 },
  { id: "policy", title: "2. Policy position", level: 1 },
  { id: "royalty", title: "2.1 Royalty analysis", level: 2 },
  { id: "benchmark", title: "2.2 Benchmarking", level: 2 },
  { id: "conclusion", title: "3. Conclusions", level: 1 },
];

const EXTRACTIONS: Extraction[] = [
  {
    id: "ext-royalty",
    fieldName: "Royalty rate",
    value: "18%",
    confidence: 0.91,
    spanId: "royalty-rate",
    sourceSection: "Section 2.1",
  },
  {
    id: "ext-policy",
    fieldName: "Policy rate",
    value: "12%",
    confidence: 0.95,
    spanId: "policy-rate",
    sourceSection: "Section 2",
  },
  {
    id: "ext-benchmark",
    fieldName: "Benchmark range",
    value: "10%-14%",
    confidence: 0.88,
    spanId: "benchmark-range",
    sourceSection: "Section 2.2",
  },
];

const VERSIONS: DocumentVersion[] = [
  { id: "v3", number: 3, createdAt: "2025-11-20T14:00:00Z", author: "Ikaika Choi", isExecuted: false },
  { id: "v2", number: 2, createdAt: "2025-10-15T09:00:00Z", author: "Sarah Kimura", isExecuted: false },
  { id: "v1", number: 1, createdAt: "2025-09-01T10:00:00Z", author: "Marcus Webb", isExecuted: true },
];

const ANCHORS = ["royalty-rate", "policy-rate", "benchmark-range"];

function mentionsForDocument(document: Document, findings: Finding[]): DocumentMention[] {
  const relevant = findings.filter((finding) => {
    const haystack = `${finding.title} ${finding.summary}`.toLowerCase();
    if (document.type === "benchmark") return haystack.includes("benchmark") || haystack.includes("range");
    if (document.type === "ica") return haystack.includes("agreement") || haystack.includes("ica");
    if (document.type === "local-file") return haystack.includes(document.jurisdiction.toLowerCase()) || haystack.includes("local file");
    return haystack.includes("royalty") || haystack.includes("policy");
  });

  return relevant.slice(0, 4).map((finding) => ({
    id: `${document.id}-${finding.id}`,
    objectType: "finding",
    objectId: finding.id,
    objectTitle: finding.title,
    href: `/demo/findings/${finding.id}`,
  }));
}

function reverseCitationsFor(anchorId: string, findings: Finding[]) {
  if (anchorId === "benchmark-range") {
    return findings
      .filter((finding) => `${finding.title} ${finding.summary}`.toLowerCase().includes("benchmark"))
      .slice(0, 2)
      .map((finding) => ({ findingId: finding.id, findingTitle: finding.title }));
  }
  if (anchorId === "policy-rate") {
    return findings
      .filter((finding) => `${finding.title} ${finding.summary}`.toLowerCase().includes("policy"))
      .slice(0, 2)
      .map((finding) => ({ findingId: finding.id, findingTitle: finding.title }));
  }
  return findings
    .filter((finding) => `${finding.title} ${finding.summary}`.toLowerCase().includes("royalty"))
    .slice(0, 2)
    .map((finding) => ({ findingId: finding.id, findingTitle: finding.title }));
}

function selectedExtraction(extractionId: string | null) {
  if (!extractionId) return null;
  return EXTRACTIONS.find((extraction) => extraction.id === extractionId) ?? null;
}

export function DocumentViewerPageContent({
  document,
  users,
  findings,
  originLabel = "Library",
  initialAnchorId,
  onBack,
}: DocumentViewerPageContentProps) {
  const { page, totalPages, goNext, goPrev } = useViewerPageState(12);
  const { activeAnchorId, activeIndex, total, goNext: goNextAnchor, goPrev: goPrevAnchor, jumpTo } =
    useAnchorNavigation(ANCHORS, initialAnchorId);
  const [activeSectionId, setActiveSectionId] = useState(SECTIONS[0].id);
  const [currentVersionId, setCurrentVersionId] = useState(VERSIONS[0].id);
  const [comments, setComments] = useState<Comment[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const [verificationAnswer, setVerificationAnswer] = useState("");

  const mentions = useMemo(() => mentionsForDocument(document, findings), [document, findings]);
  const correction = selectedExtraction(correctionId);

  function handleSectionClick(sectionId: string) {
    setActiveSectionId(sectionId);
    if (sectionId === "policy") jumpTo("policy-rate");
    if (sectionId === "royalty") jumpTo("royalty-rate");
    if (sectionId === "benchmark") jumpTo("benchmark-range");
  }

  function handleCorrectionSubmit() {
    if (!correction || !verificationAnswer.trim()) return;
    setNotice({
      message: `Verification answer recorded for ${correction.fieldName}. Grants assigned reviewers read access to this document span.`,
    });
    setCorrectionId(null);
    setVerificationAnswer("");
  }

  function addComment(payload: { text: string; mentions: string[] }) {
    if (!payload.text.trim()) return;
    const actor = users[0] ?? { id: "system", name: "System" };
    setComments((current) => [
      ...current,
      {
        id: `${document.id}-comment-${current.length + 1}`,
        authorId: actor.id,
        authorName: actor.name,
        text: payload.text,
        timestamp: new Date().toISOString(),
        resolved: false,
      },
    ]);
  }

  function resolveComment(commentId: string, resolved: boolean) {
    setComments((current) =>
      current.map((comment) => (comment.id === commentId ? { ...comment, resolved } : comment)),
    );
  }

  function selectVersion(versionId: string) {
    setCurrentVersionId(versionId);
    setNotice({ message: `Version ${versionId} selected for comparison.` });
  }

  function refetchReference() {
    const runId = `refetch-${document.id}`;
    setNotice({
      message: `Refetch run created for ${document.name}.`,
      href: `/demo/gathering?run=${runId}`,
      hrefLabel: "Open refetch run",
    });
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ViewerHeader document={document} onBack={onBack ?? (() => undefined)} originLabel={originLabel} />

        {notice && (
          <Alert role="status" className="rounded-none border-x-0 border-t-0">
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

        {document.sensitivity !== "standard" && (
          <SensitivityNotice tier={document.sensitivity as "sensitive" | "privileged"} className="rounded-none border-x-0 border-t-0" />
        )}

        {document.custody === "reference" && (
          <Alert className="rounded-none border-x-0 border-t-0 border-warning/25 bg-warning-soft">
            <RefreshCw className="h-4 w-4 text-warning-soft-foreground" />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-warning-soft-foreground">
              <span>Reference-custody drift detected. The source hash changed since the last recorded check.</span>
              <Button size="sm" variant="outline" className="h-7" onClick={refetchReference}>
                Re-fetch and flag
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-1.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Previous page" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Next page" onClick={goNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="mx-1 h-4" />

          <span className="text-xs text-muted-foreground">
            Anchor {activeIndex + 1}/{total}
          </span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" aria-label="Previous anchor" onClick={goPrevAnchor}>
            p
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" aria-label="Next anchor" onClick={goNextAnchor}>
            n
          </Button>
        </div>

        <div className="flex-1 overflow-auto bg-muted/10 px-6 py-6">
          <article className="mx-auto min-h-[842px] w-[min(100%,760px)] space-y-5 rounded-sm bg-surface-elevated p-12 text-sm shadow-elevation-300">
            <h1 className="text-lg font-bold">{document.name}</h1>
            <p className="text-xs text-muted-foreground">
              As-ingested hash {document.hash}. Rendered from {document.sourcePath}.
            </p>
            <section className="space-y-2">
              <h2 className="font-semibold">Policy position</h2>
              <p className="leading-relaxed">
                The intercompany policy rate is{" "}
                <SpanHighlight
                  spanId="policy-rate"
                  text="12%"
                  isActive={activeAnchorId === "policy-rate"}
                  reverseCitations={reverseCitationsFor("policy-rate", findings)}
                />{" "}
                for the covered royalty flow. The observed record shows a charged royalty rate of{" "}
                <SpanHighlight
                  spanId="royalty-rate"
                  text="18%"
                  isActive={activeAnchorId === "royalty-rate"}
                  reverseCitations={reverseCitationsFor("royalty-rate", findings)}
                />
                .
              </p>
            </section>
            <section className="space-y-2">
              <h2 className="font-semibold">Benchmarking</h2>
              <p className="leading-relaxed">
                The cited support uses an interquartile range of{" "}
                <SpanHighlight
                  spanId="benchmark-range"
                  text="10%-14%"
                  isActive={activeAnchorId === "benchmark-range"}
                  reverseCitations={reverseCitationsFor("benchmark-range", findings)}
                />{" "}
                and keeps the source span available for review.
              </p>
            </section>
          </article>
        </div>
      </div>

      <div className="flex w-80 shrink-0 flex-col border-l border-border bg-background">
        <Tabs defaultValue="outline" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="h-auto justify-start rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="outline" className="rounded-none">Outline</TabsTrigger>
            <TabsTrigger value="extractions" className="rounded-none">Extractions</TabsTrigger>
            <TabsTrigger value="versions" className="rounded-none">Versions</TabsTrigger>
            <TabsTrigger value="mentions" className="rounded-none">Mentions</TabsTrigger>
            <TabsTrigger value="comments" className="rounded-none">Comments</TabsTrigger>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto px-3">
            <TabsContent value="outline" className="mt-0">
              <ViewerOutlineTab
                sections={SECTIONS}
                activeSectionId={activeSectionId}
                onSectionClick={handleSectionClick}
              />
            </TabsContent>
            <TabsContent value="extractions" className="mt-0 space-y-3">
              <ViewerExtractionsTab
                extractions={EXTRACTIONS}
                onFieldClick={jumpTo}
                onCorrect={(extractionId) => setCorrectionId(extractionId)}
              />
              {correction && (
                <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium">Correct {correction.fieldName}</p>
                  <Label htmlFor="verification-answer" className="text-xs">
                    Verification answer
                  </Label>
                  <Textarea
                    id="verification-answer"
                    value={verificationAnswer}
                    onChange={(event) => setVerificationAnswer(event.target.value)}
                    rows={3}
                    placeholder="Record the corrected value and basis."
                  />
                  <Button size="sm" onClick={handleCorrectionSubmit} disabled={!verificationAnswer.trim()}>
                    Submit correction
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="versions" className="mt-0">
              <ViewerVersionsTab
                versions={VERSIONS}
                currentVersionId={currentVersionId}
                onSelectVersion={selectVersion}
              />
            </TabsContent>
            <TabsContent value="mentions" className="mt-0">
              <ViewerMentionsTab mentions={mentions} />
            </TabsContent>
            <TabsContent value="comments" className="mt-0">
              <ViewerCommentsTab
                comments={comments}
                users={users}
                objectRef={`library/${document.id}`}
                onAdd={addComment}
                onResolve={(commentId) => resolveComment(commentId, true)}
                onUnresolve={(commentId) => resolveComment(commentId, false)}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
