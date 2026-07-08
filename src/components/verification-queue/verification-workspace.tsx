"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, GitBranch, KeyRound, ListChecks, Rows3 } from "lucide-react";
import { ProvenanceChip } from "@/components/patterns/pat-2-provenance";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { VerificationQueue, type VerificationQuestion } from "./verification-queue";

interface AnswerRecord {
  question: VerificationQuestion;
  option: string;
}

interface ContestedRecord {
  question: VerificationQuestion;
  option: string;
  reason: string;
}

interface MappingProposal {
  id: string;
  type: "account" | "entity" | "allocation-key";
  label: string;
  gateClass: "style" | "methodology";
}

interface Notice {
  message: string;
}

const TARGET = 40;

const INITIAL_QUESTIONS: VerificationQuestion[] = [
  {
    id: "q-entity-merge",
    category: "entity-merge",
    question: "Are Veritax Corp (US) and Veritax Holdings Inc the same legal entity?",
    options: ["Same entity", "Different entities", "Partially same", "Unsure - escalate"],
    evidenceText: "Both names appear in the same consolidated return with EIN 12-3456789.",
    consequenceLine: "Confirming will merge these two entity profiles across all periods.",
  },
  {
    id: "q-account-47200",
    category: "account-mapping",
    question: "Is GL account 47200 an intercompany royalty payable account?",
    options: ["Yes", "No", "Partially", "Unsure - escalate"],
    evidenceText: "GL 47200 shows recurring credits labeled royalty fee IC to foreign subsidiaries.",
    consequenceLine: "Confirming maps GL 47200 -> IC royalties for all periods.",
  },
  {
    id: "q-executed-version",
    category: "executed-version",
    question: "Which IC Royalty Agreement version is the executed record?",
    options: ["v1 executed PDF", "v2 draft", "v3 unsigned draft", "Something else"],
    evidenceText: "v1 has the signature manifest and executed-version marker. v2 and v3 are unsigned drafts.",
    consequenceLine: "Confirming pins the executed version for agreement citations and filing evidence.",
  },
  {
    id: "q-extraction-rate",
    category: "extraction-correction",
    question: "Is the extracted royalty rate of 12% correct for the TP Policy?",
    options: ["Correct", "Incorrect - it is different", "Partially correct", "Something else"],
    evidenceText: "Policy section states the applicable royalty rate shall be 12% of net revenue.",
    consequenceLine: "Confirming validates this extraction and its source span.",
  },
  {
    id: "q-dormancy",
    category: "dormancy-flag",
    question: "Should Veritax Dormant GmbH remain marked dormant for FY2024?",
    options: ["Dormant", "Active", "Needs review", "Unsure - escalate"],
    evidenceText: "No ledger activity appears after 2023-12-31, but FY2024 filing evidence exists.",
    consequenceLine: "Confirming updates the dormancy assertion with provenance.",
  },
  {
    id: "q-allocation-key",
    category: "allocation-key",
    question: "Does headcount remain the correct allocation key for APAC hub services?",
    options: ["Yes", "No", "Use revenue instead", "Something else"],
    evidenceText: "Payroll extract supports headcount by receiving entity as of FY2024 Q4.",
    consequenceLine: "Confirming updates the allocation-key basis for service recharge mapping.",
  },
];

function categoryCounts(questions: VerificationQuestion[]) {
  return questions.reduce<Record<string, number>>((counts, question) => {
    counts[question.category] = (counts[question.category] ?? 0) + 1;
    return counts;
  }, {});
}

function isContested(option: string) {
  const normalized = option.toLowerCase();
  return normalized.includes("unsure") || normalized.includes("escalate") || normalized.includes("something else");
}

function proposalLabel(type: MappingProposal["type"]) {
  if (type === "account") return "account mapping";
  if (type === "entity") return "entity-resolution";
  return "allocation-key";
}

