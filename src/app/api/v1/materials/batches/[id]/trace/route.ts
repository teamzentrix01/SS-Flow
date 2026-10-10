import { jsonData, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { batchDetail } from "@/lib/queries";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("inventory.view");
    const { id } = await context.params;
    const batch = await batchDetail(id, session.plantIds);
    if (!batch) throw new AppError(404, "NOT_FOUND", "Batch was not found.");
    return jsonData({ parents: batch.parents, children: batch.children });
  } catch (error) {
    return jsonError(error);
  }
}
