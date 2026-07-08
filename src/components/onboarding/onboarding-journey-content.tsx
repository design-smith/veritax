"use client";

import { useMemo, useState } from "react";

import { ConnectStage } from "@/components/onboarding/connect-stage";
import { IngestConsole } from "@/components/onboarding/ingest-console";
import { OnboardingRail, type OnboardingStage } from "@/components/onboarding/onboarding-rail";
import { RevealMoment } from "@/components/onboarding/reveal-moment";
import { TeachStage, type VerificationQuestion } from "@/components/onboarding/teach-stage";
import { Separator } from "@/components/ui/separator";
import {
  createFirstUploadReceivedEvent,
  createOnboardingRevealReachedEvent,
  DEMO_FRONTEND_TELEMETRY_CONTEXT,
  recordFrontendTelemetryEvent,
} from "@/lib/telemetry/product-telemetry";

type DocType = "local-file" | "master-file" | "ica" | "benchmark" | "memo" | "other";
type FixAction = "retry" | "skip" | "mark-duplicate";

interface StreamItem {
  id: string;
  name: string;
  type: DocType;
}

interface ProblemItem {
  id: string;
  name: string;
  issue: "unreadable" | "duplicate" | "unsupported";
}

interface AnswerRecord {
  questionId: string;
  option: string;
}

interface OnboardingJourneyContentProps {
  adminDemoMode?: boolean;
  onOpenFindings?: () => void;
}

const FORWARD_ADDRESS = "ingest-abc123@veritax.io";
const STAGE_ORDER: OnboardingStage[] = ["Connect", "Ingest", "Teach", "Reveal"];

const BASE_COUNTERS = {
  docsTotal: 24,
  docsByType: { "local-file": 8, "master-file": 2, ica: 6, other: 8 } as Record<string, number>,
  entitiesDiscovered: 6,
  agreementsFound: 8,
};

const BASE_STREAM: StreamItem[] = [
  { id: "s1", name: "Veritax UK Local File FY2024.pdf", type: "local-file" },
  { id: "s2", name: "IC Royalty Agreement US-UK 2021.pdf", type: "ica" },
  { id: "s3", name: "Group Master File FY2024.docx", type: "master-file" },
  { id: "s4", name: "Singapore Local File FY2024.pdf", type: "local-file" },
];

const BASE_PROBLEMS: ProblemItem[] = [
  { id: "p1", name: "corrupt-scan.pdf", issue: "unreadable" },
  { id: "p2", name: "duplicate-policy.pdf", issue: "duplicate" },
];

const QUESTIONS: VerificationQuestion[] = [
  {
    id: "q1",
    question: "Is GL account 47200 an intercompany royalty account?",
    options: ["Yes", "No", "Partially", "Unsure - escalate"],
    evidenceText: "Transactions from GL 47200 show regular payments labeled 'royalty fee' to foreign subsidiaries.",
    consequenceLine: "Confirming maps GL 47200 to IC royalties for all periods.",
  },
  {
    id: "q2",
    question: "Are Veritax Corp (US) and Veritax Holdings the same entity?",
    options: ["Same entity", "Different entities", "Partially same", "Unsure - escalate"],
    evidenceText: "Both names appear in the same group tax filings with the same EIN.",
    consequenceLine: "Confirming will merge these two entity profiles.",
  },
  {
    id: "q3",
    question: "Is the UK subsidiary a limited-risk distributor?",
    options: ["Yes", "No", "Partially", "Unsure - escalate"],
    evidenceText: "Local file describes UK sub as taking no inventory risk and bearing limited market risk.",
    consequenceLine: "Confirming sets the functional profile for UK entity.",
  },
];

function inferDocType(fileName: string): DocType {
  const normalized = fileName.toLowerCase();
  if (normalized.includes("local")) return "local-file";
  if (normalized.includes("master")) return "master-file";
  if (normalized.includes("agreement") || normalized.includes("ica")) return "ica";
  if (normalized.includes("benchmark")) return "benchmark";
  if (normalized.includes("memo") || normalized.includes("policy")) return "memo";
  return "other";
}

