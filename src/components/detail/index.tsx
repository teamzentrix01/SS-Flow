import Link from "next/link";
import { Check } from "lucide-react";
import { labelFor, when } from "@/lib/format";

const cardClass = "overflow-hidden rounded-[14px] border border-[var(--detail-border)] bg-[var(--surface)] shadow-sm";

export function PageHeader({
  breadcrumb,
  title,
  status,
  source,
  meta,
  action,
}: {
  breadcrumb: string;
  title: string;
  status: string;
  source?: string | null;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="mb-1 text-[11px] text-[var(--detail-muted)]">{breadcrumb}</p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[25px] font-bold leading-tight tracking-tight text-[var(--detail-text)]">{title}</h1>
          <StatusBadge status={status} />
          {source ? <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-muted)]">{labelFor(source)}</span> : null}
        </div>
        {meta ? <p className="mt-1 text-[11px] text-[var(--detail-muted)]">{meta}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

function statusTone(status: string) {
  const value = status.toLowerCase().replaceAll(" ", "_");
  if (["converted", "completed", "active", "approved", "closed", "fulfilled"].includes(value)) return "success";
  if (["new", "submitted", "contacted", "in_progress"].includes(value)) return "info";
  if (["pending", "pending_approval", "on_hold", "hold"].includes(value)) return "warning";
  if (value === "verified") return "warning";
  if (["rejected", "failed", "cancelled", "lost"].includes(value)) return "danger";
  return "neutral";
}

const statusStyles = {
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-neutral-soft text-neutral",
} as const;

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const value = status?.trim() || "—";
  const tone = statusTone(value);
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusStyles[tone]}`}>
    <span aria-hidden="true" className={`size-1.5 rounded-full bg-current`} />{labelFor(value)}
  </span>;
}

export type WorkflowStep = { name: string; date?: Date | string | null; note?: string | null };

export function ProgressStepper({ steps }: { steps: WorkflowStep[] }) {
  if (!steps.length) return null;
  return <section aria-label="Lead progress" className={`${cardClass} px-4 py-3`}>
    <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((step, index) => <li key={`${step.name}-${index}`} className="relative min-w-0 text-center">
        {index < steps.length - 1 ? <span aria-hidden="true" className="absolute left-1/2 right-[-50%] top-[7px] h-px bg-success" /> : null}
        <span className="relative mx-auto grid size-4 place-items-center rounded-full bg-success text-white"><Check size={10} strokeWidth={3} /></span>
        <p className="mt-1 text-[11px] font-bold capitalize text-[var(--detail-text)]">{labelFor(step.name)}</p>
        <p className="text-[9px] text-[var(--detail-muted)]">{step.date ? when(step.date) : "—"}</p>
        {step.note ? <p className="truncate px-1 text-[9px] text-[var(--detail-muted)]">{step.note}</p> : null}
      </li>)}
    </ol>
  </section>;
}

export function SectionCard({ title, count, action, children, className = "" }: {
  title: string; count?: number; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return <section className={`${cardClass} ${className}`}>
    <div className="flex min-h-10 items-center justify-between border-b border-[var(--detail-border)] px-4 py-2">
      <h2 className="text-[12px] font-bold text-[var(--detail-text)]">{title}{count !== undefined ? <span className="ml-1 font-normal text-[var(--detail-muted)]">({count})</span> : null}</h2>
      {action ? <div>{action}</div> : null}
    </div>
    <div className="p-4">{children}</div>
  </section>;
}

export function FieldGrid({ fields, columns = 2 }: { fields: { label: string; value: React.ReactNode; subline?: React.ReactNode }[]; columns?: 2 | 3 }) {
  return <dl className={`grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 ${columns === 3 ? "lg:grid-cols-3" : ""}`}>
    {fields.map((field, index) => <Field key={`${field.label}-${index}`} {...field} />)}
  </dl>;
}

export function Field({ label, value, subline }: { label: string; value: React.ReactNode; subline?: React.ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return <div className="min-w-0">
    <dt className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--detail-muted)]">{label}</dt>
    <dd className={`mt-0.5 break-words text-[11px] font-semibold leading-snug ${empty ? "font-normal text-[var(--detail-muted)]" : "text-[var(--detail-text)]"}`}>{empty ? "—" : value}</dd>
    {subline ? <dd className="mt-0.5 break-words text-[9px] leading-snug text-[var(--detail-muted)]">{subline}</dd> : null}
  </div>;
}

export function KeyValueList({ rows }: { rows: { label: string; value: React.ReactNode; subline?: React.ReactNode }[] }) {
  return <dl>{rows.map((row, index) => <div key={`${row.label}-${index}`} className={`flex items-start justify-between gap-3 py-2 ${index ? "border-t border-[var(--detail-border)]" : ""}`}>
    <dt className="text-[10px] text-[var(--detail-muted)]">{row.label}</dt>
    <dd className="max-w-[65%] text-right text-[10px] font-semibold leading-snug text-[var(--detail-text)]">{row.value == null || row.value === "" ? <span className="font-normal text-[var(--detail-muted)]">—</span> : row.value}{row.subline ? <span className="mt-0.5 block text-[9px] font-normal text-[var(--detail-muted)]">{row.subline}</span> : null}</dd>
  </div>)}</dl>;
}

export function DataTable({ columns, rows }: { columns: { key: string; label: string; align?: "left" | "right" | "center" }[]; rows: Record<string, React.ReactNode>[] }) {
  return <div className="-mx-4 overflow-x-auto">
    <table className="w-full min-w-[700px] border-collapse text-left text-[10px]">
      <thead><tr className="bg-[var(--detail-bg)] text-[9px] uppercase tracking-wide text-[var(--detail-muted)]">{columns.map((column) => <th key={column.key} className={`px-2 py-2 font-semibold first:pl-4 last:pr-4 ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : ""}`}>{column.label}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map((row, index) => <tr key={index} className="border-b border-[var(--detail-border)] last:border-0">{columns.map((column) => {
        const value = row[column.key];
        return <td key={column.key} className={`px-2 py-2.5 align-top first:pl-4 last:pr-4 ${column.align === "right" ? "text-right font-bold tabular-nums" : column.align === "center" ? "text-center" : ""} ${value == null || value === "" ? "text-[var(--detail-muted)]" : "text-[var(--detail-text)]"}`}>{value == null || value === "" ? "—" : value}</td>;
      })}</tr>) : <tr><td colSpan={columns.length} className="px-4 py-5 text-center text-[11px] text-[var(--detail-muted)]">No requested items</td></tr>}</tbody>
    </table>
  </div>;
}

export function SpecGrid({ values }: { values: { label: string; value: React.ReactNode; wide?: boolean }[] }) {
  if (!values.length) return <p className="text-[10px] text-[var(--detail-muted)]">—</p>;
  return <dl className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
    {values.map((item, index) => <div key={`${item.label}-${index}`} className={`min-w-0 rounded-md border border-[var(--detail-border)] bg-[var(--surface)] px-2 py-1.5 ${item.wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-[8px] text-[var(--detail-muted)]">{item.label}</dt>
      <dd className="mt-0.5 break-words text-[9px] font-semibold leading-snug text-[var(--detail-text)]">{item.value || "—"}</dd>
    </div>)}
  </dl>;
}

