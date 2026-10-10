import { createProductionOrder } from "@/lib/commands";
import { action } from "@/lib/action";
import { productionSchema } from "@/lib/schemas";

export const POST = action("production.manage", productionSchema, (session, body, key) => createProductionOrder(session, body, key));
