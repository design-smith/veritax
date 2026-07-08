import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HoursLog, type HoursEntry } from "../hours-log";
import { ReviewQueue, type ReviewAssignment } from "../review-queue";
import { SignCeremony } from "../sign-ceremony";

const assignments: ReviewAssignment[] = [
  { id: "a1", docName: "Veritax UK Local File FY2024", docType: "local-file", status: "assigned", redlineCount: 3 },
  { id: "a2", docName: "Group Master File FY2024", docType: "master-file", status: "in-progress", redlineCount: 0 },
  { id: "a3", docName: "Benchmark Study FY2022", docType: "benchmark", status: "signed", redlineCount: 0 },
];

const entries: HoursEntry[] = [
  { id: "h1", docId: "a1", docName: "Veritax UK Local File FY2024", hours: 2.5, date: "2025-11-20" },
  { id: "h2", docId: "a2", docName: "Group Master File FY2024", hours: 1, date: "2025-11-21" },
];

function ReviewQueueHarness() {
  const [openedAssignment, setOpenedAssignment] = useState("none");

  return (
    <>
      <ReviewQueue assignments={assignments} onOpen={setOpenedAssignment} />
      <p>Opened assignment: {openedAssignment}</p>
    </>
  );
}

function SignCeremonyHarness() {
  const [sealed, setSealed] = useState(false);

  return (
    <>
      <SignCeremony
        docName="Veritax UK Local File FY2024"
        reviewerName="External Reviewer A"
        attestationText="I confirm that I have reviewed the above document and it is accurate to the best of my knowledge."
        onSeal={() => setSealed(true)}
      />
      <p>Seal state: {sealed ? "sealed" : "unsealed"}</p>
    </>
  );
}

function HoursLogHarness() {
  const [visibleEntries, setVisibleEntries] = useState(entries);

  return (
    <HoursLog
      entries={visibleEntries}
      onAddEntry={(payload) =>
        setVisibleEntries((current) => [
          ...current,
          { id: `h${current.length + 1}`, docId: "manual", docName: "General review", ...payload },
        ])
      }
    />
  );
}

describe("ReviewQueue", () => {
  it("renders assigned documents with type, status, and redline chips", () => {
    render(<ReviewQueueHarness />);

    expect(screen.getByText("Veritax UK Local File FY2024")).toBeInTheDocument();
    expect(screen.getByText("Group Master File FY2024")).toBeInTheDocument();
    expect(screen.getByText("local-file")).toBeInTheDocument();
    expect(screen.getByText("in-progress")).toBeInTheDocument();
    expect(screen.getByText(/3 changes/i)).toBeInTheDocument();
  });

  it("opens an assignment through the row action", async () => {
    const user = userEvent.setup();
    render(<ReviewQueueHarness />);

    await user.click(screen.getByRole("button", { name: /veritax uk local file fy2024/i }));

    expect(screen.getByText("Opened assignment: a1")).toBeInTheDocument();
  });
});

describe("SignCeremony", () => {
  it("requires attestation before sealing and then renders a manifest receipt", async () => {
    const user = userEvent.setup();
    render(<SignCeremonyHarness />);

    expect(screen.getByText("External Reviewer A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /seal.*sign|sign.*seal/i })).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /seal.*sign|sign.*seal/i }));

    expect(screen.getByText("Seal state: sealed")).toBeInTheDocument();
    expect(screen.getByTestId("manifest-receipt")).toBeInTheDocument();
  });
});

describe("HoursLog", () => {
  it("shows entries, total hours, and appends a manual hour entry", async () => {
    const user = userEvent.setup();
    render(<HoursLogHarness />);

    expect(screen.getByText("Veritax UK Local File FY2024")).toBeInTheDocument();
    expect(screen.getByText(/3\.5h/)).toBeInTheDocument();

    await user.type(screen.getByRole("spinbutton", { name: /hours/i }), "3");
    await user.click(screen.getByRole("button", { name: /log hours/i }));

    expect(screen.getByText("General review")).toBeInTheDocument();
    expect(screen.getByText(/6\.5h/)).toBeInTheDocument();
  });
});
