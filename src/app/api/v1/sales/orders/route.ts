import { createSalesOrder } from "@/modules/sales/commands";
import { action } from "@/lib/action";
import { salesOrderSchema } from "@/lib/schemas";

export const POST = action("sales.manage", salesOrderSchema, (session, body, key) => createSalesOrder(session, body, key));
