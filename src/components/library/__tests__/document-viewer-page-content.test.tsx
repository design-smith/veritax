import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DocumentViewerPageContent } from "../document-viewer-page-content";
import { mockDocuments, mockFindings, mockUsers } from "@/lib/mock";

describe("DocumentViewerPageContent", () => {
  it("opens anchored spans, navigates anchors, and keeps return context visible", async () => {
    const user = userEvent.setup();
    render(
      <DocumentViewerPageContent
        document={mockDocuments[1]}
        users={mockUsers}
        findings={mockFindings}
        originLabel="Finding fn1"
        initialAnchorId="royalty-rate"
      />,
    );

    expect(screen.getByRole("button", { name: /return to finding fn1/i })).toBeInTheDocument();
    expect(screen.getByTestId("span-royalty-rate")).toHaveClass("highlighted");
    expect(screen.getByText(/anchor 1\/3/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next anchor/i }));
    expect(screen.getByTestId("span-policy-rate")).toHaveClass("highlighted");
  });

  it("supports reference drift refetch, extraction correction, versions, mentions, and comments", async () => {
    const user = userEvent.setup();
    render(
      <DocumentViewerPageContent
        document={mockDocuments[4]}
        users={mockUsers}
        findings={mockFindings}
        originLabel="Library"
        initialAnchorId="benchmark-range"
      />,
    );

    expect(screen.getByText(/reference-custody drift detected/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /re-fetch and flag/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/refetch run created/i);

    await user.click(screen.getByRole("tab", { name: /extractions/i }));
    await user.click(screen.getAllByRole("button", { name: /correct/i })[0]);
    await user.type(screen.getByLabelText(/verification answer/i), "Use the interquartile range from the executed benchmark support.");
    await user.click(screen.getByRole("button", { name: /submit correction/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/verification answer recorded/i);

    await user.click(screen.getByRole("tab", { name: /versions/i }));
    expect(screen.getByText(/executed/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /v1/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/version v1 selected/i);

    await user.click(screen.getByRole("tab", { name: /mentions/i }));
    expect(screen.getByText(/UK royalty rate exceeds benchmark/i)).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /comments/i }));
    await user.type(screen.getByPlaceholderText(/add a comment/i), "Confirm benchmark license before export.");
    await user.click(screen.getByRole("button", { name: /post/i }));
    expect(screen.getByText("Confirm benchmark license before export.")).toBeInTheDocument();
  });
});
