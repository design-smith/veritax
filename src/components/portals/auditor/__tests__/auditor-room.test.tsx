import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditorRoom } from "../auditor-room";

const artifacts = [
  { id: "a1", name: "Veritax UK Local File FY2024", type: "local-file" as const, provisionPeriod: "FY2024 Q4", expiresAt: "2026-03-31", hash: "sha256:a1b2c3" },
  { id: "a2", name: "Group Master File FY2024",     type: "master-file" as const, provisionPeriod: "FY2024 Q4", expiresAt: "2026-03-31", hash: "sha256:d4e5f6" },
  { id: "a3", name: "Benchmark Study FY2022",       type: "benchmark" as const,   provisionPeriod: "FY2024 Q4", expiresAt: "2025-06-30", hash: "sha256:g7h8i9" },
];

describe("AuditorRoom", () => {
  it("renders artifact list for the provision period", () => {
    render(<AuditorRoom artifacts={artifacts} provisionPeriod="FY2024 Q4" expiresAt="2026-03-31" />);
    expect(screen.getByText("Veritax UK Local File FY2024")).toBeInTheDocument();
    expect(screen.getByText("Group Master File FY2024")).toBeInTheDocument();
  });

  it("shows the every-open logged notice banner", () => {
    render(<AuditorRoom artifacts={artifacts} provisionPeriod="FY2024 Q4" expiresAt="2026-03-31" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getAllByText(/views.*logged|access.*recorded/i).length).toBeGreaterThan(0);
  });

  it("shows a watermark notice on each artifact row", () => {
    render(<AuditorRoom artifacts={artifacts} provisionPeriod="FY2024 Q4" expiresAt="2026-03-31" />);
    expect(screen.getAllByText(/watermark|draft — not for reliance/i).length).toBeGreaterThan(0);
  });

  it("shows an expiry countdown banner", () => {
    render(<AuditorRoom artifacts={artifacts} provisionPeriod="FY2024 Q4" expiresAt="2026-03-31" />);
    expect(screen.getByText(/access expires|expiry/i)).toBeInTheDocument();
  });

  it("renders zero mutation controls — no edit, delete, or upload buttons", () => {
    render(<AuditorRoom artifacts={artifacts} provisionPeriod="FY2024 Q4" expiresAt="2026-03-31" />);
    expect(screen.queryByRole("button", { name: /edit|delete|upload|submit/i })).not.toBeInTheDocument();
  });

  it("shows the provision period label", () => {
    render(<AuditorRoom artifacts={artifacts} provisionPeriod="FY2024 Q4" expiresAt="2026-03-31" />);
    expect(screen.getByText("FY2024 Q4")).toBeInTheDocument();
  });

  it("shows hash for each artifact", () => {
    render(<AuditorRoom artifacts={artifacts} provisionPeriod="FY2024 Q4" expiresAt="2026-03-31" />);
    expect(screen.getByText(/sha256:a1b2/)).toBeInTheDocument();
  });

  it("renders a type badge on each artifact row", () => {
    render(<AuditorRoom artifacts={artifacts} provisionPeriod="FY2024 Q4" expiresAt="2026-03-31" />);
    expect(screen.getByText("local-file")).toBeInTheDocument();
    expect(screen.getByText("master-file")).toBeInTheDocument();
  });
});
