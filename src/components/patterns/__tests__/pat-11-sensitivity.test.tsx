import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SensitivityChip, SensitivityNotice, VaultLockedEntry } from "../pat-11-sensitivity";

describe("SensitivityChip", () => {
  it("renders the tier label", () => {
    render(<SensitivityChip tier="sensitive" />);
    expect(screen.getByText(/sensitive/i)).toBeInTheDocument();
  });

  it("renders privileged tier in red", () => {
    render(<SensitivityChip tier="privileged" />);
    const chip = screen.getByText(/privileged/i);
    expect(chip).toBeInTheDocument();
  });

  it("does not render for standard tier", () => {
    const { container } = render(<SensitivityChip tier="standard" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("SensitivityNotice", () => {
  it("shows a views-are-logged banner", () => {
    render(<SensitivityNotice tier="sensitive" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/views are logged/i)).toBeInTheDocument();
  });
});

describe("VaultLockedEntry", () => {
  it("renders a lock icon and label without revealing any content", () => {
    render(<VaultLockedEntry label="Privileged memo — FY2024" />);
    expect(screen.getByText("Privileged memo — FY2024")).toBeInTheDocument();
    expect(screen.getByLabelText(/locked/i)).toBeInTheDocument();
  });

  it("shows contact-counsel action", () => {
    render(<VaultLockedEntry label="Privileged memo — FY2024" />);
    expect(screen.getByRole("button", { name: /contact counsel/i })).toBeInTheDocument();
  });

  it("never renders a content preview slot", () => {
    render(<VaultLockedEntry label="Privileged memo — FY2024" />);
    expect(screen.queryByTestId("content-preview")).not.toBeInTheDocument();
  });
});
