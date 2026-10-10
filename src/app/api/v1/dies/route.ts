import { createDie } from "@/lib/masters";
import { action } from "@/lib/action";
import { dieSchema } from "@/lib/schemas";

export const POST = action("machine.manage", dieSchema, (session, body, key) =>
  createDie(session, { ...body, lifeLimit: body.lifeLimit || undefined }, key),
);
