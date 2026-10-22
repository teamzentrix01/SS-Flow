import { approveInterFactoryTransfer } from "@/lib/commands";
import { action } from "@/lib/action";
import { interFactoryApproveSchema } from "@/lib/schemas";

export const POST = action("inventory.move", interFactoryApproveSchema, (session, body, key) =>
  approveInterFactoryTransfer(session, body, key),
);
