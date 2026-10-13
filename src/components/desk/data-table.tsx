import { EmptyState } from "@/components/ui";

export type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyTitle = "Nothing to show yet",
  emptyDetail,
  emptyAction,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDetail?: string;
  emptyAction?: React.ReactNode;
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} detail={emptyDetail} action={emptyAction} />;
  }
  return (
    <div>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article key={getRowKey(row)} className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
            {columns.map((column) => (
              <div key={column.id} className="flex items-start justify-between gap-3 py-1.5">
                {column.header ? <span className="text-xs font-medium text-[var(--ink-muted)]">{column.header}</span> : null}
                <div className={`min-w-0 text-[var(--ink)] ${column.header ? "text-right" : ""}`}>{column.cell(row)}</div>
              </div>
            ))}
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-[14px] border border-[var(--border)] bg-[var(--surface)] md:block">
      <table className="min-w-full text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--bg)] text-left">
          <tr>
            {columns.map((column) => (
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
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-t border-[var(--border)] transition hover:bg-[var(--bg)]/80">
              {columns.map((column) => (
                <td key={column.id} className={`px-4 py-3.5 align-middle text-[var(--ink)] ${column.cellClassName ?? ""}`}>
                  {column.cell(row)}
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
