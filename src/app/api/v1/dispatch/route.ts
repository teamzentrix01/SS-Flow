import { dispatchGoods } from "@/lib/commands";
import { action } from "@/lib/action";
import { dispatchSchema } from "@/lib/schemas";

export const POST = action("dispatch.manage", dispatchSchema, (session, body, key) => dispatchGoods(session, body, key));
