import { createRole, listPermissionCatalog, listRoles } from "@/modules/rbac/roles";
import { action } from "@/lib/action";
import { roleSchema } from "@/lib/schemas";
import { requirePermission } from "@/lib/access";
import { jsonData, jsonError } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const session = await requirePermission("role.manage");
    const url = new URL(request.url);
    if (url.searchParams.get("catalog") === "1") {
      return jsonData(await listPermissionCatalog(session));
    }
    const q = url.searchParams.get("q") ?? undefined;
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
    const data = await listRoles(session, { q, page, pageSize });
    return jsonData(data);
  } catch (error) {
    return jsonError(error);
  }
}

export const POST = action("role.manage", roleSchema, (session, body, key) =>
  createRole(
    session,
    {
      name: body.name,
      code: body.code,
      description: body.description,
      permissionCodes: body.permissionCodes,
    },
    key,
  ),
);
