import { createMachine } from "@/lib/masters";
import { action } from "@/lib/action";
import { machineSchema } from "@/lib/schemas";

export const POST = action("machine.manage", machineSchema, (session, body, key) =>
  createMachine(session, { ...body, departmentId: body.departmentId || undefined, readingRequired: body.readingRequired ?? true }, key),
);
