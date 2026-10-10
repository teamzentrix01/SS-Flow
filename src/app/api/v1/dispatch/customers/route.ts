import { createCustomer } from "@/lib/masters";
import { action } from "@/lib/action";
import { customerSchema } from "@/lib/schemas";

export const POST = action("dispatch.manage", customerSchema, (session, body, key) => createCustomer(session, body, key));
