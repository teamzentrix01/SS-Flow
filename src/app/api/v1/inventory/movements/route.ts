import { jsonData, jsonError } from "@/lib/api";
import { plantIdsForSession, requirePermission } from "@/lib/access";
import { parseInventoryFilters } from "@/modules/inventory/filters";
import { listStockMovements } from "@/modules/inventory/queries";

export async function GET(request: Request) {
  try {
    const session = await requirePermission("inventory.view");
    const plantIds = await plantIdsForSession(session);
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const filters = parseInventoryFilters(params, plantIds);
    return jsonData(await listStockMovements(filters));
  } catch (error) {
    return jsonError(error);
  }
}