export function VerificationWorkspace() {
  const [remaining, setRemaining] = useState(INITIAL_QUESTIONS);
  const [answered, setAnswered] = useState<AnswerRecord[]>([]);
  const [contested, setContested] = useState<ContestedRecord[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [managerNote, setManagerNote] = useState("");
  const [canonicalAccount, setCanonicalAccount] = useState("IC royalties");
  const [mappingNote, setMappingNote] = useState("");
  const [entityNote, setEntityNote] = useState("");
  const [allocationDefinition, setAllocationDefinition] = useState("Headcount by receiving entity");
  const [proposals, setProposals] = useState<MappingProposal[]>([]);

  const queueDepth = remaining.length;
  const confidencePct = Math.min(100, Math.round((answered.length / TARGET) * 100));
  const counts = useMemo(() => categoryCounts(remaining), [remaining]);
  const currentContested = contested[0];

  function answerQuestion(questionId: string, option: string) {
    const question = remaining.find((item) => item.id === questionId);
    if (!question) return;

    setRemaining((current) => current.filter((item) => item.id !== questionId));

    if (isContested(option)) {
      setContested((current) => [
        ...current,
        {
          question,
          option,
          reason: "Analyst selected an uncertain answer.",
        },
      ]);
      setNotice({ message: `${question.id} routed to manager contested queue.` });
      return;
    }

    setAnswered((current) => [...current, { question, option }]);
    setNotice({ message: `Verification answer recorded for ${question.id}: ${option}.` });
  }

  function skipQuestion() {
    setRemaining((current) => (current.length > 1 ? [...current.slice(1), current[0]] : current));
    setNotice({ message: "Question skipped and moved to the back of the queue." });
  }

  function undoAnswer() {
    setAnswered((current) => {
      const last = current[current.length - 1];
      if (!last) return current;
      setRemaining((questions) => [last.question, ...questions]);
      setNotice({ message: `Last answer undone for ${last.question.id}.` });
      return current.slice(0, -1);
    });
  }

  function resolveContested(option: string) {
    if (!currentContested) return;
    setAnswered((current) => [...current, { question: currentContested.question, option }]);
    setContested((current) => current.slice(1));
    setNotice({
      message: `Manager resolution recorded for ${currentContested.question.id}: ${option}.`,
    });
    setManagerNote("");
  }

  function submitProposal(type: MappingProposal["type"], label: string, gateClass: MappingProposal["gateClass"]) {
    const proposal: MappingProposal = {
      id: `${type}-${proposals.length + 1}`,
      type,
      label,
      gateClass,
    };
    setProposals((current) => [...current, proposal]);
    setNotice({
      message: `${proposalLabel(type)} proposal routed to manager gate: ${label}.`,
    });
  }

  return (
    <div className="space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Verification Queue</h1>
          <p className="text-sm text-muted-foreground">
            Teach the record with answerable cards, contested manager review, and structured mapping proposals.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right">
          <div className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="text-xl font-semibold tabular-nums">{queueDepth}</p>
            <p className="text-xs text-muted-foreground">{queueDepth} queue depth</p>
          </div>
          <div className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="text-xl font-semibold tabular-nums">{answered.length}</p>
            <p className="text-xs text-muted-foreground">{answered.length} answered assertions</p>
          </div>
          <div className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="text-xl font-semibold tabular-nums">{proposals.length}</p>
            <p className="text-xs text-muted-foreground">{proposals.length} pending mapping proposals</p>
          </div>
        </div>
      </div>

      {notice && (
        <Alert role="status">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border border-border bg-surface p-3">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Corpus-confidence meter</span>
          <span>{confidencePct}%</span>
        </div>
        <Progress value={confidencePct} aria-label="Corpus confidence" />
      </div>

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="contested">Contested</TabsTrigger>
          <TabsTrigger value="mapping">Mapping Studio</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <VerificationQueue
            questions={remaining}
            answeredCount={answered.length}
            targetCount={TARGET}
            onAnswer={answerQuestion}
            onSkip={skipQuestion}
            onUndo={undoAnswer}
          />

          <aside className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <div>
              <p className="text-sm font-semibold">Queue depth by category</p>
              <div className="mt-2 space-y-1">
                {Object.entries(counts).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between text-xs">
                    <span>{category}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Session streak</p>
              <p className="text-2xl font-semibold tabular-nums">{answered.length}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Shortcuts: 1-4 answer, Enter confirms focused controls, s skips, u undoes last.
            </p>
          </aside>
        </TabsContent>

        <TabsContent value="contested" className="mt-4">
          <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Manager-only contested queue</h2>
              <Badge variant="secondary">{contested.length}</Badge>
            </div>

            {!currentContested ? (
              <p className="text-sm text-muted-foreground">No contested items need manager review.</p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-sm font-medium">{currentContested.question.question}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Analyst answer: {currentContested.option}. {currentContested.reason}
                  </p>
                </div>
                <Label htmlFor="manager-audit-note" className="text-xs">
                  Audit note
                </Label>
                <Textarea
                  id="manager-audit-note"
                  value={managerNote}
                  onChange={(event) => setManagerNote(event.target.value)}
                  rows={3}
                  placeholder="Explain the manager decision."
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => resolveContested("Same entity")}>
                    Resolve as same
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolveContested("Different entities")}>
                    Resolve as different
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolveContested("Unsure")}>
                    Resolve as unsure
                  </Button>
                </div>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="mapping" className="mt-4 grid gap-4 xl:grid-cols-3">
          <section role="region" aria-label="Chart of accounts mapping" className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <Rows3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Chart of accounts mapping</h2>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">GL 47200</p>
              <p className="text-xs text-muted-foreground">Recurring royalty payable labels - 91% confidence - 87% coverage</p>
            </div>
            <Label htmlFor="canonical-account" className="text-xs">
              Canonical account
            </Label>
            <Select value={canonicalAccount} onValueChange={setCanonicalAccount}>
              <SelectTrigger id="canonical-account" aria-label="Canonical account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IC royalties">IC royalties</SelectItem>
                <SelectItem value="IC services">IC services</SelectItem>
                <SelectItem value="External COGS">External COGS</SelectItem>
              </SelectContent>
            </Select>
            <Label htmlFor="mapping-audit-note" className="text-xs">
              Mapping audit note
            </Label>
            <Textarea
              id="mapping-audit-note"
              value={mappingNote}
              onChange={(event) => setMappingNote(event.target.value)}
              rows={2}
              placeholder="Why is this mapping right?"
            />
            <Button
              size="sm"
              onClick={() => submitProposal("account", `GL 47200 -> ${canonicalAccount}`, "methodology")}
            >
              Submit mapping proposal
            </Button>
          </section>

          <section role="region" aria-label="Entity resolution workbench" className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Entity resolution workbench</h2>
            </div>
            <div className="grid gap-2">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">Veritax Corp (US)</p>
                <p className="text-xs text-muted-foreground">EIN 12-3456789 - principal</p>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <p className="text-sm font-medium">Veritax Holdings Inc</p>
                <p className="text-xs text-muted-foreground">EIN 12-3456789 - holding company</p>
              </div>
            </div>
            <Label htmlFor="entity-audit-note" className="text-xs">
              Entity audit note
            </Label>
            <Textarea
              id="entity-audit-note"
              value={entityNote}
              onChange={(event) => setEntityNote(event.target.value)}
              rows={2}
              placeholder="Explain merge or split basis."
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => submitProposal("entity", "Merge Veritax Corp (US) cluster", "methodology")}>
                Merge cluster
              </Button>
              <Button size="sm" variant="outline" onClick={() => submitProposal("entity", "Split Veritax Corp (US) cluster", "methodology")}>
                Split cluster
              </Button>
            </div>
          </section>

          <section role="region" aria-label="Allocation keys editor" className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Allocation keys editor</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline">
                Basis source
              </Button>
              <ProvenanceChip
                asOf="2024-12-31"
                source="Payroll headcount extract"
                hops={[
                  { label: "Payroll roster", type: "ledger-line" },
                  { label: "Entity headcount mapping", type: "mapping" },
                  { label: "Service allocation basis", type: "metric" },
                ]}
              />
            </div>
            <Label htmlFor="allocation-key-definition" className="text-xs">
              Allocation key definition
            </Label>
            <Input
              id="allocation-key-definition"
              value={allocationDefinition}
              onChange={(event) => setAllocationDefinition(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Applies to APAC hub service flows f3, f4, and f9.</p>
            <Button
              size="sm"
              onClick={() => submitProposal("allocation-key", allocationDefinition, "methodology")}
            >
              Submit allocation proposal
            </Button>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
