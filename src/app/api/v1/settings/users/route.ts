import { createUser } from "@/lib/commands";
import { action } from "@/lib/action";
import { userCreateSchema } from "@/lib/schemas";

export const POST = action("user.manage", userCreateSchema, (session, body, key) =>
  createUser(session, {
    name: body.name,
    email: body.email,
    phone: body.phone,
    password: body.password,
    roleCode: body.roleCode,
    staffRoleCode: body.staffRoleCode,
    employeeCode: body.employeeCode || undefined,
    designationId: body.designationId || undefined,
    newDesignation: body.newDesignation || undefined,
    departmentId: body.departmentId || undefined,
    shiftId: body.shiftId || undefined,
    plantIds: body.plantIds,
    customerId: body.customerId || undefined,
    supplierId: body.supplierId || undefined,
    addressLine: body.addressLine || undefined,
  }, key),
);
