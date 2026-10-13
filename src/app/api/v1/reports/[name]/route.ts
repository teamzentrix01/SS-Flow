import { requirePermission } from "@/lib/access";
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
    throw new AppError(404, "NOT_FOUND", "Unknown report.");
  } catch (error) {
    return jsonError(error);
  }
}
