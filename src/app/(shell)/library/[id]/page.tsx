"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SensitivityNotice } from "@/components/patterns/pat-11-sensitivity";
import { useAnchorNavigation } from "@/components/library/anchor-navigation";
import { useViewerPageState } from "@/components/library/viewer-page-state";
import { ViewerHeader } from "@/components/library/viewer-header";
import { ViewerOutlineTab } from "@/components/library/viewer-outline-tab";
import { ViewerExtractionsTab } from "@/components/library/viewer-extractions-tab";
import { ViewerVersionsTab } from "@/components/library/viewer-versions-tab";
import { ViewerMentionsTab } from "@/components/library/viewer-mentions-tab";
import { ViewerCommentsTab } from "@/components/library/viewer-comments-tab";
import { mockDocuments, mockUsers } from "@/lib/mock";
import { cn } from "@/lib/utils";

const DEMO_SECTIONS = [
  { id: "s1", title: "1. Introduction", level: 1 },
  { id: "s2", title: "2. Transfer Pricing Overview", level: 1 },
  { id: "s3", title: "2.1 Royalty Analysis", level: 2 },
  { id: "s4", title: "2.2 Benchmarking", level: 2 },
  { id: "s5", title: "3. Conclusions", level: 1 },
];

const DEMO_EXTRACTIONS = [
  { id: "ex1", fieldName: "Royalty rate", value: "18%", confidence: 0.91, spanId: "span-1", sourceSection: "§4.2" },
  { id: "ex2", fieldName: "Policy rate", value: "12%", confidence: 0.95, spanId: "span-2", sourceSection: "§3.1" },
];

const DEMO_VERSIONS = [
  { id: "v2", number: 2, createdAt: "2025-11-20T14:00:00Z", author: "Ikaika Choi", isExecuted: false },
  { id: "v1", number: 1, createdAt: "2025-10-15T09:00:00Z", author: "Marcus Webb", isExecuted: true },
];

const SIDE_TABS = ["Outline", "Extractions", "Versions", "Mentions", "Comments"] as const;

const noop = () => {};

export default function DocumentViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const doc = mockDocuments.find((d) => d.id === id) ?? mockDocuments[0];

  const { page, totalPages, goNext, goPrev } = useViewerPageState(12);
  const { activeAnchorId, activeIndex, total: anchorTotal, goNext: anchorNext, goPrev: anchorPrev } =
    useAnchorNavigation(["span-1", "span-2"]);

  const [activeTab, setActiveTab] = useState<(typeof SIDE_TABS)[number]>("Outline");
  const [currentVersion, setCurrentVersion] = useState("v2");

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* Canvas (PDF placeholder) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Viewer header */}
        <ViewerHeader
          document={doc}
          onBack={() => router.push("/library")}
          originLabel="Library"
        />

        {doc.sensitivity !== "standard" && (
          <SensitivityNotice tier={doc.sensitivity as "sensitive" | "privileged"} className="rounded-none border-x-0 border-t-0" />
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-1.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>

          <Separator orientation="vertical" className="h-4 mx-1" />

          {anchorTotal > 0 && (
            <>
              <span className="text-xs text-muted-foreground">Anchor {activeIndex + 1}/{anchorTotal}</span>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={anchorPrev}>p</Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={anchorNext}>n</Button>
            </>
          )}
        </div>

        {/* PDF canvas placeholder */}
        <div className="flex-1 overflow-auto bg-muted/10 flex items-center justify-center">
          <div className="w-[595px] min-h-[842px] bg-white shadow-lg rounded-sm mx-auto my-6 p-12 text-sm">
            <h1 className="text-lg font-bold mb-4">{doc.name}</h1>
            <p className="text-muted-foreground text-xs mb-6">
              PDF content renders here. Page {page} of {totalPages}.
              {activeAnchorId && <span className="ml-2 text-amber-600">Active anchor: {activeAnchorId}</span>}
            </p>
            <p className="leading-relaxed text-gray-700">
              This is a placeholder for the paginated PDF / DOCX rendition. In production,
              react-pdf or a managed viewer renders here with anchored span highlights,
              reverse-citation overlays, and redline annotations.
            </p>
          </div>
        </div>
      </div>

      {/* Right side panel */}
      <div className="flex w-72 shrink-0 flex-col border-l border-border bg-background">
        {/* Tab bar */}
        <div className="flex overflow-x-auto border-b border-border">
          {SIDE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2 text-xs transition-colors",
                activeTab === tab
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-3">
          {activeTab === "Outline" && (
            <ViewerOutlineTab sections={DEMO_SECTIONS} onSectionClick={noop} />
          )}
          {activeTab === "Extractions" && (
            <ViewerExtractionsTab extractions={DEMO_EXTRACTIONS} onFieldClick={noop} onCorrect={noop} />
          )}
          {activeTab === "Versions" && (
            <ViewerVersionsTab
              versions={DEMO_VERSIONS}
              currentVersionId={currentVersion}
              onSelectVersion={setCurrentVersion}
            />
          )}
          {activeTab === "Mentions" && (
            <ViewerMentionsTab mentions={[]} />
          )}
          {activeTab === "Comments" && (
            <ViewerCommentsTab
              comments={[]}
              users={mockUsers}
              objectRef={`library/${doc.id}`}
              onAdd={noop}
              onResolve={noop}
              onUnresolve={noop}
            />
          )}
        </div>
      </div>
    </div>
  );
}
