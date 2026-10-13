import { submitSalesOrder } from "@/modules/sales/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/access";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("sales.manage");
    const { id } = await context.params;
    return jsonData(await submitSalesOrder(session, id, idempotencyKey(_request)));
  } catch (error) {
    return jsonError(error);
  }
}
