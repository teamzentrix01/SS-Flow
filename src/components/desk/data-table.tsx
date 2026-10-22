import { EmptyState } from "@/components/ui";
import { DataTableBody } from "@/components/desk/data-table-body";

export type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  /** Clicks in this column do not trigger row navigation. */
  stopRowClick?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  getRowHref,
  emptyTitle = "Nothing to show yet",
  emptyDetail,
  emptyAction,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  getRowHref?: (row: T) => string | undefined;
  emptyTitle?: string;
  emptyDetail?: string;
  emptyAction?: React.ReactNode;
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} detail={emptyDetail} action={emptyAction} />;
  }

  const headers = columns.map((column) => ({
    id: column.id,
    header: column.header,
    headerClassName: column.headerClassName,
  }));

  const tableRows = rows.map((row) => ({
    key: getRowKey(row),
    href: getRowHref?.(row),
    cells: columns.map((column) => ({
      id: column.id,
      content: column.cell(row),
      cellClassName: column.cellClassName,
      stopRowClick: column.stopRowClick,
    })),
  }));

  return <DataTableBody headers={headers} tableRows={tableRows} />;
}
