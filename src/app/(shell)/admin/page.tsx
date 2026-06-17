"use client";

import { useState } from "react";
import { AuditLogExplorer } from "@/components/admin/audit-log-explorer";
import { BreakGlassDialog } from "@/components/admin/break-glass-dialog";
import { ConnectorPolicyMatrix } from "@/components/admin/connector-policy-matrix";
import { MembersTable } from "@/components/admin/members-table";
import { PendingRequestsQueue } from "@/components/admin/pending-requests-queue";
import { RetentionScheduleEditor } from "@/components/admin/retention-schedule-editor";
import { SensitivityAccessManager } from "@/components/admin/sensitivity-access-manager";
import { TrustCenterPublisher } from "@/components/trust-center/trust-center-publisher";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockEvents, mockUsers } from "@/lib/mock";

const DEMO_POLICIES = [
  { connectorType: "ERP", policyState: "self-serve" as const, scopeCeiling: "Label-scoped read-only", allowWrite: false },
  { connectorType: "HRIS", policyState: "request" as const, scopeCeiling: "Read-only", allowWrite: false },
  { connectorType: "sharepoint", policyState: "request" as const, scopeCeiling: "Read-only, approved folders only", allowWrite: false },
  { connectorType: "messaging", policyState: "disabled" as const, scopeCeiling: "—", allowWrite: false },
];

const DEMO_REQUESTS = [
  { id: "pr1", type: "access" as const, requesterId: "u3", description: "Analyst Ikaika Choi requests Sensitive-tier named access", status: "pending" as const, createdAt: "2025-11-22T10:00:00Z" },
  { id: "pr2", type: "connector" as const, requesterId: "u4", description: "Sarah Kimura requests connection to Workday HRIS (shared source)", status: "pending" as const, createdAt: "2025-11-21T09:00:00Z" },
];

const noop = () => {};

const DEMO_RETENTION = [
  { id: "rs1", docClass: "local-file",  jurisdiction: "GB", daysToRetain: 2555, legalHold: false },
  { id: "rs2", docClass: "master-file", jurisdiction: "US", daysToRetain: 2555, legalHold: true  },
  { id: "rs3", docClass: "ica",         jurisdiction: "DE", daysToRetain: 3650, legalHold: false },
];

const DEMO_TRUST_ITEMS = [
  { id: "residency",   label: "Data residency",      description: "All data stored in EU/US regions only.",  status: "published" as const, lastUpdated: "2025-11-01" },
  { id: "encryption",  label: "Encryption at rest",  description: "AES-256 encryption on all stored data.",  status: "published" as const, lastUpdated: "2025-11-01" },
  { id: "audit-log",   label: "Audit-log retention", description: "Audit logs retained for 7 years.",         status: "draft" as const,     lastUpdated: "2025-11-10" },
  { id: "soc2",        label: "SOC 2 Type II status", description: "Certified annually by external auditor.", status: "draft" as const,     lastUpdated: "2025-11-10" },
];

export default function AdminPage() {
  const [bgOpen, setBgOpen] = useState(false);
  const [namedUsers, setNamedUsers] = useState([mockUsers[0], mockUsers[1]]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin Console</h1>
        <Button variant="destructive" size="sm" onClick={() => setBgOpen(true)}>
          Break-glass
        </Button>
      </div>

      <Tabs defaultValue="members">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="connectors">Connector policy</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="requests">Pending</TabsTrigger>
          <TabsTrigger value="access">Sensitivity access</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="trust">Trust center</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-4"><MembersTable members={mockUsers} /></TabsContent>
        <TabsContent value="connectors" className="mt-4"><ConnectorPolicyMatrix policies={DEMO_POLICIES} onUpdatePolicy={noop} /></TabsContent>
        <TabsContent value="audit" className="mt-4"><AuditLogExplorer events={mockEvents} /></TabsContent>
        <TabsContent value="requests" className="mt-4"><PendingRequestsQueue requests={DEMO_REQUESTS} onApprove={noop} onDeny={noop} /></TabsContent>
        <TabsContent value="access" className="mt-4">
          <SensitivityAccessManager
            tier="sensitive"
            namedUsers={namedUsers}
            allUsers={mockUsers}
            onAdd={(id) => setNamedUsers((p) => [...p, mockUsers.find((u) => u.id === id)!])}
            onRemove={(id) => setNamedUsers((p) => p.filter((u) => u.id !== id))}
          />
        </TabsContent>
        <TabsContent value="retention" className="mt-4">
          <RetentionScheduleEditor schedules={DEMO_RETENTION} onChange={noop} />
        </TabsContent>
        <TabsContent value="trust" className="mt-4">
          <TrustCenterPublisher items={DEMO_TRUST_ITEMS} onPublish={noop} onRetract={noop} />
        </TabsContent>
      </Tabs>

      <BreakGlassDialog open={bgOpen} onClose={() => setBgOpen(false)} onConfirm={noop} />
    </div>
  );
}
