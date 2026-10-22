import { receiveInterFactoryTransfer } from "@/lib/commands";
import { action } from "@/lib/action";
import { interFactoryReceiveSchema } from "@/lib/schemas";

export const POST = action("inventory.move", interFactoryReceiveSchema, (session, body, key) =>
  receiveInterFactoryTransfer(session, body, key),
);
