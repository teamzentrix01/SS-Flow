import { adjustStock } from "@/lib/commands";
import { action } from "@/lib/action";
import { adjustSchema } from "@/lib/schemas";

export const POST = action("inventory.move", adjustSchema, (session, body, key) => adjustStock(session, body, key));
