import { receiveGoods } from "@/lib/commands";
import { action } from "@/lib/action";
import { receiptSchema } from "@/lib/schemas";

export const POST = action("purchase.manage", receiptSchema, (session, body, key) => receiveGoods(session, body, key));
