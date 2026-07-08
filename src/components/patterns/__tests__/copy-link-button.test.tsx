import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CopyLinkButton } from "../copy-link-button";

describe("CopyLinkButton", () => {
  it("copies a canonical absolute URL and confirms the action", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <CopyLinkButton
        target={{ type: "finding", id: "finding-1" }}
        origin="https://app.veritax.test"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /copy link/i }));

    expect(writeText).toHaveBeenCalledWith("https://app.veritax.test/findings/finding-1");
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });
});
