import { jsonData, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { listMovements } from "@/lib/queries";

export async function GET(request: Request) {
  try {
    const session = await requirePermission("inventory.view");
    const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
    return jsonData(await listMovements(session.plantIds, cursor));
  } catch (error) {
    return jsonError(error);
  }
}
