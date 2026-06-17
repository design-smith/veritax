"use client";

import { useState } from "react";
import { VerificationQueue, type VerificationQuestion } from "@/components/verification-queue/verification-queue";
import { Button } from "@/components/ui/button";

const DEMO_QUESTIONS: VerificationQuestion[] = [
  { id: "q1", category: "entity-merge", question: "Are Veritax Corp (US) and Veritax Holdings Inc the same legal entity?", options: ["Same entity", "Different entities", "Partially same", "Unsure — escalate"], evidenceText: "Both appear in the same consolidated group tax return with EIN 12-3456789.", consequenceLine: "Confirming will merge these two entity profiles across all periods." },
  { id: "q2", category: "account-mapping", question: "Is GL account 47200 an intercompany royalty payable account?", options: ["Yes", "No", "Partially", "Unsure — escalate"], evidenceText: "GL 47200 shows regular credits labeled 'royalty fee IC' to foreign subs.", consequenceLine: "Confirming maps GL 47200 → IC royalties for all periods." },
  { id: "q3", category: "extraction-correction", question: "Is the extracted royalty rate of 12% correct for §3.1 of the TP Policy?", options: ["Correct", "Incorrect — it is different", "Not applicable", "Cannot determine"], evidenceText: "§3.1 states: 'The applicable royalty rate shall be 12% of net revenue.'", consequenceLine: "Confirming validates this extraction for the Benchmark Study FY2024." },
  { id: "q4", category: "extraction-correction", question: "Does GL 48100 represent management fees charged by the parent?", options: ["Yes", "No", "Partially", "Unsure — escalate"], evidenceText: "GL 48100 entries are labeled 'mgmt svc fee' with counterparty US parent.", consequenceLine: "Confirming maps GL 48100 → IC management services." },
];

const TARGET = 40;

export default function VerificationQueuePage() {
  const [answered, setAnswered] = useState(0);
  const [remaining, setRemaining] = useState(DEMO_QUESTIONS);

  function handleAnswer(qId: string, option: string) {
    setAnswered((n) => n + 1);
    setRemaining((qs) => qs.filter((q) => q.id !== qId));
  }

  function handleSkip() {
    if (remaining.length > 1) {
      setRemaining((qs) => [...qs.slice(1), qs[0]]);
    }
  }

  function handleUndo() {
    setAnswered((n) => Math.max(0, n - 1));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Verification Queue</h1>
        <Button variant="outline" size="sm" onClick={() => { setAnswered(0); setRemaining(DEMO_QUESTIONS); }}>
          Reset (demo)
        </Button>
      </div>
      <VerificationQueue
        questions={remaining}
        answeredCount={answered}
        targetCount={TARGET}
        onAnswer={handleAnswer}
        onSkip={handleSkip}
        onUndo={handleUndo}
      />
    </div>
  );
}
