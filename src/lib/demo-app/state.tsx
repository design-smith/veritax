"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { demoRecord, type DemoFiscalYear, type DemoRole } from "./record";

export type DemoCommandType =
  | "run_stage"
  | "submit_instruction"
  | "answer_verification"
  | "triage_finding"
  | "gate_decision"
  | "assign"
  | "export"
  | "connect_source"
  | "ask";

export type DemoCommandInput = {
  type: DemoCommandType;
  sourceSurface: string;
  payload: Record<string, unknown>;
};

export type DemoCommandEnvelope = DemoCommandInput & {
  id: string;
  actor: DemoRole;
  fiscalYear: DemoFiscalYear;
  issuedAt: string;
  status: "pending";
};

type DemoAppContextValue = {
  fiscalYear: DemoFiscalYear;
  role: DemoRole;
  commands: DemoCommandEnvelope[];
  setFiscalYear: (fiscalYear: DemoFiscalYear) => void;
  setRole: (role: DemoRole) => void;
  emitCommand: (command: DemoCommandInput) => DemoCommandEnvelope;
};

const DemoAppContext = createContext<DemoAppContextValue | null>(null);

let commandSequence = 0;

export function createDemoCommandEnvelope(
  command: DemoCommandInput,
  context: {
    actor: DemoRole;
    fiscalYear: DemoFiscalYear;
    now?: Date;
  },
): DemoCommandEnvelope {
  commandSequence += 1;

  return {
    ...command,
    id: `demo-command-${commandSequence}`,
    actor: context.actor,
    fiscalYear: context.fiscalYear,
    issuedAt: (context.now ?? new Date()).toISOString(),
    status: "pending",
  };
}

export function DemoAppProvider({ children }: { children: ReactNode }) {
  const [fiscalYear, setFiscalYear] = useState<DemoFiscalYear>(demoRecord.fiscalYears[0]);
  const [role, setRole] = useState<DemoRole>(demoRecord.roles[0]);
  const [commands, setCommands] = useState<DemoCommandEnvelope[]>([]);

  const emitCommand = useCallback(
    (command: DemoCommandInput) => {
      const envelope = createDemoCommandEnvelope(command, {
        actor: role,
        fiscalYear,
      });
      setCommands((current) => [envelope, ...current]);
      return envelope;
    },
    [fiscalYear, role],
  );

  const value = useMemo(
    () => ({
      fiscalYear,
      role,
      commands,
      setFiscalYear,
      setRole,
      emitCommand,
    }),
    [commands, emitCommand, fiscalYear, role],
  );

  return <DemoAppContext.Provider value={value}>{children}</DemoAppContext.Provider>;
}

export function useDemoApp() {
  const context = useContext(DemoAppContext);

  if (!context) {
    throw new Error("useDemoApp must be used inside DemoAppProvider");
  }

  return context;
}
