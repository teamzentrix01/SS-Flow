import { getDesignation, updateDesignation } from "@/modules/rbac/designations";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requireAnyPermission, requirePermission } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { designationSchema } from "@/lib/schemas";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAnyPermission("designation.manage", "employee.manage");
    const { id } = await context.params;
    const row = await getDesignation(id, session.plantIds);
    if (!row) throw new AppError(404, "NOT_FOUND", "Designation was not found.");
    return jsonData(row);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    await requirePermission("designation.manage");
    const { id } = await context.params;
    const body = await readJson(request, designationSchema);
    const session = await requirePermission("designation.manage");
    return jsonData(
      await updateDesignation(
        session,
        id,
        {
          name: body.name,
          code: body.code,
          description: body.description,
          departmentId: body.departmentId || undefined,
          isActive: body.isActive,
        },
        idempotencyKey(request),
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
}
