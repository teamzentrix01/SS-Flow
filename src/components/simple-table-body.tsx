"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { shouldIgnoreRowClick } from "@/components/table-row-nav";

export function SimpleTableBody({
  columns,
  rows,
  rowHrefs,
  rowKeys,
  stopClickColumnIndexes,
}: {
  columns: string[];
  rows: ReactNode[][];
  rowHrefs?: (string | undefined)[];
  rowKeys?: string[];
  stopClickColumnIndexes?: number[];
}) {
  const router = useRouter();
  const stopColumns = new Set(stopClickColumnIndexes ?? []);

  function navigate(href: string, event: React.MouseEvent<HTMLElement>) {
    if (shouldIgnoreRowClick(event.target as HTMLElement)) return;
    router.push(href);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="min-w-full text-sm">
        <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const href = rowHrefs?.[index];
            return (
              <tr
                key={rowKeys?.[index] ?? index}
                onClick={href ? (event) => navigate(href, event) : undefined}
                className={`border-t border-border transition hover:bg-accent-soft ${href ? "cursor-pointer" : ""}`}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-4 py-3.5 align-middle"
                    {...(stopColumns.has(cellIndex) ? { "data-row-action": true } : {})}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
