import { jsonData, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { dashboardData } from "@/lib/queries";

export async function GET() {
  try {
    const session = await requirePermission("dashboard.view");
    return jsonData(await dashboardData(session.plantIds));
  } catch (error) {
    return jsonError(error);
  }
}
