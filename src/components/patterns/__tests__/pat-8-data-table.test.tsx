import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable } from "../pat-8-data-table";
import type { Column } from "../pat-8-data-table";
import { mockFindings } from "@/lib/mock";

type Row = { id: string; title: string; severity: string; status: string };

const columns: Column<Row>[] = [
  { key: "id", header: "ID", render: (r) => r.id },
  { key: "title", header: "Title", render: (r) => r.title, sortable: true },
  { key: "severity", header: "Severity", render: (r) => r.severity, sortable: true },
  { key: "status", header: "Status", render: (r) => r.status },
];

const rows: Row[] = mockFindings.slice(0, 5).map((f) => ({
  id: f.id,
  title: f.title,
  severity: f.severity,
  status: f.status,
}));

describe("DataTable", () => {
  it("renders all rows and column headers", () => {
    render(<DataTable columns={columns} data={rows} />);
    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Severity")).toBeInTheDocument();
    rows.forEach((r) => {
      expect(screen.getByText(r.id)).toBeInTheDocument();
    });
  });

  it("sorts by column when header clicked", async () => {
    render(<DataTable columns={columns} data={rows} />);
    await userEvent.click(screen.getByRole("button", { name: /sort by severity/i }));
    const cells = screen.getAllByTestId("cell-severity");
    const vals = cells.map((c) => c.textContent ?? "");
    expect(vals).toEqual([...vals].sort());
  });

  it("selects a row when checkbox clicked and shows bulk action bar", async () => {
    const onRowSelect = vi.fn();
    render(<DataTable columns={columns} data={rows} onRowSelect={onRowSelect} />);
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]); // first data row
    expect(onRowSelect).toHaveBeenCalledWith([rows[0]]);
    expect(screen.getByRole("region", { name: /bulk actions/i })).toBeInTheDocument();
  });

  it("hides bulk bar when no rows selected", () => {
    render(<DataTable columns={columns} data={rows} />);
    expect(screen.queryByRole("region", { name: /bulk actions/i })).not.toBeInTheDocument();
  });

  it("calls onRowOpen when row is clicked", async () => {
    const onRowOpen = vi.fn();
    render(<DataTable columns={columns} data={rows} onRowOpen={onRowOpen} />);
    await userEvent.click(screen.getByText(rows[0].id));
    expect(onRowOpen).toHaveBeenCalledWith(rows[0]);
  });

  it("renders empty state when no data", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        emptyState={<p>No findings yet</p>}
      />
    );
    expect(screen.getByText("No findings yet")).toBeInTheDocument();
  });

  it("j/k keyboard moves focus between rows", async () => {
    render(<DataTable columns={columns} data={rows} />);
    const table = screen.getByRole("table");
    table.focus();
    fireEvent.keyDown(table, { key: "j" });
    expect(screen.getByTestId(`row-${rows[0].id}`)).toHaveClass("focused");
    fireEvent.keyDown(table, { key: "j" });
    expect(screen.getByTestId(`row-${rows[1].id}`)).toHaveClass("focused");
    fireEvent.keyDown(table, { key: "k" });
    expect(screen.getByTestId(`row-${rows[0].id}`)).toHaveClass("focused");
  });

  it("filters rows and restores the filter from a saved view", async () => {
    const localRows: Row[] = [
      { id: "r1", title: "Royalty benchmark finding", severity: "high", status: "detected" },
      { id: "r2", title: "Services agreement review", severity: "low", status: "reviewed" },
    ];

    render(
      <DataTable
        columns={columns}
        data={localRows}
        enableFiltering
        enableSavedViews
      />,
    );

    await userEvent.type(screen.getByLabelText(/filter table/i), "royalty");

    expect(screen.getByTestId("row-r1")).toBeInTheDocument();
    expect(screen.queryByTestId("row-r2")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /save view/i }));
    await userEvent.clear(screen.getByLabelText(/filter table/i));
    expect(screen.getByTestId("row-r2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /view 1/i }));
    expect(screen.getByTestId("row-r1")).toBeInTheDocument();
    expect(screen.queryByTestId("row-r2")).not.toBeInTheDocument();
  });

  it("uses table keyboard shortcuts for edit, comment, and jump", async () => {
    function TableShortcutHarness() {
      const [lastAction, setLastAction] = useState("No action");

      return (
        <>
          <DataTable
            columns={columns}
            data={rows}
            onRowEdit={(row) => setLastAction(`edit ${row.id}`)}
            onRowComment={(row) => setLastAction(`comment ${row.id}`)}
            onRowJump={(row) => setLastAction(`jump ${row.id}`)}
          />
          <p aria-label="table action">{lastAction}</p>
        </>
      );
    }

    render(<TableShortcutHarness />);

    const table = screen.getByRole("table");
    table.focus();
    fireEvent.keyDown(table, { key: "j" });
    fireEvent.keyDown(table, { key: "e" });
    expect(screen.getByLabelText("table action")).toHaveTextContent(`edit ${rows[0].id}`);

    fireEvent.keyDown(table, { key: "c" });
    expect(screen.getByLabelText("table action")).toHaveTextContent(`comment ${rows[0].id}`);

    fireEvent.keyDown(table, { key: "g" });
    expect(screen.getByLabelText("table action")).toHaveTextContent(`jump ${rows[0].id}`);
  });
});
