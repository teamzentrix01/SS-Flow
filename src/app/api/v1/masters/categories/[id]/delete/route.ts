import { deleteProductCategory } from "@/modules/masters/categories";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/access";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(_request);
    const session = await requirePermission("plant.manage");
    const { id } = await context.params;
    return jsonData(await deleteProductCategory(session, id, idempotencyKey(_request)));
  } catch (error) {
    return jsonError(error);
  }
}
