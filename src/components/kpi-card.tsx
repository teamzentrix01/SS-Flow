import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  iconClassName = "bg-[var(--neutral)] text-white",
  cardClassName = "",
}: {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile — use a solid vibrant bg + text-white. */
  iconClassName?: string;
  /** Extra classes for the card article (e.g. a subtle tinted background). */
  cardClassName?: string;
}) {
  return (
    <article
      className={`flex min-h-[88px] flex-col justify-between overflow-hidden rounded-[12px] border bg-[var(--surface)] px-3.5 pt-3 pb-3 shadow-sm ${cardClassName}`}
    >
      {/* Top row: label left, icon right */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-medium leading-snug text-[var(--ink-muted)]">{label}</p>
        <span
          className={`inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] ${iconClassName}`}
          aria-hidden
        >
          <Icon className="size-3.5" strokeWidth={2.2} />
        </span>
      </div>

      {/* Bottom row: large value + unit */}
      <p className="mt-2 break-words font-mono text-[16px] font-bold leading-none tabular-nums tracking-tight text-[var(--ink)]">
        {value}
        {unit ? (
          <span className="ml-1 text-[11px] font-normal text-[var(--ink-muted)]">{unit}</span>
        ) : null}
      </p>
    </article>
  );
}
