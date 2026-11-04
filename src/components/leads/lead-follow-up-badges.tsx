import type { LeadStaleLevel } from "@/modules/leads/follow-up";

export function LeadStaleBadge({ level }: { level: LeadStaleLevel }) {
  if (level === "none") return null;
  const label = level === "critical" ? "Stale · 14+ days" : "Stale · 7+ days";
  const className =
    level === "critical"
      ? "bg-danger-soft text-danger"
      : "bg-warning-soft text-warning";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  );
}
