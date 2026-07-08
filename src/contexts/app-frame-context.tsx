"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { GateRequest, User } from "@/lib/mock/types";

export type DigestCategory = "findings" | "runs" | "gates" | "sources" | "obligations";
export type DigestCadence = "immediate" | "hourly" | "daily" | "muted";

export interface AppWorkspace {
  id: string;
  name: string;
  subgroups: AppSubgroup[];
}

export interface AppSubgroup {
  id: string;
  name: string;
  description: string;
}

export interface DigestItem {
  id: string;
  category: DigestCategory;
  title: string;
  summary: string;
  href: string;
  occurredAt: string;
  read: boolean;
}

export interface DigestCadenceSetting {
  category: DigestCategory;
  cadence: DigestCadence;
}

export interface AppFrameState {
  currentUser: User;
  workspaces: AppWorkspace[];
  activeWorkspaceId: string;
  activeSubgroupId: string;
  digestItems: DigestItem[];
  digestCadence: DigestCadenceSetting[];
  pendingGates: GateRequest[];
}

export interface AppFrameContextValue extends AppFrameState {
  activeWorkspace: AppWorkspace;
  activeSubgroup: AppSubgroup;
  unreadDigestCount: number;
  setWorkspace: (workspaceId: string) => void;
  setSubgroup: (subgroupId: string) => void;
  markDigestRead: (digestItemId: string) => void;
  markAllDigestRead: () => void;
  setDigestCadence: (category: DigestCategory, cadence: DigestCadence) => void;
  approveGate: (gateId: string) => void;
  rejectGate: (gateId: string) => void;
  requestGateChanges: (gateId: string) => void;
  delegateGate: (gateId: string, delegateId: string) => void;
}

const DEFAULT_USER: User = {
  id: "u2",
  name: "Marcus Webb",
  email: "m.webb@veritax.io",
  role: "manager",
};

const DEFAULT_WORKSPACES: AppWorkspace[] = [
  {
    id: "workspace-global",
    name: "Veritax Group",
    subgroups: [
      {
        id: "subgroup-global-tp",
        name: "Global transfer pricing",
        description: "All entities, flows, findings, and gates for the group record.",
      },
      {
        id: "subgroup-uk",
        name: "UK local file",
        description: "UK filing record, local file, gates, and commitments.",
      },
    ],
  },
  {
    id: "workspace-emea",
    name: "EMEA transfer pricing",
    subgroups: [
      {
        id: "subgroup-de",
        name: "Germany local file",
        description: "German local file, GloBE, and benchmark refresh work.",
      },
      {
        id: "subgroup-fr",
        name: "France local file",
        description: "France royalty, CbCR notification, and ICA renewal work.",
      },
    ],
  },
];

const DEFAULT_DIGEST_ITEMS: DigestItem[] = [
  {
    id: "digest-findings-1",
    category: "findings",
    title: "15 findings ready for review",
    summary: "IC scan completed for FY2024 and opened the latest finding set.",
    href: "/findings",
    occurredAt: "2026-06-18T09:00:00Z",
    read: false,
  },
  {
    id: "digest-gates-1",
    category: "gates",
    title: "UK local file gate is pending",
    summary: "Analyst review requested sign-off on the latest UK local file.",
    href: "/library/d2",
    occurredAt: "2026-06-18T08:35:00Z",
    read: false,
  },
  {
    id: "digest-runs-1",
    category: "runs",
    title: "Benchmark refresh failed",
    summary: "The license database was unavailable during the watcher run.",
    href: "/runs",
    occurredAt: "2026-06-18T08:02:00Z",
    read: false,
  },
  {
    id: "digest-sources-1",
    category: "sources",
    title: "Corpus v.419 changed the record",
    summary: "Three artifacts need review before proposals move forward.",
    href: "/findings",
    occurredAt: "2026-06-17T18:15:00Z",
    read: false,
  },
];

const DEFAULT_DIGEST_CADENCE: DigestCadenceSetting[] = [
  { category: "findings", cadence: "immediate" },
  { category: "runs", cadence: "hourly" },
  { category: "gates", cadence: "immediate" },
  { category: "sources", cadence: "daily" },
  { category: "obligations", cadence: "daily" },
];

