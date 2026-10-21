import { updateUser } from "@/lib/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { userUpdateSchema } from "@/lib/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("user.manage");
    const { id } = await context.params;
    const body = await readJson(request, userUpdateSchema);
    return jsonData(
      await updateUser(
        session,
        id,
        {
          name: body.name,
          phone: body.phone,
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
          password: body.password || undefined,
        },
        idempotencyKey(request),
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
}
