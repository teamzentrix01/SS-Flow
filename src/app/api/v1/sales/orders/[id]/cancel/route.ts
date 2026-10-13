import { cancelSalesOrder } from "@/modules/sales/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { salesReasonSchema } from "@/lib/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("sales.approve");
    const { id } = await context.params;
    const body = await readJson(request, salesReasonSchema);
    return jsonData(await cancelSalesOrder(session, id, body.reason, idempotencyKey(request)));
  } catch (error) {
    return jsonError(error);
  }
}
