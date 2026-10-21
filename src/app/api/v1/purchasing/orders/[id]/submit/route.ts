import { submitPurchaseOrder } from "@/lib/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/access";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("purchase.submit");
    const { id } = await context.params;
    return jsonData(await submitPurchaseOrder(session, id, idempotencyKey(request)));
  } catch (error) {
    return jsonError(error);
  }
}
