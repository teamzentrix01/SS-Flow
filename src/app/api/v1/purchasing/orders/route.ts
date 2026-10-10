import { createPurchaseOrder } from "@/lib/commands";
import { action } from "@/lib/action";
import { purchaseOrderSchema } from "@/lib/schemas";

export const POST = action("purchase.manage", purchaseOrderSchema, (session, body, key) => createPurchaseOrder(session, body, key));
