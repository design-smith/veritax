"use client";

import { useMemo, useState } from "react";

import { AdvisorRequestForm } from "@/components/portals/advisor/advisor-request-form";
import { AdvisorRequestsList, type AdvisorRequest } from "@/components/portals/advisor/advisor-requests-list";
import { Button } from "@/components/ui/button";

const INITIAL_REQUESTS: AdvisorRequest[] = [
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

interface ResponseReceipt {
  requestId: string;
  fileNames: string[];
  fieldCount: number;
}

export function AdvisorPortalContent() {
  const [requests, setRequests] = useState<AdvisorRequest[]>(INITIAL_REQUESTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [latestReceipt, setLatestReceipt] = useState<ResponseReceipt | null>(null);
  const [lastUploadedFileNames, setLastUploadedFileNames] = useState<string[]>([]);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId],
  );

  function backToQueue() {
    setSelectedId(null);
    setLastUploadedFileNames([]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Data Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Complete assigned data requests and upload supporting files for the Veritax record.
        </p>
      </div>

      {selectedRequest ? (
        <div className="space-y-4">
          <Button type="button" variant="ghost" onClick={backToQueue}>
            Back to queue
          </Button>

          {latestReceipt?.requestId === selectedRequest.id ? (
            <div className="rounded-lg border border-success/25 bg-success-soft p-4 text-sm text-success-soft-foreground">
              <p className="font-semibold">Response submitted</p>
              <p>{latestReceipt.fieldCount} fields captured.</p>
              {latestReceipt.fileNames.length > 0 ? (
                <p>Files: {latestReceipt.fileNames.join(", ")}</p>
              ) : null}
            </div>
          ) : null}

          <AdvisorRequestForm
            request={selectedRequest}
            onUpload={(files) => setLastUploadedFileNames(files.map((file) => file.name))}
            onSubmit={(payload) => {
              const fileNames = payload.files.map((file) => file.name);
              setRequests((current) =>
                current.map((request) =>
                  request.id === payload.requestId ? { ...request, status: "submitted" } : request,
                ),
              );
              setLatestReceipt({
                requestId: payload.requestId,
                fieldCount: Object.keys(payload.values).length,
                fileNames: fileNames.length > 0 ? fileNames : lastUploadedFileNames,
              });
            }}
          />
        </div>
      ) : (
        <AdvisorRequestsList
          requests={requests}
          onOpen={setSelectedId}
        />
      )}
    </div>
  );
}
