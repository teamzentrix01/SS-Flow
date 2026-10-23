import Link from "next/link";
import { SimpleTableBody } from "@/components/simple-table-body";

export { Button, Field, controlClass } from "@/components/form-controls";

export function PageHeader({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {detail ? <p className="mt-1 max-w-2xl text-sm text-muted">{detail}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

export function TextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="cursor-pointer font-medium text-accent transition hover:text-accent-hover hover:underline">
      {children}
    </Link>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <p className="text-base font-semibold">{title}</p>
      {detail ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{detail}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "card",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "lime" | "periwinkle" | "coral" | "card";
}) {
  const toneClass =
    "border border-border bg-card shadow-sm transition hover:border-accent/35 hover:bg-accent-soft/40";
  return (
    <article className={`rounded-2xl p-4 ${toneClass}`}>
      <p
        className={`text-sm font-medium ${tone === "card" ? "text-muted" : ""}`}
      >
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {detail ? (
        <p
          className={`mt-1 text-xs ${tone === "card" ? "text-muted" : "opacity-80"}`}
        >
          {detail}
        </p>
      ) : null}
    </article>
  );
}

export function SimpleTable({
  columns,
  rows,
  rowHrefs,
  rowKeys,
  stopClickColumnIndexes,
  emptyTitle = "Nothing to show yet",
  emptyDetail,
  emptyAction,
}: {
  columns: string[];
  rows: React.ReactNode[][];
  /** When set, clicking the row opens this href (same index as `rows`). */
  rowHrefs?: (string | undefined)[];
  rowKeys?: string[];
  /** Column indexes that should not trigger row navigation (e.g. action buttons). */
  stopClickColumnIndexes?: number[];
  emptyTitle?: string;
  emptyDetail?: string;
  emptyAction?: React.ReactNode;
}) {
  if (!rows.length)
    return (
      <EmptyState
        title={emptyTitle}
        detail={emptyDetail}
        action={emptyAction}
      />
    );
  return (
    <SimpleTableBody
      columns={columns}
      rows={rows}
      rowHrefs={rowHrefs}
      rowKeys={rowKeys}
      stopClickColumnIndexes={stopClickColumnIndexes}
    />
  );
}
