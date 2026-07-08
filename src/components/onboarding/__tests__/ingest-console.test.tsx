import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { IngestConsole } from "../ingest-console";

const counters = {
  docsTotal: 24,
  docsByType: { "local-file": 8, "master-file": 2, ica: 6, other: 8 },
  entitiesDiscovered: 6,
  agreementsFound: 8,
};

const streamItems = [
  { id: "s1", name: "Veritax UK Local File FY2024.pdf", type: "local-file" as const },
  { id: "s2", name: "IC Royalty Agreement US-UK.pdf", type: "ica" as const },
  { id: "s3", name: "TP Policy FY2024.docx", type: "master-file" as const },
];

const problemItems = [
  { id: "p1", name: "corrupt-file.pdf", issue: "unreadable" as const },
  { id: "p2", name: "duplicate-policy.pdf", issue: "duplicate" as const },
];

function IngestHarness({
  initialProblems = problemItems,
}: {
  initialProblems?: typeof problemItems;
}) {
  const [visibleProblems, setVisibleProblems] = useState(initialProblems);
  const [latestFix, setLatestFix] = useState("none");
  const [continued, setContinued] = useState(false);

  return (
    <>
      <IngestConsole
        counters={counters}
        streamItems={streamItems}
        problemItems={visibleProblems}
        onContinue={() => setContinued(true)}
        onFixProblem={(itemId, action) => {
          setVisibleProblems((current) => current.filter((item) => item.id !== itemId));
          setLatestFix(`${itemId}:${action}`);
        }}
      />
      <p>Latest fix: {latestFix}</p>
      <p>Ingest continued: {continued ? "yes" : "no"}</p>
    </>
  );
}

describe("IngestConsole", () => {
  it("shows the ingest counters and classification stream", () => {
    render(<IngestHarness initialProblems={[]} />);

    expect(screen.getByTestId("counter-docs")).toHaveTextContent("24");
    expect(screen.getByTestId("counter-entities")).toHaveTextContent("6");
    expect(screen.getByTestId("counter-agreements")).toHaveTextContent("8");
    expect(screen.getByText("Veritax UK Local File FY2024.pdf")).toBeInTheDocument();
    expect(screen.getByText("IC Royalty Agreement US-UK.pdf")).toBeInTheDocument();
    expect(screen.getByText(/No problems.*all documents processed cleanly/i)).toBeInTheDocument();
  });

  it("shows the problem pile with issue labels", () => {
    render(<IngestHarness />);

    expect(screen.getByText("corrupt-file.pdf")).toBeInTheDocument();
    expect(screen.getByText("duplicate-policy.pdf")).toBeInTheDocument();
    expect(screen.getByText("unreadable")).toBeInTheDocument();
    expect(screen.getByText("duplicate")).toBeInTheDocument();
  });

  it("resolves a problem through the visible action controls", async () => {
    const user = userEvent.setup();
    render(<IngestHarness />);

    await user.click(screen.getByRole("button", { name: /retry/i }));

    expect(screen.getByText("Latest fix: p1:retry")).toBeInTheDocument();
    expect(screen.queryByText("corrupt-file.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("duplicate-policy.pdf")).toBeInTheDocument();
  });

  it("continues to Teach through the public continue action", async () => {
    const user = userEvent.setup();
    render(<IngestHarness initialProblems={[]} />);

    await user.click(screen.getByRole("button", { name: /continue.*teach/i }));

    expect(screen.getByText("Ingest continued: yes")).toBeInTheDocument();
  });
});
