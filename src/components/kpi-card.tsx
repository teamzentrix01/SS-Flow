import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  iconClassName = "bg-[var(--bg)] text-[var(--ink-muted)]",
}: {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile (background + icon color). */
  iconClassName?: string;
}) {
  return (
    <article className="flex min-h-[108px] rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4 shadow-sm">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={`inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] ${iconClassName}`}
          aria-hidden
        >
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug text-[var(--ink-muted)]">{label}</p>
          <p className="mt-2 font-mono text-2xl font-medium tabular-nums tracking-tight text-[var(--ink)]">
            {value}
            {unit ? <span className="ml-1 text-base font-normal text-[var(--ink-muted)]">{unit}</span> : null}
          </p>
        </div>
      </div>
    </article>
  );
}
