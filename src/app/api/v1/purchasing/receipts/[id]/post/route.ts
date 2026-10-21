import { postGoodsReceipt } from "@/lib/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError } from "@/lib/api";
import { requireAnyPermission } from "@/lib/access";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireAnyPermission("inventory.receive", "purchase.manage");
    const { id } = await context.params;
    return jsonData(await postGoodsReceipt(session, id, idempotencyKey(request)));
  } catch (error) {
    return jsonError(error);
  }
}
