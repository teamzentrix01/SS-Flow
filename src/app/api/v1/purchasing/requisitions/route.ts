import { createRequisitionFromRequirements } from "@/modules/procurement/requisitions";
import { action } from "@/lib/action";
import { requisitionSchema } from "@/lib/schemas";

export const POST = action("purchase.manage", requisitionSchema, (session, body, key) =>
  createRequisitionFromRequirements(session, body, key),
);
