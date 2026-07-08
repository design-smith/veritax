import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AuditorRoom, type AuditorArtifact } from "../auditor-room";

const artifacts: AuditorArtifact[] = [
  { id: "a1", name: "Veritax UK Local File FY2024", type: "local-file", provisionPeriod: "FY2024 Q4", expiresAt: "2026-12-31", hash: "sha256:a1b2c3" },
  { id: "a2", name: "Group Master File FY2024", type: "master-file", provisionPeriod: "FY2024 Q4", expiresAt: "2026-12-31", hash: "sha256:d4e5f6" },
  { id: "a3", name: "Benchmark Study FY2022", type: "benchmark", provisionPeriod: "FY2024 Q4", expiresAt: "2026-12-31", hash: "sha256:g7h8i9" },
];

function AuditorRoomHarness() {
  const [openedArtifact, setOpenedArtifact] = useState("none");

  return (
    <>
      <AuditorRoom
        artifacts={artifacts}
        provisionPeriod="FY2024 Q4"
        expiresAt="2026-12-31"
        onOpenArtifact={(artifact) => setOpenedArtifact(artifact.id)}
      />
      <p>Opened artifact: {openedArtifact}</p>
    </>
  );
}

describe("AuditorRoom", () => {
  it("renders a logged, expiring, watermarked evidence room", () => {
    render(<AuditorRoom artifacts={artifacts} provisionPeriod="FY2024 Q4" expiresAt="2026-12-31" />);

    expect(screen.getByText("Veritax UK Local File FY2024")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/views are logged/i);
    expect(screen.getByText(/access expires/i)).toBeInTheDocument();
    expect(screen.getByText("FY2024 Q4")).toBeInTheDocument();
    expect(screen.getByText(/sha256:a1b2/)).toBeInTheDocument();
    expect(screen.getByText("local-file")).toBeInTheDocument();
    expect(screen.getAllByText(/watermark applied/i).length).toBeGreaterThan(0);
  });

  it("opens artifacts when the evidence room is interactive and still exposes no mutation controls", async () => {
    const user = userEvent.setup();
    render(<AuditorRoomHarness />);

    expect(screen.queryByRole("button", { name: /edit|delete|upload|submit/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /veritax uk local file fy2024/i }));

    expect(screen.getByText("Opened artifact: a1")).toBeInTheDocument();
  });
});
