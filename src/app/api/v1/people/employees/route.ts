import { createEmployee } from "@/lib/commands";
import { action } from "@/lib/action";
import { employeeSchema } from "@/lib/schemas";

export const POST = action("employee.manage", employeeSchema, (session, body, key) => createEmployee(session, { ...body, shiftId: body.shiftId || undefined }, key));
