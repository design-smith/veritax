"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mockUsers } from "@/lib/mock";
import { mockEvents } from "@/lib/mock";
import type { Event } from "@/lib/mock";
import type { Role, User } from "@/lib/mock";

type AdminTab = "Members & roles" | "Connector policy" | "Audit log" | "Pending requests";
type PolicyState = "self-serve" | "request" | "disabled";
type AdminRequestStatus = "pending" | "approved" | "denied";

type MemberRoleRecord = User & {
  scimRole: Role;
  effectiveRole: Role;
  source: "scim" | "manual";
};

interface ConnectorPolicyRecord {
  connectorType: string;
  policyState: PolicyState;
  scopeCeiling: string;
  sharePointRead: boolean;
  sharePointWrite: boolean;
  emailRead: boolean;
  emailWrite: boolean;
}

interface AdminRequestRecord {
  id: string;
  type: "access" | "connector";
  requesterName: string;
  description: string;
  createdAt: string;
  status: AdminRequestStatus;
}

const ADMIN_TABS: AdminTab[] = ["Members & roles", "Connector policy", "Audit log", "Pending requests"];

const ROLE_OPTIONS: Role[] = ["vp", "manager", "analyst", "adjacent", "admin"];
const POLICY_STATES: PolicyState[] = ["self-serve", "request", "disabled"];
const SCOPE_CEILINGS = [
  "Label-scoped read-only",
  "Read-only",
  "Approved folders only",
  "No access",
];

const POLICY_LABELS: Record<PolicyState, string> = {
  "self-serve": "Self-serve",
  request: "Request",
  disabled: "Disabled",
};

const INITIAL_CONNECTOR_POLICIES: ConnectorPolicyRecord[] = [
  {
    connectorType: "ERP",
    policyState: "self-serve",
    scopeCeiling: "Label-scoped read-only",
    sharePointRead: true,
    sharePointWrite: false,
    emailRead: false,
    emailWrite: false,
  },
  {
    connectorType: "HRIS",
    policyState: "request",
    scopeCeiling: "Read-only",
    sharePointRead: false,
    sharePointWrite: false,
    emailRead: false,
    emailWrite: false,
  },
  {
    connectorType: "SharePoint",
    policyState: "request",
    scopeCeiling: "Approved folders only",
    sharePointRead: true,
    sharePointWrite: false,
    emailRead: false,
    emailWrite: false,
  },
  {
    connectorType: "Messaging",
    policyState: "disabled",
    scopeCeiling: "No access",
    sharePointRead: false,
    sharePointWrite: false,
    emailRead: false,
    emailWrite: false,
  },
];

const INITIAL_ADMIN_REQUESTS: AdminRequestRecord[] = [
  {
    id: "pr1",
    type: "access",
    requesterName: "Ikaika Choi",
    description: "Analyst Ikaika Choi requests Sensitive-tier named access",
    createdAt: "2025-11-22T10:00:00Z",
    status: "pending",
  },
  {
    id: "pr2",
    type: "connector",
    requesterName: "Sarah Kimura",
    description: "Sarah Kimura requests connection to Workday HRIS",
    createdAt: "2025-11-21T09:00:00Z",
    status: "pending",
  },
];

function buildInitialMembers(): MemberRoleRecord[] {
  return mockUsers.map((user) => ({
    ...user,
    scimRole: user.role,
    effectiveRole: user.role,
    source: "scim",
  }));
}

export function AdminConsoleContent() {
  const [activeTab, setActiveTab] = useState<AdminTab>("Members & roles");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-6">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">IT and security plane</p>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">Admin Console</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Manage metadata, role policy, connector policy, audit events, and request queues without rendering record content.
        </p>
      </header>

      <div role="tablist" aria-label="Admin console sections" className="flex flex-wrap gap-1 border-b border-border">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/35",
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Members & roles" ? <MembersRolesPanel /> : null}
      {activeTab === "Connector policy" ? <ConnectorPolicyPanel /> : null}
      {activeTab === "Audit log" ? <AuditLogPanel events={mockEvents} /> : null}
      {activeTab === "Pending requests" ? <PendingRequestsPanel /> : null}
      {activeTab !== "Members & roles" &&
      activeTab !== "Connector policy" &&
      activeTab !== "Audit log" &&
      activeTab !== "Pending requests" ? (
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-base font-semibold text-foreground">{activeTab}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This P1 admin section uses metadata and policy controls only.
          </p>
        </section>
      ) : null}
    </main>
  );
}

