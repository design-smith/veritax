"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Mail, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ClassificationChip = "ingested" | "commitments-only" | "excluded" | "privilege-gated";
type TranscriptCustody = "allowed" | "commitments-only" | "excluded";

const CLASSIFICATION_COLORS: Record<ClassificationChip, string> = {
  ingested:          "border-transparent bg-success-soft text-success-soft-foreground",
  "commitments-only":"border-transparent bg-info-soft text-info-soft-foreground",
  excluded:          "border-border text-muted-foreground",
  "privilege-gated": "border-transparent bg-danger-soft text-danger-soft-foreground",
};

interface ExtractedCommitment { id: string; text: string; ownerId: string; }
interface ExtractedAssertion  { id: string; text: string; confidenceLabel: string; }

export interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  classification: ClassificationChip;
  transcriptCustody: TranscriptCustody;
  extractedCommitments: ExtractedCommitment[];
  extractedAssertions: ExtractedAssertion[];
  recapDraft: string;
}

type TranscriptTab = "Summary" | "Transcript";

interface MeetingDetailProps {
  meeting: Meeting;
  onOpenEmailDraft: (meetingId: string) => void;
  defaultTab?: TranscriptTab;
  className?: string;
}

export function MeetingDetail({
  meeting,
  onOpenEmailDraft,
  defaultTab = "Summary",
  className,
}: MeetingDetailProps) {
  const [activeTab, setActiveTab] = useState<TranscriptTab>(defaultTab);

  return (
    <div className={cn("space-y-5", className)}>
      {/* Metadata */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold leading-snug">{meeting.title}</h1>
          <Badge variant="outline" className={cn("shrink-0 text-xs", CLASSIFICATION_COLORS[meeting.classification])}>
            {meeting.classification}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(parseISO(meeting.date), "d MMM yyyy, HH:mm")}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{meeting.participants.join(", ")}</span>
        </div>
      </div>

      {/* Tabs: Summary | Transcript */}
      <div role="tablist" className="flex gap-0 border-b border-border">
        {(["Summary", "Transcript"] as TranscriptTab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm transition-colors",
              activeTab === tab
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Summary tab — always-visible main content */}
      {activeTab === "Summary" && (
        <div className="space-y-6">
          {/* Extracted commitments */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Extracted commitments ({meeting.extractedCommitments.length})
            </p>
            <div className="space-y-2">
              {meeting.extractedCommitments.map((cm) => (
                <div key={cm.id} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-sm">{cm.text}</p>
                </div>
              ))}
              {meeting.extractedCommitments.length === 0 && (
                <p className="text-sm text-muted-foreground">No commitments extracted.</p>
              )}
            </div>
          </section>

          <Separator />

          {/* Extracted assertions */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Extracted assertions ({meeting.extractedAssertions.length})
            </p>
            <div className="space-y-2">
              {meeting.extractedAssertions.map((assertion) => (
                <article
                  key={assertion.id}
                  aria-label={assertion.text}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm">{assertion.text}</p>
                    <a
                      href={`/verification-queue?assertion=${assertion.id}`}
                      className="mt-2 inline-flex text-xs text-primary hover:underline"
                    >
                      Open in verification queue
                    </a>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{assertion.confidenceLabel}</Badge>
                </article>
              ))}
            </div>
          </section>

          <Separator />

          {/* Recap draft */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Recap draft
            </p>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm leading-relaxed">{meeting.recapDraft}</p>
            </div>
            <Button
              variant="outline"
              className="mt-3 gap-2"
              onClick={() => onOpenEmailDraft(meeting.id)}
            >
              <Mail className="h-4 w-4" />
              Open in email draft
            </Button>
          </section>
        </div>
      )}

      {/* Transcript tab — custody gated */}
      {activeTab === "Transcript" && (
        meeting.transcriptCustody === "allowed" ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">Full transcript renders here when custody permits.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-warning/25 bg-warning-soft p-4 dark:border-warning/30 dark:bg-warning-soft">
            <p className="text-sm text-warning-soft-foreground dark:text-warning-soft-foreground">
              Transcript not available — custody is{" "}
              <span className="font-medium">{meeting.transcriptCustody}</span>.
              Only commitment extractions are accessible for this meeting.
            </p>
          </div>
        )
      )}
    </div>
  );
}
