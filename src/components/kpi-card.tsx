export function KpiCard({
  label,
  value,
  unit,
  detail,
  variant = "primary",
}: {
  label: string;
  value: string;
  unit?: string;
  detail?: string;
  variant?: "primary" | "compact";
}) {
  if (variant === "compact") {
    return (
      <article className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-[18px] py-4 shadow-sm">
        <p className="text-[13px] text-[var(--ink-muted)]">{label}</p>
        <p className="mt-2 font-mono text-2xl font-medium tabular-nums tracking-tight text-[var(--ink)]">
          {value}
          {unit ? <span className="ml-1 text-base font-normal text-[var(--ink-muted)]">{unit}</span> : null}
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-[22px] shadow-sm">
      <p className="text-[13px] text-[var(--ink-muted)]">{label}</p>
      <p className="mt-3 font-mono text-[40px] leading-none font-medium tabular-nums tracking-tight text-[var(--ink)]">
        {value}
        {unit ? <span className="ml-2 text-xl font-normal text-[var(--ink-muted)]">{unit}</span> : null}
      </p>
      {detail ? <p className="mt-3 text-[13px] text-[var(--ink-muted)]">{detail}</p> : null}
    </article>
  );
}
