import { assertSameOrigin, idempotencyKey, jsonData, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { softDeleteDeskProduct } from "@/modules/masters/product-catalog";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("plant.manage");
    const { id } = await context.params;
    return jsonData(await softDeleteDeskProduct(session, id, idempotencyKey(request)));
  } catch (error) {
    return jsonError(error);
  }
}
