import { AuditorRoom } from "@/components/portals/auditor/auditor-room";

const DEMO_ARTIFACTS = [
  { id: "a1", name: "Veritax UK Local File FY2024", type: "local-file" as const, provisionPeriod: "FY2024 Q4", expiresAt: "2026-03-31", hash: "sha256:a1b2c3d4e5f6" },
  { id: "a2", name: "Group Master File FY2024",     type: "master-file" as const, provisionPeriod: "FY2024 Q4", expiresAt: "2026-03-31", hash: "sha256:b2c3d4e5f6a7" },
  { id: "a3", name: "Benchmark Study FY2022 — CUT Royalties", type: "benchmark" as const, provisionPeriod: "FY2024 Q4", expiresAt: "2026-03-31", hash: "sha256:c3d4e5f6a7b8" },
  { id: "a4", name: "Veritax Group TP Policy FY2024", type: "memo" as const, provisionPeriod: "FY2024 Q4", expiresAt: "2026-03-31", hash: "sha256:d4e5f6a7b8c9" },
];

export default function AuditorRoomPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Evidence Room</h1>
        <p className="text-sm text-muted-foreground mt-1">Read-only access to provision-period documents.</p>
      </div>
      <AuditorRoom
        artifacts={DEMO_ARTIFACTS}
        provisionPeriod="FY2024 Q4"
        expiresAt="2026-03-31"
      />
    </div>
  );
}
