import { createEmployee } from "@/lib/commands";
import { action } from "@/lib/action";
import { employeeSchema } from "@/lib/schemas";

export const POST = action("employee.manage", employeeSchema, (session, body, key) =>
  createEmployee(session, {
    ...body,
    shiftId: body.shiftId || undefined,
    departmentId: body.departmentId || undefined,
    supervisorId: body.supervisorId || undefined,
    assignedMachineId: body.assignedMachineId || undefined,
    skillLevel: body.skillLevel || undefined,
    employmentType: body.employmentType || undefined,
    loginEnabled: body.loginEnabled ?? true,
    password: body.password || undefined,
    roleCode: body.roleCode,
  }, key),
);
