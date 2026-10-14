import { deleteRole, getRoleDetail, updateRole } from "@/modules/rbac/roles";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { roleSchema } from "@/lib/schemas";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("role.manage");
    const { id } = await context.params;
    const row = await getRoleDetail(id);
    if (!row) return jsonError(new Error("NOT_FOUND"));
    return jsonData(row);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("role.manage");
    const { id } = await context.params;
    const body = await readJson(request, roleSchema);
    return jsonData(
      await updateRole(
        session,
        id,
        {
          name: body.name,
          code: body.code,
          description: body.description,
          isActive: body.isActive,
          permissionCodes: body.permissionCodes,
        },
        idempotencyKey(request),
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("role.manage");
    const { id } = await context.params;
    return jsonData(await deleteRole(session, id, idempotencyKey(request)));
  } catch (error) {
    return jsonError(error);
  }
}
