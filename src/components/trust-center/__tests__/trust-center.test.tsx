import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrustCenterPublisher } from "../trust-center-publisher";

const items = [
  { id: "residency",    label: "Data residency",       description: "All data stored in EU/US regions only.", status: "published" as const, lastUpdated: "2025-11-01" },
  { id: "encryption",  label: "Encryption at rest",   description: "AES-256 encryption on all stored data.", status: "published" as const, lastUpdated: "2025-11-01" },
  { id: "audit-log",   label: "Audit-log retention",  description: "Audit logs retained for 7 years.",        status: "draft" as const,     lastUpdated: "2025-11-10" },
  { id: "soc2",        label: "SOC 2 Type II status",  description: "Certified annually by external auditor.",status: "draft" as const,     lastUpdated: "2025-11-10" },
];

describe("TrustCenterPublisher", () => {
  it("renders all policy items with labels", () => {
    render(<TrustCenterPublisher items={items} onPublish={vi.fn()} onRetract={vi.fn()} />);
    expect(screen.getByText("Data residency")).toBeInTheDocument();
    expect(screen.getByText("Encryption at rest")).toBeInTheDocument();
    expect(screen.getByText("SOC 2 Type II status")).toBeInTheDocument();
  });

  it("shows published/draft status chips", () => {
    render(<TrustCenterPublisher items={items} onPublish={vi.fn()} onRetract={vi.fn()} />);
    expect(screen.getAllByText("published").length).toBeGreaterThan(0);
    expect(screen.getAllByText("draft").length).toBeGreaterThan(0);
  });

  it("shows Publish button for draft items", () => {
    render(<TrustCenterPublisher items={items} onPublish={vi.fn()} onRetract={vi.fn()} />);
    const publishBtns = screen.getAllByRole("button", { name: /^publish$/i });
    expect(publishBtns.length).toBe(items.filter((i) => i.status === "draft").length);
  });

  it("shows Retract button for published items", () => {
    render(<TrustCenterPublisher items={items} onPublish={vi.fn()} onRetract={vi.fn()} />);
    const retractBtns = screen.getAllByRole("button", { name: /retract/i });
    expect(retractBtns.length).toBe(items.filter((i) => i.status === "published").length);
  });

  it("calls onPublish with item id when Publish clicked", async () => {
    const onPublish = vi.fn();
    render(<TrustCenterPublisher items={items} onPublish={onPublish} onRetract={vi.fn()} />);
    const publishBtns = screen.getAllByRole("button", { name: /^publish$/i });
    await userEvent.click(publishBtns[0]);
    expect(onPublish).toHaveBeenCalledWith("audit-log");
  });

  it("calls onRetract with item id when Retract clicked", async () => {
    const onRetract = vi.fn();
    render(<TrustCenterPublisher items={items} onPublish={vi.fn()} onRetract={onRetract} />);
    const retractBtns = screen.getAllByRole("button", { name: /retract/i });
    await userEvent.click(retractBtns[0]);
    expect(onRetract).toHaveBeenCalledWith("residency");
  });

  it("updates status optimistically after Publish", async () => {
    render(<TrustCenterPublisher items={items} onPublish={vi.fn()} onRetract={vi.fn()} />);
    const publishBtns = screen.getAllByRole("button", { name: /^publish$/i });
    await userEvent.click(publishBtns[0]);
    // After publish, the item should show "published"
    const publishedChips = screen.getAllByText("published");
    expect(publishedChips.length).toBeGreaterThan(items.filter((i) => i.status === "published").length);
  });

  it("renders description for each item", () => {
    render(<TrustCenterPublisher items={items} onPublish={vi.fn()} onRetract={vi.fn()} />);
    expect(screen.getByText("AES-256 encryption on all stored data.")).toBeInTheDocument();
  });
});
