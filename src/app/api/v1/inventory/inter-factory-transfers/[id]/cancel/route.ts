import { cancelInterFactoryTransfer } from "@/lib/commands";
import { action } from "@/lib/action";
import { interFactoryCancelSchema } from "@/lib/schemas";

export const POST = action("inventory.move", interFactoryCancelSchema, (session, body, key) =>
  cancelInterFactoryTransfer(session, body, key),
);
