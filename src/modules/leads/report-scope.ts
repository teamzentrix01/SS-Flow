import type { SessionUser } from "@/lib/auth/session";

/** Users without lead.manage only see their own assigned leads in reports. */
export function resolveLeadReportScope(
  session: SessionUser,
  requestedAssigneeId?: string | null,
): { assigneeId?: string; scopedToSelf: boolean } {
  const canSeeAll =
    session.permissions.has("lead.manage") ||
    session.roles.has("admin") ||
    session.roles.has("manager");

  if (canSeeAll) {
    const id = requestedAssigneeId?.trim();
    return id ? { assigneeId: id, scopedToSelf: false } : { scopedToSelf: false };
  }

  if (session.employeeId) {
    return { assigneeId: session.employeeId, scopedToSelf: true };
  }

  return { scopedToSelf: false };
}
