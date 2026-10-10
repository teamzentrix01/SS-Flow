import { createSupplier } from "@/lib/commands";
import { action } from "@/lib/action";
import { supplierSchema } from "@/lib/schemas";

export const POST = action("purchase.manage", supplierSchema, (session, body, key) => createSupplier(session, body, key));
