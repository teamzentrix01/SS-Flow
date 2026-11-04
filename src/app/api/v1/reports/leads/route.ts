import { plantIdsForSession, requirePermission } from "@/lib/access";
import { jsonData, jsonError } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { reportLeadAnalytics } from "@/modules/leads/reports";
import { resolveLeadReportScope } from "@/modules/leads/report-scope";

export async function GET(request: Request) {
  try {
    const session = await requirePermission("lead.view");
    const plantIds = await plantIdsForSession(session);
    const { searchParams } = new URL(request.url);
    const scope = resolveLeadReportScope(session, searchParams.get("assigneeId"));
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;
    if (from && Number.isNaN(from.getTime())) {
      throw new AppError(400, "VALIDATION", "Invalid from date.");
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new AppError(400, "VALIDATION", "Invalid to date.");
    }

    const data = await reportLeadAnalytics({
      plantIds,
      assigneeId: scope.assigneeId,
      from,
      to: to ? new Date(to.getTime() + 86400000 - 1) : undefined,
    });

    return jsonData({ ...data, scope: { scopedToSelf: scope.scopedToSelf, assigneeId: scope.assigneeId ?? null } });
  } catch (error) {
    return jsonError(error);
  }
}
