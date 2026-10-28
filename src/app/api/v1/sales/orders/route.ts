import { createSalesOrder } from "@/modules/sales/commands";
import { action } from "@/lib/action";
import { salesOrderSchema } from "@/lib/schemas";
import { requirePermission } from "@/lib/access";
import { jsonData, jsonError } from "@/lib/api";
import { listSalesOrders } from "@/lib/queries";

export async function GET() {
  try {
    const session = await requirePermission("sales.view");
    const orders = await listSalesOrders(session.plantIds);
    return jsonData(orders);
  } catch (error) {
    return jsonError(error);
  }
}

export const POST = action("sales.manage", salesOrderSchema, (session, body, key) =>
  createSalesOrder(session, body, key),
);
