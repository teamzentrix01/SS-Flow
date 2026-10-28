import { updateSalesOrderDeliveryDates } from "@/modules/sales/commands";
import { deliveryDatesSchema } from "@/lib/schemas";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("sales.manage");
    const { id } = await context.params;
    const body = await readJson(request, deliveryDatesSchema);
    return jsonData(
      await updateSalesOrderDeliveryDates(
        session,
        id,
        {
          requiredDeliveryDate: body.requiredDeliveryDate ?? undefined,
          promisedDate: body.promisedDate ?? undefined,
        },
        idempotencyKey(request),
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
}
