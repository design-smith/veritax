"use client";

import { useState } from "react";
import { AdvisorRequestForm } from "@/components/portals/advisor/advisor-request-form";
import { AdvisorRequestsList, type AdvisorRequest } from "@/components/portals/advisor/advisor-requests-list";

const DEMO_REQUESTS: AdvisorRequest[] = [
  {
    id: "dr1",
    title: "Provide payroll headcount data for Germany FY2024",
    description: "Please provide headcount by cost center and month for the German entity for FY2024.",
    dueDate: "2025-12-20",
    status: "pending",
    fields: [
      { id: "f1", label: "Total headcount (FY2024 average)", type: "number", required: true },
      { id: "f2", label: "Payroll total (EUR)", type: "number", required: true },
      { id: "f3", label: "Notes / methodology", type: "textarea", required: false },
    ],
  },
  {
    id: "dr2",
    title: "Confirm executed version of royalty agreement",
    description: "Indicate which version is the executed version and upload the signed copy.",
    dueDate: "2025-12-10",
    status: "submitted",
    fields: [{ id: "f4", label: "Executed version number", type: "text", required: true }],
  },
];

const noop = () => {};

export default function AdvisorPortalPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = DEMO_REQUESTS.find((r) => r.id === selectedId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">Complete assigned data requests to support the TP review.</p>
      </div>

      {selected ? (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedId(null)}
            className="text-sm text-primary underline-offset-2 hover:underline"
          >
            ← Back to queue
          </button>
          <AdvisorRequestForm request={selected} onSubmit={noop} onUpload={noop} />
        </div>
      ) : (
        <AdvisorRequestsList requests={DEMO_REQUESTS} onOpen={setSelectedId} />
      )}
    </div>
  );
}
