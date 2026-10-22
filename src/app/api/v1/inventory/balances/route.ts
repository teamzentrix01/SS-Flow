import { jsonData, jsonError } from "@/lib/api";
import { plantIdsForSession, requirePermission } from "@/lib/access";
import { listBalances } from "@/lib/queries";

export async function GET() {
  try {
    const session = await requirePermission("inventory.view");
    const plantIds = await plantIdsForSession(session);
    return jsonData(await listBalances(plantIds));
  } catch (error) {
    return jsonError(error);
  }
}