const DEFAULT_PENDING_GATES: GateRequest[] = [
  {
    id: "g1",
    objectId: "d2",
    objectType: "document",
    objectName: "Veritax UK Local File FY2024 v2",
    requesterId: "u3",
    slaHours: 48,
    slaStarted: "2026-06-17T16:00:00Z",
    escalationPath: "Manager to VP",
  },
  {
    id: "g2",
    objectId: "fn4",
    objectType: "finding",
    objectName: "UK intercompany loan rate remediation",
    requesterId: "u3",
    slaHours: 24,
    slaStarted: "2026-06-18T10:00:00Z",
    escalationPath: "Manager",
  },
  {
    id: "g3",
    objectId: "d7",
    objectType: "document",
    objectName: "Veritax Group TP Policy FY2024 v4 methodology change",
    requesterId: "u2",
    slaHours: 72,
    slaStarted: "2026-06-16T14:00:00Z",
    escalationPath: "VP",
  },
];

const AppFrameContext = createContext<AppFrameContextValue | null>(null);

export function createDefaultAppFrameState(): AppFrameState {
  return {
    currentUser: { ...DEFAULT_USER },
    workspaces: DEFAULT_WORKSPACES.map((workspace) => ({
      ...workspace,
      subgroups: workspace.subgroups.map((subgroup) => ({ ...subgroup })),
    })),
    activeWorkspaceId: "workspace-global",
    activeSubgroupId: "subgroup-global-tp",
    digestItems: DEFAULT_DIGEST_ITEMS.map((item) => ({ ...item })),
    digestCadence: DEFAULT_DIGEST_CADENCE.map((setting) => ({ ...setting })),
    pendingGates: DEFAULT_PENDING_GATES.map((gate) => ({ ...gate })),
  };
}

function resolveWorkspace(workspaces: AppWorkspace[], workspaceId: string): AppWorkspace {
  return workspaces.find((workspace) => workspace.id === workspaceId) ?? workspaces[0];
}

function resolveSubgroup(workspace: AppWorkspace, subgroupId: string): AppSubgroup {
  return workspace.subgroups.find((subgroup) => subgroup.id === subgroupId) ?? workspace.subgroups[0];
}

export function AppFrameProvider({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: AppFrameState;
}) {
  const [state, setState] = useState<AppFrameState>(() => initialState ?? createDefaultAppFrameState());

  const activeWorkspace = resolveWorkspace(state.workspaces, state.activeWorkspaceId);
  const activeSubgroup = resolveSubgroup(activeWorkspace, state.activeSubgroupId);
  const unreadDigestCount = state.digestItems.filter((item) => !item.read).length;

  const value = useMemo<AppFrameContextValue>(() => {
    const removeGate = (gateId: string) => {
      setState((current) => ({
        ...current,
        pendingGates: current.pendingGates.filter((gate) => gate.id !== gateId),
      }));
    };

    return {
      ...state,
      activeWorkspace,
      activeSubgroup,
      unreadDigestCount,
      setWorkspace: (workspaceId) => {
        setState((current) => {
          const workspace = resolveWorkspace(current.workspaces, workspaceId);
          return {
            ...current,
            activeWorkspaceId: workspace.id,
            activeSubgroupId: workspace.subgroups[0]?.id ?? current.activeSubgroupId,
          };
        });
      },
      setSubgroup: (subgroupId) => {
        setState((current) => {
          const containingWorkspace = current.workspaces.find((workspace) =>
            workspace.subgroups.some((subgroup) => subgroup.id === subgroupId),
          );

          return {
            ...current,
            activeWorkspaceId: containingWorkspace?.id ?? current.activeWorkspaceId,
            activeSubgroupId: subgroupId,
          };
        });
      },
      markDigestRead: (digestItemId) => {
        setState((current) => ({
          ...current,
          digestItems: current.digestItems.map((item) =>
            item.id === digestItemId ? { ...item, read: true } : item,
          ),
        }));
      },
      markAllDigestRead: () => {
        setState((current) => ({
          ...current,
          digestItems: current.digestItems.map((item) => ({ ...item, read: true })),
        }));
      },
      setDigestCadence: (category, cadence) => {
        setState((current) => ({
          ...current,
          digestCadence: current.digestCadence.map((setting) =>
            setting.category === category ? { ...setting, cadence } : setting,
          ),
        }));
      },
      approveGate: removeGate,
      rejectGate: removeGate,
      requestGateChanges: removeGate,
      delegateGate: (gateId, delegateId) => {
        setState((current) => ({
          ...current,
          pendingGates: current.pendingGates.map((gate) =>
            gate.id === gateId ? { ...gate, delegateId } : gate,
          ),
        }));
      },
    };
  }, [activeSubgroup, activeWorkspace, state, unreadDigestCount]);

  return <AppFrameContext.Provider value={value}>{children}</AppFrameContext.Provider>;
}

export function useAppFrame(): AppFrameContextValue {
  const context = useContext(AppFrameContext);

  if (!context) {
    throw new Error("useAppFrame must be used inside AppFrameProvider");
  }

  return context;
}
