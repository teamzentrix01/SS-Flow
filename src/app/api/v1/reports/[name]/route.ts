import { plantIdsForSession, requirePermission } from "@/lib/access";
import { jsonData, jsonError } from "@/lib/api";
import { AppError } from "@/lib/errors";
import {
  reportJobsByStatus,
  reportPendingPurchase,
  reportSalesSummary,
  reportStockSummary,
} from "@/modules/reports/queries";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  try {
    const session = await requirePermission("report.view");
    const { name } = await context.params;
    if (name === "stock") return jsonData(await reportStockSummary(session.plantIds));
    if (name === "sales") return jsonData(await reportSalesSummary(session.plantIds));
    if (name === "purchase-pending") return jsonData(await reportPendingPurchase(session.plantIds));
    if (name === "jobs") return jsonData(await reportJobsByStatus(session.plantIds));
    if (name === "leads") {
      await requirePermission("lead.view");
      const { reportLeadAnalytics } = await import("@/modules/leads/reports");
      const { resolveLeadReportScope } = await import("@/modules/leads/report-scope");
      const plantIds = await plantIdsForSession(session);
      const scope = resolveLeadReportScope(session);
      return jsonData(await reportLeadAnalytics({ plantIds, assigneeId: scope.assigneeId }));
    }
    throw new AppError(404, "NOT_FOUND", "Unknown report.");
  } catch (error) {
    return jsonError(error);
  }
}
