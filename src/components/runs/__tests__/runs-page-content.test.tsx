import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RunsPageContent } from "../runs-page-content";

describe("RunsPageContent", () => {
  it("filters runs and opens a drawer with pinned versions and trace details", async () => {
    const user = userEvent.setup();
    render(<RunsPageContent />);

    await user.selectOptions(screen.getByLabelText(/status/i), "failed");

    expect(screen.getByRole("button", { name: /benchmark-refresh/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ic-scan/i })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/status/i), "all");
    await user.click(screen.getByRole("button", { name: /ic-scan/i }));

    const drawer = screen.getByRole("complementary", { name: /run details/i });
    expect(within(drawer).getByText(/corpus v\.418/i)).toBeInTheDocument();
    expect(within(drawer).getByText(/rules rp-2024\.11/i)).toBeInTheDocument();
    expect(within(drawer).getByText(/model claude-sonnet-4-6/i)).toBeInTheDocument();

    await user.click(within(drawer).getByRole("button", { name: /trace extract ic flows/i }));
    expect(within(drawer).getByText(/agreement-reader/i)).toBeInTheDocument();
    expect(within(drawer).getByText(/flow-normalizer/i)).toBeInTheDocument();
  });

  it("reviews staged output and creates an edited rerun from the drawer", async () => {
    const user = userEvent.setup();
    render(<RunsPageContent />);

    await user.click(screen.getByRole("button", { name: /local-file-generate/i }));

    const drawer = screen.getByRole("complementary", { name: /run details/i });
    await user.click(within(drawer).getByRole("button", { name: /approve and promote Veritax UK Local File FY2024 v2/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/output promoted to the record/i);
    expect(within(drawer).getByText(/promoted/i)).toBeInTheDocument();

    await user.click(within(drawer).getByRole("button", { name: /re-run with edits/i }));
    await user.type(within(drawer).getByLabelText(/edit instructions/i), "Limit the run to UK DEMPE citations and keep stale assumptions out.");
    await user.click(within(drawer).getByRole("button", { name: /run edited rerun/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/edited rerun queued/i);
    expect(screen.getByRole("button", { name: /local-file-generate edited rerun/i })).toBeInTheDocument();
  });

  it("cancels an active run and manages scheduled watchers", async () => {
    const user = userEvent.setup();
    render(<RunsPageContent />);

    await user.selectOptions(screen.getByLabelText(/status/i), "running");
    await user.click(screen.getByRole("button", { name: /range-retest/i }));

    await user.click(screen.getByRole("button", { name: /cancel run/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/range-retest cancelled/i);
    expect(
      within(screen.getByRole("complementary", { name: /run details/i })).getByText(/^cancelled$/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /scheduled watchers/i }));

    const watcher = screen.getByRole("article", { name: /benchmark refresh watcher/i });
    await user.click(within(watcher).getByRole("button", { name: /pause watcher/i }));
    expect(within(watcher).getByText(/paused/i)).toBeInTheDocument();

    await user.click(within(watcher).getByRole("button", { name: /edit scope/i }));
    await user.clear(within(watcher).getByLabelText(/watcher scope/i));
    await user.type(within(watcher).getByLabelText(/watcher scope/i), "CUT comparables - UK royalty only");
    await user.click(within(watcher).getByRole("button", { name: /save watcher scope/i }));

    expect(screen.getByRole("status")).toHaveTextContent(/watcher scope updated/i);
    expect(within(watcher).getByText(/CUT comparables - UK royalty only/i)).toBeInTheDocument();
  });
});
