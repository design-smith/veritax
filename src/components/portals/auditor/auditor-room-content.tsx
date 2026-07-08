"use client";

import { useState } from "react";

import { AuditorRoom, type AuditorArtifact } from "@/components/portals/auditor/auditor-room";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DEMO_ARTIFACTS: AuditorArtifact[] = [
  { id: "a1", name: "Veritax UK Local File FY2024", type: "local-file", provisionPeriod: "FY2024 Q4", expiresAt: "2026-12-31", hash: "sha256:a1b2c3d4e5f6" },
  { id: "a2", name: "Group Master File FY2024", type: "master-file", provisionPeriod: "FY2024 Q4", expiresAt: "2026-12-31", hash: "sha256:b2c3d4e5f6a7" },
  { id: "a3", name: "Benchmark Study FY2022 - CUT Royalties", type: "benchmark", provisionPeriod: "FY2024 Q4", expiresAt: "2026-12-31", hash: "sha256:c3d4e5f6a7b8" },
  { id: "a4", name: "Veritax Group TP Policy FY2024", type: "memo", provisionPeriod: "FY2024 Q4", expiresAt: "2026-12-31", hash: "sha256:d4e5f6a7b8c9" },
];

interface AccessEvent {
  id: string;
  artifactName: string;
}

export function AuditorRoomContent() {
  const [selectedArtifact, setSelectedArtifact] = useState<AuditorArtifact | null>(null);
  const [accessEvents, setAccessEvents] = useState<AccessEvent[]>([]);

  function openArtifact(artifact: AuditorArtifact) {
    setSelectedArtifact(artifact);
    setAccessEvents((current) => [
      ...current,
      { id: `event-${current.length + 1}`, artifactName: artifact.name },
    ]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Evidence Room</h1>
        <p className="mt-1 text-sm text-muted-foreground">Read-only access to provision-period documents.</p>
      </div>

      <AuditorRoom
        artifacts={DEMO_ARTIFACTS}
        provisionPeriod="FY2024 Q4"
        expiresAt="2026-12-31"
        onOpenArtifact={openArtifact}
      />

      {selectedArtifact ? (
        <Card>
          <CardHeader>
            <CardTitle>Watermarked viewer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{selectedArtifact.name}</span>
              <Badge variant="outline">{selectedArtifact.type}</Badge>
              <Badge variant="outline">{selectedArtifact.hash}</Badge>
            </div>
            <div className="rounded-lg border border-border bg-secondary p-4">
              <p className="font-medium">Read-only artifact preview</p>
              <p className="mt-2 text-muted-foreground">
                This viewer is watermarked and scoped to the evidence-room capability token.
              </p>
            </div>
            <p className="text-xs font-medium text-warning-soft-foreground">
              DRAFT - not for reliance. Watermark applied to every page.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Access events: {accessEvents.length}</p>
          {accessEvents.length === 0 ? (
            <p className="text-muted-foreground">No artifact opened in this session.</p>
          ) : (
            accessEvents.map((event) => (
              <p key={event.id}>Opened {event.artifactName}</p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
