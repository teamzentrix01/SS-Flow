import Link from "next/link";

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
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[1.7rem] font-semibold tracking-tight">{title}</h1>
        {detail ? <p className="mt-1 text-sm text-muted">{detail}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  pending,
  tone = "primary",
  type = "submit",
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  pending?: boolean;
  tone?: "primary" | "ghost" | "danger";
  type?: "submit" | "button";
  onClick?: () => void;
  className?: string;
}) {
  const toneClass =
    tone === "primary"
      ? "btn-primary"
      : tone === "danger"
        ? "h-11 rounded-[10px] bg-[#c43b32] px-4 text-sm font-semibold text-white hover:opacity-90"
        : "h-11 rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-accent-soft hover:border-accent/30";
  return (
    <button
      type={type}
      disabled={pending}
      onClick={onClick}
      className={`inline-flex items-center justify-center disabled:opacity-60 ${toneClass} ${className}`}
    >
      {pending ? "Saving…" : children}
    </button>
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
    <Link href={href} className="font-medium text-accent transition hover:text-accent-hover hover:underline">
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
  emptyTitle = "Nothing to show yet",
  emptyDetail,
  emptyAction,
}: {
  columns: string[];
  rows: React.ReactNode[][];
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
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-t border-border transition hover:bg-accent-soft"
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3.5 align-middle">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">
        {label}
        {required ? <span className="ml-1 text-danger" aria-hidden="true">*</span> : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </span>
      {children}
    </label>
  );
}

export const controlClass =
  "h-11 w-full rounded-[10px] border border-border bg-card px-3 text-foreground outline-none transition focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25";
