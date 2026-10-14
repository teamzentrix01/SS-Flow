import { setUserRoles } from "@/modules/rbac/roles";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { userRolesSchema } from "@/lib/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("user.manage");
    const { id } = await context.params;
    const body = await readJson(request, userRolesSchema);
    return jsonData(await setUserRoles(session, id, body.roleIds, idempotencyKey(request)));
  } catch (error) {
    return jsonError(error);
  }
}
