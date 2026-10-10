import { transferStock } from "@/lib/commands";
import { action } from "@/lib/action";
import { transferSchema } from "@/lib/schemas";

export const POST = action("inventory.move", transferSchema, (session, body, key) => transferStock(session, body, key));
