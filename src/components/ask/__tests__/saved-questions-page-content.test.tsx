import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SavedQuestionsPageContent } from "../saved-questions-page-content";

describe("SavedQuestionsPageContent", () => {
  it("manages saved question monitoring, re-ask, brief, scope, share, and new question flow", async () => {
    const user = userEvent.setup();
    render(<SavedQuestionsPageContent />);

    expect(screen.getByRole("columnheader", { name: /question/i })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /What is the royalty rate for Veritax UK Ltd/i })).toHaveTextContent(
      /answer changed/i,
    );

    const franceRow = screen.getByRole("row", { name: /France commissionnaire agreement/i });
    await user.click(within(franceRow).getByRole("switch", { name: /monitor saved question/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/monitoring turned on/i);
    expect(franceRow).toHaveTextContent(/monitored/i);

    await user.click(within(franceRow).getByRole("button", { name: /re-ask/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/question re-asked/i);
    expect(franceRow).toHaveTextContent(/just now/i);

    await user.click(within(franceRow).getByRole("button", { name: /open last brief/i }));
    expect(screen.getByRole("region", { name: /last answer brief/i })).toHaveTextContent(/France commissionnaire/i);

    await user.click(within(franceRow).getByRole("button", { name: /edit scope/i }));
    const scopePanel = screen.getByRole("region", { name: /edit question scope/i });
    await user.clear(within(scopePanel).getByLabelText(/^question scope$/i));
    await user.type(within(scopePanel).getByLabelText(/^question scope$/i), "France agreements and renewal gates");
    await user.click(screen.getByRole("button", { name: /save scope/i }));
    expect(franceRow).toHaveTextContent(/France agreements and renewal gates/i);

    await user.click(within(franceRow).getByRole("button", { name: /share/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/share link copied/i);
    expect(screen.getByRole("region", { name: /share link/i })).toHaveTextContent(/\/ask\/saved\?question=q2/i);

    await user.click(screen.getByRole("button", { name: /new question/i }));
    const newQuestionPanel = screen.getByRole("region", { name: /new saved question/i });
    await user.type(within(newQuestionPanel).getByLabelText(/^saved question$/i), "Which flows need fresh benchmark support?");
    await user.type(within(newQuestionPanel).getByLabelText(/^saved question scope$/i), "Royalty flows FY2024");
    await user.click(screen.getByRole("button", { name: /save question/i }));
    expect(screen.getByRole("row", { name: /Which flows need fresh benchmark support/i })).toBeInTheDocument();
  });
});
