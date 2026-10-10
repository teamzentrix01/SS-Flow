import { jsonData, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { listBalances } from "@/lib/queries";

export async function GET() {
  try {
    const session = await requirePermission("inventory.view");
    return jsonData(await listBalances(session.plantIds));
  } catch (error) {
    return jsonError(error);
  }
}
