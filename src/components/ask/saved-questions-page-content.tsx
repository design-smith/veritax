"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface SavedQuestionRecord {
  id: string;
  question: string;
  lastAnswer: string;
  lastRunAt: string;
  hasChanged: boolean;
  isMonitored: boolean;
  scope: string;
  lastBrief: string;
  digestRoute: string;
}

type ActivePanel =
  | { type: "none" }
  | { type: "brief"; questionId: string }
  | { type: "scope"; questionId: string }
  | { type: "share"; questionId: string }
  | { type: "new" };

const INITIAL_QUESTIONS: SavedQuestionRecord[] = [
  {
    id: "q1",
    question: "What is the royalty rate for Veritax UK Ltd?",
    lastAnswer: "The rate is 18.0%, which exceeds the arm's length range of 10-14%.",
    lastRunAt: "2025-11-22T09:00:00Z",
    hasChanged: true,
    isMonitored: true,
    scope: "UK royalty flows and CUT benchmark set",
    lastBrief: "The UK royalty rate remains above the range. Monitor route: findings digest.",
    digestRoute: "Findings digest",
  },
  {
    id: "q2",
    question: "Is the France commissionnaire agreement still valid?",
    lastAnswer: "No. The agreement expired on 31 Dec 2023 and renewal evidence is still missing.",
    lastRunAt: "2025-11-20T14:00:00Z",
    hasChanged: false,
    isMonitored: false,
    scope: "France agreements",
    lastBrief: "France commissionnaire agreement expired and needs renewal evidence from Legal.",
    digestRoute: "Commitments digest",
  },
  {
    id: "q3",
    question: "Which jurisdictions are missing local files for FY2024?",
    lastAnswer: "Japan and Singapore still need filed local files for FY2024.",
    lastRunAt: "2025-11-18T11:00:00Z",
    hasChanged: false,
    isMonitored: true,
    scope: "FY2024 local files",
    lastBrief: "Japan and Singapore are missing filed local files. Japan also has a substance gap.",
    digestRoute: "Obligations digest",
  },
];

function formatLastRun(value: string) {
  if (value === "just-now") return "just now";
  return format(parseISO(value), "MMM d, yyyy");
}

