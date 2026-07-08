import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AuditorRoomContent } from "../auditor-room-content";

describe("AuditorRoomContent", () => {
  it("opens a watermarked read-only artifact and records the view", async () => {
    const user = userEvent.setup();
    render(<AuditorRoomContent />);

    expect(screen.getByRole("alert")).toHaveTextContent(/views are logged/i);
    await user.click(screen.getByRole("button", { name: /veritax uk local file fy2024/i }));

    expect(screen.getByRole("heading", { name: /watermarked viewer/i })).toBeInTheDocument();
    expect(screen.getAllByText(/veritax uk local file fy2024/i).length).toBeGreaterThan(1);
    expect(screen.getAllByText(/watermark applied/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/access events: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/opened veritax uk local file fy2024/i)).toBeInTheDocument();
  });

  it("keeps the evidence room free of mutation controls", () => {
    render(<AuditorRoomContent />);

    expect(screen.queryByRole("button", { name: /edit|delete|upload|submit/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/read-only/i).length).toBeGreaterThan(0);
  });
});
