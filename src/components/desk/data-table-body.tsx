"use client";

import { useRouter } from "next/navigation";
import { shouldIgnoreRowClick } from "@/components/table-row-nav";

export type DataTableHeaderModel = {
  id: string;
  header: React.ReactNode;
  headerClassName?: string;
};

export type DataTableCellModel = {
  id: string;
  content: React.ReactNode;
  cellClassName?: string;
  stopRowClick?: boolean;
};

export type DataTableRowModel = {
  key: string;
  href?: string;
  cells: DataTableCellModel[];
};

export function DataTableBody({
  headers,
  tableRows,
}: {
  headers: DataTableHeaderModel[];
  tableRows: DataTableRowModel[];
}) {
  const router = useRouter();

  function navigate(href: string, event: React.MouseEvent<HTMLElement>) {
    if (shouldIgnoreRowClick(event.target as HTMLElement)) return;
    router.push(href);
  }

  return (
    <div>
      <div className="space-y-3 md:hidden">
        {tableRows.map((row) => (
          <article
            key={row.key}
            role={row.href ? "link" : undefined}
            tabIndex={row.href ? 0 : undefined}
            onClick={row.href ? (e) => navigate(row.href!, e) : undefined}
            onKeyDown={
              row.href
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(row.href!);
                    }
                  }
                : undefined
            }
            className={`rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 ${row.href ? "cursor-pointer transition hover:border-[var(--accent)]/30" : ""}`}
          >
            {row.cells.map((cell, index) => {
              const header = headers[index];
              return (
                <div
                  key={cell.id}
                  className="flex items-start justify-between gap-3 py-1.5"
                  {...(cell.stopRowClick ? { "data-row-action": true } : {})}
                >
                  {header?.header ? (
                    <span className="text-xs font-medium text-[var(--ink-muted)]">{header.header}</span>
                  ) : null}
                  <div className={`min-w-0 text-[var(--ink)] ${header?.header ? "text-right" : ""}`}>{cell.content}</div>
                </div>
              );
            })}
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-[14px] border border-[var(--border)] bg-[var(--surface)] md:block">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)] text-left">
            <tr>
              {headers.map((column) => (
                <th
                  key={column.id}
                  className={`px-4 py-3 text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)] ${column.headerClassName ?? ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr
                key={row.key}
                onClick={row.href ? (e) => navigate(row.href!, e) : undefined}
                className={`border-t border-[var(--border)] transition hover:bg-[var(--bg)]/80 ${row.href ? "cursor-pointer" : ""}`}
              >
                {row.cells.map((cell) => (
                  <td
                    key={cell.id}
                    className={`px-4 py-3.5 align-middle text-[var(--ink)] ${cell.cellClassName ?? ""}`}
                    {...(cell.stopRowClick ? { "data-row-action": true } : {})}
                  >
                    {cell.content}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
