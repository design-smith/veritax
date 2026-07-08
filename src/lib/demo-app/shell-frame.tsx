"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, Command, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { demoRecord, type DemoFiscalYear, type DemoRole } from "@/lib/demo-app/record";
import { useDemoApp } from "@/lib/demo-app/state";

function formatPayloadSummary(payload: Record<string, unknown>) {
  return Object.entries(payload)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" - ");
}

function detectAskMode(prompt: string) {
  const value = prompt.toLowerCase();

  if (value.includes("run")) return "run";
  if (value.includes("create") || value.includes("assign")) return "create";
  if (value.includes("open") || value.includes("go to")) return "go-to";
  return "answer";
}

export function DemoShellFrame({ children }: { children: ReactNode }) {
  const { commands, emitCommand, fiscalYear, role, setFiscalYear, setRole } = useDemoApp();
  const [askOpen, setAskOpen] = useState(false);
  const [askPrompt, setAskPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const askMode = useMemo(() => detectAskMode(askPrompt), [askPrompt]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAskOpen(true);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function answerQuestion() {
    setAnswer(
      "Germany services margin is below the accepted range because GmbH actuals are at 2.1% against the 3.0-5.5% services range.",
    );
    emitCommand({
      type: "ask",
      sourceSurface: "ask-overlay",
      payload: { prompt: askPrompt, mode: "answer" },
    });
  }

  function startRun() {
    emitCommand({
      type: "run_stage",
      sourceSurface: "ask-overlay",
      payload: { stage: "services_appendix_refresh", prompt: askPrompt },
    });
  }

  function createAssignment() {
    emitCommand({
      type: "assign",
      sourceSurface: "ask-overlay",
      payload: { assignee: "Ilya Novak", target: "Germany margin drift", prompt: askPrompt },
    });
  }

  return (
    <div className="grid min-h-[100dvh] bg-background text-foreground lg:grid-cols-[17rem_1fr]">
      <aside className="border-r border-border bg-surface-secondary px-4 py-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-5">{demoRecord.name}</p>
            <p className="text-xs text-muted-foreground">Demo operating record</p>
          </div>
        </div>

        <nav aria-label="Record surfaces" className="mt-7 flex flex-col gap-1">
          {demoRecord.navigation.map((item) => (
            <Button
              asChild
              key={item.href}
              variant={item.label === "Briefing" ? "secondary" : "ghost"}
              className="justify-between"
            >
              <Link href={item.href}>
                <span>{item.label}</span>
                {item.badge ? <Badge variant="outline">{item.badge}</Badge> : null}
              </Link>
            </Button>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Frontend demo spine
            </p>
            <h1 className="text-lg font-semibold tracking-normal">Intercompany Record</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>Fiscal year lens</span>
              <select
                aria-label="Fiscal year lens"
                className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                value={fiscalYear}
                onChange={(event) => setFiscalYear(event.target.value as DemoFiscalYear)}
              >
                {demoRecord.fiscalYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>Demo role</span>
              <select
                aria-label="Demo role"
                className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                value={role}
                onChange={(event) => setRole(event.target.value as DemoRole)}
              >
                {demoRecord.roles.map((recordRole) => (
                  <option key={recordRole} value={recordRole}>
                    {recordRole}
                  </option>
                ))}
              </select>
            </label>

            <Button variant="outline" type="button">
              <Bell className="size-4" aria-hidden="true" />
              Digest
            </Button>
            <Button variant="default" type="button" onClick={() => setAskOpen(true)}>
              <Search className="size-4" aria-hidden="true" />
              Ask
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <main className="min-w-0 overflow-auto">{children}</main>

          <aside
            aria-label="Command log"
            className="border-t border-border bg-surface px-4 py-4 xl:border-l xl:border-t-0"
          >
            <div className="flex items-center gap-2">
              <Command className="size-4 text-muted-foreground" aria-hidden="true" />
              <h2 className="text-sm font-semibold">Command envelope</h2>
            </div>
            <Separator className="my-3" />
            {commands.length === 0 ? (
              <p className="text-sm text-muted-foreground">No commands emitted yet</p>
            ) : (
              <ol className="space-y-3">
                {commands.slice(0, 5).map((command) => (
                  <li
                    className="rounded-lg border border-border bg-background p-3 text-sm"
                    key={command.id}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{command.type}</span>
                      <Badge variant="warning">{command.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {command.actor} - {command.fiscalYear} - {command.sourceSurface}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatPayloadSummary(command.payload)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      </div>

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ask the Record</DialogTitle>
            <DialogDescription>
              Ask, jump to work, queue a run, or create a lightweight action.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              aria-label="Ask prompt"
              placeholder="Ask about Germany margin drift, open a finding, run a refresh..."
              value={askPrompt}
              onChange={(event) => setAskPrompt(event.target.value)}
            />

            <div
              role="status"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground"
            >
              Detected mode: {askMode}
            </div>

            {askMode === "answer" ? (
              <div className="space-y-3">
                <Button type="button" onClick={answerQuestion}>
                  Ask question
                </Button>
                {answer ? (
                  <div className="rounded-lg border border-border bg-background p-3 text-sm">
                    <p>{answer}</p>
                    <Button asChild className="mt-3" size="sm" variant="outline">
                      <Link href="/library/doc-apa-workpaper?anchor=range-analysis&returnTo=%2Fask&returnLabel=Ask">
                        Open cited APA range
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {askMode === "go-to" ? (
              <div className="rounded-lg border border-border bg-background p-3 text-sm">
                <p className="font-medium">Best match</p>
                <Button asChild className="mt-3" size="sm" variant="outline">
                  <Link href="/findings/finding-germany-margin">Go to Germany margin drift</Link>
                </Button>
              </div>
            ) : null}

            {askMode === "run" ? (
              <Button type="button" onClick={startRun}>
                Start run
              </Button>
            ) : null}

            {askMode === "create" ? (
              <Button type="button" onClick={createAssignment}>
                Create assignment
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
