import type { Document, Entity, Finding, Flow, Run } from "@/lib/mock/types";

export interface AskSearchCorpus {
  entities: Entity[];
  flows: Flow[];
  findings: Finding[];
  documents: Document[];
  runs: Run[];
}

export interface AskSearchResult {
  entities: Entity[];
  flows: Flow[];
  findings: Finding[];
  documents: Document[];
  runs: Run[];
}

const MAX_PER_GROUP = 5;

function match(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

export function searchAskObjects(
  query: string,
  corpus: AskSearchCorpus,
): AskSearchResult {
  if (!query.trim()) {
    return { entities: [], flows: [], findings: [], documents: [], runs: [] };
  }

  const q = query.trim();

  return {
    entities: corpus.entities
      .filter((e) => match(e.name, q) || match(e.jurisdictionCode, q) || match(e.jurisdiction, q))
      .slice(0, MAX_PER_GROUP),

    flows: corpus.flows
      .filter((f) => match(f.kind, q) || match(f.method, q) || match(f.status, q))
      .slice(0, MAX_PER_GROUP),

    findings: corpus.findings
      .filter((f) => match(f.title, q) || match(f.summary, q) || match(f.ruleId, q))
      .slice(0, MAX_PER_GROUP),

    documents: corpus.documents
      .filter((d) => match(d.name, q) || match(d.type, q) || match(d.jurisdiction, q))
      .slice(0, MAX_PER_GROUP),

    runs: corpus.runs
      .filter((r) => match(r.stage, q) || match(r.scope, q))
      .slice(0, MAX_PER_GROUP),
  };
}
