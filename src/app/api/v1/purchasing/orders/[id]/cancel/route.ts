import { cancelPurchaseOrder } from "@/lib/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { cancelPoSchema } from "@/lib/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("purchase.cancel");
    const { id } = await context.params;
    const body = await readJson(request, cancelPoSchema);
    return jsonData(await cancelPurchaseOrder(session, id, body.reason, idempotencyKey(request)));
  } catch (error) {
    return jsonError(error);
  }
}
