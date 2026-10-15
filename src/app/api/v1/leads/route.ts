import { createLeadManual } from "@/modules/leads/commands";
import { action } from "@/lib/action";
import { leadCreateSchema } from "@/lib/schemas";

export const POST = action("lead.manage", leadCreateSchema, (session, body, key) =>
  createLeadManual(session, { ...body, email: body.email || undefined }, key),
);
