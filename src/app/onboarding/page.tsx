"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingRail, type OnboardingStage } from "@/components/onboarding/onboarding-rail";
import { ConnectStage } from "@/components/onboarding/connect-stage";
import { IngestConsole } from "@/components/onboarding/ingest-console";
import { TeachStage, type VerificationQuestion } from "@/components/onboarding/teach-stage";
import { RevealMoment } from "@/components/onboarding/reveal-moment";
import { Separator } from "@/components/ui/separator";

// Demo data
const DEMO_FORWARD_ADDRESS = "ingest-abc123@veritax.io";

const DEMO_COUNTERS = {
  docsTotal: 24,
  docsByType: { "local-file": 8, "master-file": 2, ica: 6, other: 8 } as Record<string, number>,
  entitiesDiscovered: 6,
  agreementsFound: 8,
};

const DEMO_STREAM = [
  { id: "s1", name: "Veritax UK Local File FY2024.pdf", type: "local-file" as const },
  { id: "s2", name: "IC Royalty Agreement US-UK 2021.pdf", type: "ica" as const },
  { id: "s3", name: "Group Master File FY2024.docx", type: "master-file" as const },
  { id: "s4", name: "Singapore Local File FY2024.pdf", type: "local-file" as const },
];

const DEMO_PROBLEMS = [
  { id: "p1", name: "corrupt-scan.pdf", issue: "unreadable" as const },
];

const DEMO_QUESTIONS: VerificationQuestion[] = [
  { id: "q1", question: "Is GL account 47200 an intercompany royalty account?", options: ["Yes", "No", "Partially", "Unsure — escalate"], evidenceText: "Transactions from GL 47200 show regular payments labeled 'royalty fee' to foreign subsidiaries.", consequenceLine: "Confirming maps GL 47200 → IC royalties for all periods." },
  { id: "q2", question: "Are Veritax Corp (US) and Veritax Holdings the same entity?", options: ["Same entity", "Different entities", "Partially same", "Unsure — escalate"], evidenceText: "Both names appear in the same group tax filings with the same EIN.", consequenceLine: "Confirming will merge these two entity profiles." },
  { id: "q3", question: "Is the UK subsidiary a limited-risk distributor?", options: ["Yes", "No", "Partially", "Unsure — escalate"], evidenceText: "Local file describes UK sub as taking no inventory risk and bearing limited market risk.", consequenceLine: "Confirming sets the functional profile for UK entity." },
];

const STAGE_ORDER: OnboardingStage[] = ["Connect", "Ingest", "Teach", "Reveal"];

// Set to true to show the Replay button (admin demo mode)
const IS_ADMIN = true;

const noop = () => {};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStage, setCurrentStage] = useState<OnboardingStage>("Connect");
  const [completedStages, setCompletedStages] = useState<OnboardingStage[]>([]);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);

  function advance() {
    const idx = STAGE_ORDER.indexOf(currentStage);
    if (idx < STAGE_ORDER.length - 1) {
      setCompletedStages((prev) => [...prev, currentStage]);
      setCurrentStage(STAGE_ORDER[idx + 1]);
    }
  }

  function replay() {
    setCurrentStage("Connect");
    setCompletedStages([]);
    setDroppedFiles([]);
    setAnsweredCount(0);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        {/* Rail */}
        <OnboardingRail
          currentStage={currentStage}
          completedStages={completedStages}
          onReplay={IS_ADMIN ? replay : undefined}
        />

        <Separator />

        {/* Stage content */}
        {currentStage === "Connect" && (
          <ConnectStage
            forwardAddress={DEMO_FORWARD_ADDRESS}
            onFilesDrop={(files) => setDroppedFiles(files)}
            onContinue={advance}
            sharepointEnabled
          />
        )}

        {currentStage === "Ingest" && (
          <IngestConsole
            counters={DEMO_COUNTERS}
            streamItems={DEMO_STREAM}
            problemItems={DEMO_PROBLEMS}
            onContinue={advance}
            onFixProblem={noop}
          />
        )}

        {currentStage === "Teach" && (
          <TeachStage
            questions={DEMO_QUESTIONS}
            answeredCount={answeredCount}
            targetCount={3}
            onAnswer={(qId, option) => {
              setAnsweredCount((n) => n + 1);
            }}
            onSkip={noop}
            onUndo={() => setAnsweredCount((n) => Math.max(0, n - 1))}
            onContinue={advance}
          />
        )}

        {currentStage === "Reveal" && (
          <RevealMoment
            findingCount={15}
            exposureRollup="$4.2M"
            onUnlock={() => router.push("/findings")}
            onReplay={IS_ADMIN ? replay : undefined}
            isAdmin={IS_ADMIN}
          />
        )}
      </div>
    </div>
  );
}