function PendingRequestsPanel() {
  const [requests, setRequests] = useState<AdminRequestRecord[]>(INITIAL_ADMIN_REQUESTS);

  const pendingRequests = requests.filter((request) => request.status === "pending");
  const resolvedRequests = requests.filter((request) => request.status !== "pending");

  function resolveRequest(id: string, status: Exclude<AdminRequestStatus, "pending">) {
    setRequests((current) =>
      current.map((request) => (request.id === id ? { ...request, status } : request))
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Pending requests</h2>
          <p className="text-sm text-muted-foreground">
            Review access and connector requests using metadata and policy context only.
          </p>
        </div>

        {pendingRequests.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Pending queue clear</p>
        ) : (
          <div className="divide-y divide-border">
            {pendingRequests.map((request) => (
              <article key={request.id} className="grid gap-3 bg-card px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {request.type}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{request.createdAt}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{request.description}</p>
                  <p className="text-xs text-muted-foreground">Requester: {request.requesterName}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => resolveRequest(request.id, "approved")}>
                    Approve request {request.id}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolveRequest(request.id, "denied")}>
                    Deny request {request.id}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Request decisions</h3>
        <ul className="mt-3 grid gap-2">
          {resolvedRequests.length === 0 ? (
            <li className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted-foreground">
              No request decisions yet.
            </li>
          ) : (
            resolvedRequests.map((request) => (
              <li key={request.id} className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground">
                {request.id} {request.status}
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}

function AuditLogPanel({ events }: { events: Event[] }) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const visibleEvents = normalizedSearch
    ? events.filter((event) =>
        [event.type, event.objectType, event.objectRef, event.actorId].some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        )
      )
    : events;

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Audit log</h2>
        <p className="text-sm text-muted-foreground">
          Admin metadata only. Record content is never rendered here.
        </p>
      </div>

      <div className="grid gap-4 p-4">
        <label className="grid gap-1.5 text-sm font-medium text-foreground">
          Search audit metadata
          <input
            aria-label="Search audit metadata"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search event type, object ref, actor, or object type"
            className="h-8 rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
          />
        </label>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Timestamp", "Event type", "Actor", "Object type", "Object ref"].map((header) => (
                  <th key={header} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleEvents.map((event) => (
                <tr key={event.id} className="bg-card">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{event.timestamp}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{event.type}</Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{event.actorId}</td>
                  <td className="px-4 py-3 text-muted-foreground">{event.objectType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{event.objectRef}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ConnectorPolicyPanel() {
  const [savedPolicies, setSavedPolicies] = useState<ConnectorPolicyRecord[]>(INITIAL_CONNECTOR_POLICIES);
  const [draftPolicies, setDraftPolicies] = useState<ConnectorPolicyRecord[]>(INITIAL_CONNECTOR_POLICIES);
  const [saveNotice, setSaveNotice] = useState("");

  function updateDraft(connectorType: string, patch: Partial<ConnectorPolicyRecord>) {
    setDraftPolicies((current) =>
      current.map((policy) =>
        policy.connectorType === connectorType ? { ...policy, ...patch } : policy
      )
    );
  }

  function savePolicy(connectorType: string) {
    const draft = draftPolicies.find((policy) => policy.connectorType === connectorType);
    if (!draft) return;
    setSavedPolicies((current) =>
      current.map((policy) => (policy.connectorType === connectorType ? draft : policy))
    );
    setSaveNotice(`Connector policy saved: ${connectorType}`);
  }

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Connector policy</h2>
        <p className="text-sm text-muted-foreground">
          Set connector availability, scope ceilings, and destination read/write controls.
        </p>
      </div>

      {saveNotice ? (
        <p className="mx-4 mt-4 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
          {saveNotice}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Connector", "Saved policy", "Draft controls", "Destinations", "Save"].map((header) => (
                <th key={header} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {draftPolicies.map((draft) => {
              const saved = savedPolicies.find((policy) => policy.connectorType === draft.connectorType) ?? draft;

              return (
                <tr key={draft.connectorType} className="bg-card">
                  <td className="px-4 py-3 font-medium text-foreground">{draft.connectorType}</td>
                  <td className="px-4 py-3">
                    <div className="grid gap-1.5">
                      <Badge variant={saved.policyState === "disabled" ? "secondary" : "info"}>
                        {POLICY_LABELS[saved.policyState]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{saved.scopeCeiling}</span>
                      <span className="text-xs text-muted-foreground">
                        {saved.sharePointWrite ? "SharePoint write allowed" : "SharePoint write blocked"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2">
                      <select
                        aria-label={`Policy state for ${draft.connectorType}`}
                        value={draft.policyState}
                        onChange={(event) =>
                          updateDraft(draft.connectorType, { policyState: event.target.value as PolicyState })
                        }
                        className="h-8 rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                      >
                        {POLICY_STATES.map((state) => (
                          <option key={state} value={state}>
                            {POLICY_LABELS[state]}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`Scope ceiling for ${draft.connectorType}`}
                        value={draft.scopeCeiling}
                        onChange={(event) => updateDraft(draft.connectorType, { scopeCeiling: event.target.value })}
                        className="h-8 rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                      >
                        {SCOPE_CEILINGS.map((scopeCeiling) => (
                          <option key={scopeCeiling}>{scopeCeiling}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2">
                      <PolicyCheckbox
                        label={`Allow SharePoint read for ${draft.connectorType}`}
                        checked={draft.sharePointRead}
                        onChange={() => updateDraft(draft.connectorType, { sharePointRead: !draft.sharePointRead })}
                      />
                      <PolicyCheckbox
                        label={`Allow SharePoint write for ${draft.connectorType}`}
                        checked={draft.sharePointWrite}
                        onChange={() => updateDraft(draft.connectorType, { sharePointWrite: !draft.sharePointWrite })}
                      />
                      <PolicyCheckbox
                        label={`Allow email read for ${draft.connectorType}`}
                        checked={draft.emailRead}
                        onChange={() => updateDraft(draft.connectorType, { emailRead: !draft.emailRead })}
                      />
                      <PolicyCheckbox
                        label={`Allow email write for ${draft.connectorType}`}
                        checked={draft.emailWrite}
                        onChange={() => updateDraft(draft.connectorType, { emailWrite: !draft.emailWrite })}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="outline" onClick={() => savePolicy(draft.connectorType)}>
                      Save connector policy for {draft.connectorType}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PolicyCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-foreground">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={onChange}
        className="size-4 rounded border-input accent-primary"
      />
      {label.replace(/^Allow /, "")}
    </label>
  );
}

function MembersRolesPanel() {
  const [members, setMembers] = useState<MemberRoleRecord[]>(buildInitialMembers);
  const [draftRoles, setDraftRoles] = useState<Record<string, Role>>(
    Object.fromEntries(mockUsers.map((user) => [user.id, user.role]))
  );
  const [saveNotice, setSaveNotice] = useState("");

  function saveOverride(memberId: string) {
    const nextRole = draftRoles[memberId];
    setMembers((current) =>
      current.map((member) =>
        member.id === memberId
          ? {
              ...member,
              effectiveRole: nextRole,
              source: nextRole === member.scimRole ? "scim" : "manual",
            }
          : member
      )
    );
    const member = members.find((candidate) => candidate.id === memberId);
    if (member) setSaveNotice(`Role override saved: ${member.name} -> ${nextRole}`);
  }

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Members & roles</h2>
        <p className="text-sm text-muted-foreground">
          SCIM remains the source view. Admins can apply a manual override without editing identity data.
        </p>
      </div>

      {saveNotice ? (
        <p className="mx-4 mt-4 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
          {saveNotice}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Member", "SCIM role", "Effective role", "Source", "Manual override"].map((header) => (
                <th key={header} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((member) => (
              <tr key={member.id} className="bg-card">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{member.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{member.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="capitalize">
                    {member.scimRole}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={member.source === "manual" ? "warning" : "secondary"} className="capitalize">
                    {member.effectiveRole}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={member.source === "manual" ? "warning" : "info"}>
                    {member.source === "manual" ? "manual override" : "SCIM read"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Manual role override for ${member.name}`}
                      value={draftRoles[member.id]}
                      onChange={(event) =>
                        setDraftRoles((current) => ({ ...current, [member.id]: event.target.value as Role }))
                      }
                      className="h-8 rounded-md border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" onClick={() => saveOverride(member.id)}>
                      Save role override for {member.name}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