export function OnboardingJourneyContent({
  adminDemoMode = true,
  onOpenFindings,
}: OnboardingJourneyContentProps) {
  const [currentStage, setCurrentStage] = useState<OnboardingStage>("Connect");
  const [completedStages, setCompletedStages] = useState<OnboardingStage[]>([]);
  const [uploadedStreamItems, setUploadedStreamItems] = useState<StreamItem[]>([]);
  const [problemItems, setProblemItems] = useState<ProblemItem[]>(BASE_PROBLEMS);
  const [fixLog, setFixLog] = useState<string[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [recordUnlocked, setRecordUnlocked] = useState(false);
  const [firstUploadAt, setFirstUploadAt] = useState<string | null>(null);

  const counters = useMemo(() => {
    const docsByType = { ...BASE_COUNTERS.docsByType };
    uploadedStreamItems.forEach((item) => {
      docsByType[item.type] = (docsByType[item.type] ?? 0) + 1;
    });

    return {
      docsTotal: BASE_COUNTERS.docsTotal + uploadedStreamItems.length,
      docsByType,
      entitiesDiscovered: BASE_COUNTERS.entitiesDiscovered,
      agreementsFound: BASE_COUNTERS.agreementsFound,
    };
  }, [uploadedStreamItems]);

  const activeQuestions = QUESTIONS.slice(Math.min(answers.length, QUESTIONS.length));

  function advance() {
    const index = STAGE_ORDER.indexOf(currentStage);
    if (index >= STAGE_ORDER.length - 1) return;
    setCompletedStages((current) =>
      current.includes(currentStage) ? current : [...current, currentStage]
    );
    setCurrentStage(STAGE_ORDER[index + 1]);
  }

  function replay() {
    setCurrentStage("Connect");
    setCompletedStages([]);
    setUploadedStreamItems([]);
    setProblemItems(BASE_PROBLEMS);
    setFixLog([]);
    setAnswers([]);
    setRecordUnlocked(false);
    setFirstUploadAt(null);
  }

  function handleFilesDrop(files: File[]) {
    if (files.length > 0) {
      const uploadedAt = new Date().toISOString();
      setFirstUploadAt((current) => current ?? uploadedAt);
      recordFrontendTelemetryEvent(
        createFirstUploadReceivedEvent({
          ...DEMO_FRONTEND_TELEMETRY_CONTEXT,
          fileCount: files.length,
          sourceType: "drag-drop",
          uploadBatchId: `upload-${uploadedAt}`,
        }),
      );
    }

    setUploadedStreamItems((current) => [
      ...files.map((file, index) => ({
        id: `upload-${current.length + index + 1}`,
        name: file.name,
        type: inferDocType(file.name),
      })),
      ...current,
    ]);
  }

  function handleFixProblem(itemId: string, action: FixAction) {
    setProblemItems((current) => current.filter((item) => item.id !== itemId));
    setFixLog((current) => [`${itemId}:${action}`, ...current]);
  }

  function handleAnswer(questionId: string, option: string) {
    setAnswers((current) => {
      if (current.some((answer) => answer.questionId === questionId)) return current;
      return [...current, { questionId, option }];
    });
  }

  function handleSkip() {
    const currentQuestion = activeQuestions[0];
    if (!currentQuestion) return;
    handleAnswer(currentQuestion.id, "Skipped");
  }

  function handleUndo() {
    setAnswers((current) => current.slice(0, -1));
  }

  function handleUnlock() {
    recordFrontendTelemetryEvent(
      createOnboardingRevealReachedEvent({
        ...DEMO_FRONTEND_TELEMETRY_CONTEXT,
        firstUploadAt: firstUploadAt ?? undefined,
        findingCount: 15,
      }),
    );
    setRecordUnlocked(true);
    onOpenFindings?.();
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
        <header className="space-y-2 text-center">
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">Mirror diagnostic</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">Record gathering</h1>
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            Watch the record assemble itself from messy source material, teach the cross-references, then unlock the first findings.
          </p>
        </header>

        <OnboardingRail
          currentStage={currentStage}
          completedStages={completedStages}
          onReplay={adminDemoMode ? replay : undefined}
        />

        <Separator />

        {currentStage === "Connect" ? (
          <ConnectStage
            forwardAddress={FORWARD_ADDRESS}
            onFilesDrop={handleFilesDrop}
            onContinue={advance}
            sharepointEnabled
          />
        ) : null}

        {currentStage === "Ingest" ? (
          <div className="space-y-4">
            <IngestConsole
              counters={counters}
              streamItems={[...uploadedStreamItems, ...BASE_STREAM]}
              problemItems={problemItems}
              onContinue={advance}
              onFixProblem={handleFixProblem}
            />
            {fixLog.length > 0 ? (
              <div className="mx-auto max-w-3xl rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
                Latest fix: {fixLog[0]}
              </div>
            ) : null}
          </div>
        ) : null}

        {currentStage === "Teach" ? (
          <div className="space-y-4">
            <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
              Verification Queue target: answer ~40 questions to unlock cross-referencing.
            </div>
            <TeachStage
              questions={activeQuestions}
              answeredCount={answers.length}
              targetCount={QUESTIONS.length}
              onAnswer={handleAnswer}
              onSkip={handleSkip}
              onUndo={handleUndo}
              onContinue={advance}
            />
          </div>
        ) : null}

        {currentStage === "Reveal" ? (
          <div className="space-y-4">
            <RevealMoment
              findingCount={15}
              exposureRollup="$4.2M"
              onUnlock={handleUnlock}
              onReplay={adminDemoMode ? replay : undefined}
              isAdmin={adminDemoMode}
            />
            {recordUnlocked ? (
              <div className="mx-auto max-w-md rounded-lg border border-border bg-card px-4 py-3 text-center text-sm text-foreground">
                Findings seeded and Briefing fired into life.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
