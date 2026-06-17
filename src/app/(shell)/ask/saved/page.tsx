"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SavedQuestionsTable, type SavedQuestion } from "@/components/ask/saved-questions-table";

const DEMO_QUESTIONS: SavedQuestion[] = [
  {
    id: "q1",
    question: "What is the royalty rate for Veritax UK Ltd?",
    lastAnswer: "The rate is 18.0%, which exceeds the arm's length range of 10–14%.",
    lastRunAt: "2025-11-22T09:00:00Z",
    hasChanged: true,
    isMonitored: true,
  },
  {
    id: "q2",
    question: "Is the France commissionnaire agreement still valid?",
    lastAnswer: "No — the agreement expired on 31 Dec 2023 and has not been renewed.",
    lastRunAt: "2025-11-20T14:00:00Z",
    hasChanged: false,
    isMonitored: false,
  },
  {
    id: "q3",
    question: "Which jurisdictions are missing local files for FY2024?",
    lastAnswer: "Japan (Veritax KK) and Singapore (Veritax APAC) are missing filed local files.",
    lastRunAt: "2025-11-18T11:00:00Z",
    hasChanged: false,
    isMonitored: true,
  },
];

const noop = () => {};

export default function SavedQuestionsPage() {
  const [questions, setQuestions] = useState(DEMO_QUESTIONS);

  function toggleMonitor(id: string) {
    setQuestions((qs) =>
      qs.map((q) => (q.id === id ? { ...q, isMonitored: !q.isMonitored } : q))
    );
  }

  function deleteQuestion(id: string) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Saved Questions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Questions run against the Record. Monitored questions alert on answer changes.
          </p>
        </div>
        <Button className="gap-1.5">
          <Plus className="h-4 w-4" />
          New question
        </Button>
      </div>

      <SavedQuestionsTable
        questions={questions}
        onReask={noop}
        onDelete={deleteQuestion}
        onToggleMonitor={toggleMonitor}
      />
    </div>
  );
}