export function Timeline({ items }: { items: { title: string; description: string; date: Date | string; user: string }[] }) {
  if (!items.length) return <p className="text-[11px] text-[var(--detail-muted)]">No activity recorded.</p>;
  return <ol className="space-y-0.5">{items.map((item, index) => <li key={`${item.title}-${index}`} className="relative flex gap-2.5 pb-2 last:pb-0">
    {index < items.length - 1 ? <span aria-hidden="true" className="absolute bottom-0 left-[6px] top-3 w-px bg-[var(--detail-border)]" /> : null}
    <span aria-hidden="true" className={`relative mt-1 size-[13px] shrink-0 rounded-full border-[4px] ${index === 0 ? "border-success-soft bg-success" : "border-info-soft bg-info"}`} />
    <div className="min-w-0"><p className="text-[10px] font-bold text-[var(--detail-text)]">{item.title}</p><p className="text-[9px] leading-snug text-[var(--ink-muted)]">{item.description || "—"}</p><p className="mt-0.5 text-[8px] text-[var(--detail-muted)]">{when(item.date)} · {item.user || "—"}</p></div>
  </li>)}</ol>;
}

export function StatusHistoryList({ items }: { items: { from: string | null; to: string; reason: string | null; date: Date | string; user: string }[] }) {
  if (!items.length) return <p className="text-[11px] text-[var(--detail-muted)]">No status changes recorded.</p>;
  return <ol className="divide-y divide-[var(--detail-border)]">{items.map((item, index) => <li key={`${item.to}-${index}`} className="py-2 first:pt-0 last:pb-0">
    <div className="flex flex-wrap items-center gap-1.5"><StatusBadge status={item.from || "—"} /><span aria-hidden="true" className="text-[9px] text-[var(--detail-muted)]">→</span><StatusBadge status={item.to} /></div>
    <p className="mt-1 text-[9px] leading-snug text-[var(--ink-muted)]">{item.reason || labelFor(item.to)}</p>
    <p className="mt-0.5 text-[8px] text-[var(--detail-muted)]">{when(item.date)} · {item.user || "—"}</p>
  </li>)}</ol>;
}

export function CalloutBanner({ title, description, action }: { title: string; description: string; action: React.ReactNode }) {
  return <section className="flex flex-col gap-3 rounded-lg border border-success-border bg-success-soft px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
    <div><h2 className="text-[11px] font-bold text-success">{title}</h2><p className="text-[9px] text-success">{description}</p></div>{action}
  </section>;
}

export function DetailActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center justify-center rounded-md bg-[var(--detail-blue)] px-3 py-1.5 text-[10px] font-semibold text-white shadow-sm transition hover:opacity-90">{children}</Link>;
}

export function EmptyDetailCard({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed border-[var(--detail-border)] px-4 py-6 text-center text-[11px] text-[var(--detail-muted)]">{message}</div>;
}

