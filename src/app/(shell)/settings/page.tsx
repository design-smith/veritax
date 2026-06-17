"use client";

import { useState } from "react";
import { DelegationSettings } from "@/components/settings-page/delegation-settings";
import { NotificationsSettings } from "@/components/settings-page/notifications-settings";
import { StandingInstructionsList } from "@/components/settings-page/standing-instructions-list";
import { mockUsers } from "@/lib/mock";

const DEMO_INSTRUCTIONS = [
  { id: "si1", text: "Always use bullet points for lists in executive summaries", tier: "style" as const, scope: "global", createdBy: "u2" },
  { id: "si2", text: "Run IC scan within 24h of any new source sync", tier: "run" as const, scope: "global", createdBy: "u2" },
  { id: "si3", text: "Use TNMM for all intragroup service flows in APAC", tier: "methodology" as const, scope: "Veritax APAC Pte Ltd", createdBy: "u1" },
];

const DEMO_CATEGORIES = [
  { id: "findings", label: "Findings", cadence: "realtime" as const },
  { id: "runs", label: "Runs", cadence: "daily" as const },
  { id: "gates", label: "Gate requests", cadence: "realtime" as const },
  { id: "obligations", label: "Obligations", cadence: "weekly" as const },
  { id: "commitments", label: "Commitments", cadence: "daily" as const },
];

const SECTION_TABS = ["Standing Instructions", "Notifications", "Delegation"] as const;
type Tab = (typeof SECTION_TABS)[number];

const noop = () => {};

export default function SettingsPage() {
  const [active, setActive] = useState<Tab>("Standing Instructions");

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div role="tablist" className="flex gap-1 border-b border-border pb-0">
        {SECTION_TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={active === tab}
            onClick={() => setActive(tab)}
            className={`border-b-2 px-4 py-2 text-sm transition-colors ${
              active === tab ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {active === "Standing Instructions" && (
          <StandingInstructionsList instructions={DEMO_INSTRUCTIONS} onDelete={noop} />
        )}
        {active === "Notifications" && (
          <NotificationsSettings categories={DEMO_CATEGORIES} onChange={noop} />
        )}
        {active === "Delegation" && (
          <DelegationSettings users={mockUsers} currentDelegateId="u2" expiresAt="2025-12-31" onSave={noop} />
        )}
      </div>
    </div>
  );
}