export function SavedQuestionsPageContent() {
  const [questions, setQuestions] = useState<SavedQuestionRecord[]>(INITIAL_QUESTIONS);
  const [activePanel, setActivePanel] = useState<ActivePanel>({ type: "none" });
  const [scopeDraft, setScopeDraft] = useState("");
  const [newQuestion, setNewQuestion] = useState("");
  const [newScope, setNewScope] = useState("");
  const [notice, setNotice] = useState("Saved questions ready.");

  const selectedQuestion =
    activePanel.type !== "none" && activePanel.type !== "new"
      ? questions.find((question) => question.id === activePanel.questionId)
      : null;

  function toggleMonitor(questionId: string) {
    const question = questions.find((item) => item.id === questionId);
    setQuestions((current) =>
      current.map((item) =>
        item.id === questionId ? { ...item, isMonitored: !item.isMonitored } : item,
      ),
    );
    setNotice(question?.isMonitored ? "Monitoring turned off." : "Monitoring turned on.");
  }

  function reask(questionId: string) {
    setQuestions((current) =>
      current.map((item) =>
        item.id === questionId
          ? {
              ...item,
              lastRunAt: "just-now",
              hasChanged: false,
              lastAnswer: `${item.lastAnswer} Re-asked against the current record.`,
            }
          : item,
      ),
    );
    setNotice("Question re-asked against the current record.");
  }

  function beginScopeEdit(questionId: string) {
    const question = questions.find((item) => item.id === questionId);
    setScopeDraft(question?.scope ?? "");
    setActivePanel({ type: "scope", questionId });
  }

  function saveScope() {
    if (activePanel.type !== "scope") return;
    setQuestions((current) =>
      current.map((item) =>
        item.id === activePanel.questionId ? { ...item, scope: scopeDraft.trim() || item.scope } : item,
      ),
    );
    setNotice("Saved question scope updated.");
    setActivePanel({ type: "none" });
  }

  function saveQuestion() {
    const nextQuestion: SavedQuestionRecord = {
      id: `q${questions.length + 1}`,
      question: newQuestion.trim(),
      lastAnswer: "New saved question. Run it to produce the first brief.",
      lastRunAt: "just-now",
      hasChanged: false,
      isMonitored: false,
      scope: newScope.trim(),
      lastBrief: "No prior brief. Re-ask this saved question to generate one.",
      digestRoute: "Digest center",
    };

    setQuestions((current) => [nextQuestion, ...current]);
    setNewQuestion("");
    setNewScope("");
    setNotice("Saved question created.");
    setActivePanel({ type: "none" });
  }

  function shareQuestion(questionId: string) {
    setActivePanel({ type: "share", questionId });
    setNotice("Share link copied for saved question.");
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Saved Questions</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Persistent Ask intelligence with monitor routing and answer-change state.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
            {notice}
          </div>
          <Button className="gap-1.5" onClick={() => setActivePanel({ type: "new" })}>
            <Plus className="h-4 w-4" />
            New question
          </Button>
        </div>
      </div>

      <section aria-label="Saved questions table" className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1050px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Monitor", "Question", "Last answer", "Last-run", "Change-state", "Scope", "Actions"].map((heading) => (
                <th key={heading} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {questions.map((question) => (
              <tr
                key={question.id}
                className={cn("bg-card transition-colors hover:bg-muted/20", question.hasChanged && "bg-warning-soft/70")}
              >
                <td className="px-4 py-3">
                  <Switch
                    checked={question.isMonitored}
                    onCheckedChange={() => toggleMonitor(question.id)}
                    aria-label="Monitor saved question"
                  />
                </td>
                <td className="px-4 py-3 font-medium">{question.question}</td>
                <td className="px-4 py-3 text-muted-foreground">{question.lastAnswer}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatLastRun(question.lastRunAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {question.hasChanged ? (
                      <Badge variant="warning" className="border-transparent bg-warning-soft text-warning-soft-foreground">
                        answer changed
                      </Badge>
                    ) : (
                      <Badge variant="outline">no change</Badge>
                    )}
                    {question.isMonitored ? <Badge variant="secondary">monitored</Badge> : <Badge variant="outline">not monitored</Badge>}
                    <Badge variant="outline">{question.digestRoute}</Badge>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{question.scope}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => reask(question.id)}>
                      Re-ask
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setActivePanel({ type: "brief", questionId: question.id })}>
                      Open last brief
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => beginScopeEdit(question.id)}>
                      Edit scope
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => shareQuestion(question.id)}>
                      Share
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {activePanel.type === "brief" && selectedQuestion ? (
        <section aria-label="Last answer brief" className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Last answer brief</h2>
          <p className="mt-2 text-sm">{selectedQuestion.lastBrief}</p>
        </section>
      ) : null}

      {activePanel.type === "scope" && selectedQuestion ? (
        <section aria-label="Edit question scope" className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Edit scope</h2>
          <label className="mt-3 block space-y-1 text-xs font-medium text-muted-foreground">
            <span>Question scope</span>
            <Textarea value={scopeDraft} onChange={(event) => setScopeDraft(event.target.value)} />
          </label>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={saveScope}>
              Save scope
            </Button>
          </div>
        </section>
      ) : null}

      {activePanel.type === "share" && selectedQuestion ? (
        <section aria-label="Share link" className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Share link</h2>
          <p className="mt-2 font-mono text-sm text-muted-foreground">/ask/saved?question={selectedQuestion.id}</p>
        </section>
      ) : null}

      {activePanel.type === "new" ? (
        <section aria-label="New saved question" className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">New question</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              <span>Saved question</span>
              <Input value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              <span>Saved question scope</span>
              <Input value={newScope} onChange={(event) => setNewScope(event.target.value)} />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={saveQuestion}>
              Save question
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
