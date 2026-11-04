import type { LeadStatus } from "@/modules/leads/status";

export const LEAD_STALE_WARNING_DAYS = 7;
export const LEAD_STALE_CRITICAL_DAYS = 14;

export const LEAD_TERMINAL_STATUSES = ["CONVERTED", "LOST", "REJECTED"] as const;

export const FOLLOW_UP_REQUIRED_STATUSES: readonly LeadStatus[] = [
  "CONTACTED",
  "FOLLOW_UP",
  "QUOTATION_SENT",
  "NEGOTIATION",
];

export function isOpenLeadStatus(status: string) {
  return !LEAD_TERMINAL_STATUSES.includes(status as (typeof LEAD_TERMINAL_STATUSES)[number]);
}

export function statusRequiresNextFollowUp(status: string) {
  return (FOLLOW_UP_REQUIRED_STATUSES as readonly string[]).includes(status);
}

export function parseFollowUpAt(value: string | undefined | null) {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function assertNextFollowUpForStatus(status: LeadStatus, nextFollowUpAt: Date | null | undefined) {
  if (!statusRequiresNextFollowUp(status)) return;
  if (!nextFollowUpAt) {
    throw new Error("NEXT_FOLLOW_UP_REQUIRED");
  }
}

export type LeadStaleLevel = "none" | "warning" | "critical";

export function leadStaleLevel(
  status: string,
  lastActivityAt: Date | string | null | undefined,
  now = new Date(),
): LeadStaleLevel {
  if (!isOpenLeadStatus(status)) return "none";
  const anchor = lastActivityAt ? new Date(lastActivityAt) : null;
  if (!anchor || Number.isNaN(anchor.getTime())) return "none";
  const days = (now.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24);
  if (days >= LEAD_STALE_CRITICAL_DAYS) return "critical";
  if (days >= LEAD_STALE_WARNING_DAYS) return "warning";
  return "none";
}

export function staleThresholdDate(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function isFollowUpOverdue(
  status: string,
  nextFollowUpAt: Date | string | null | undefined,
  now = new Date(),
) {
  if (!isOpenLeadStatus(status) || !nextFollowUpAt) return false;
  const at = new Date(nextFollowUpAt);
  return !Number.isNaN(at.getTime()) && at.getTime() < now.getTime();
}

export function firstContactMetrics(
  lead: {
    status: string;
    createdAt: Date;
    firstContactedAt: Date | null;
    firstResponseMinutes: number | null;
  },
  newStatus: LeadStatus,
  at = new Date(),
) {
  if (lead.status !== "NEW" || lead.firstContactedAt) return {};
  if (newStatus !== "CONTACTED" && newStatus !== "FOLLOW_UP") return {};
  if (lead.firstResponseMinutes != null) return { firstContactedAt: at };
  const minutes = Math.max(0, Math.round((at.getTime() - lead.createdAt.getTime()) / 60000));
  return { firstContactedAt: at, firstResponseMinutes: minutes };
}
