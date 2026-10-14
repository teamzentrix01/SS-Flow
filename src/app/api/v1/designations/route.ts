import { createDesignation, listDesignations } from "@/modules/rbac/designations";
import { action } from "@/lib/action";
import { designationSchema } from "@/lib/schemas";
import { requireAnyPermission } from "@/lib/access";
import { jsonData, jsonError } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const session = await requireAnyPermission("designation.manage", "employee.manage");
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "20");
    const activeOnly = url.searchParams.get("activeOnly") === "1";
    const data = await listDesignations(session, session.plantIds, { q, page, pageSize, activeOnly });
    return jsonData(data);
  } catch (error) {
    return jsonError(error);
  }
}

export const POST = action("designation.manage", designationSchema, (session, body, key) =>
  createDesignation(
    session,
    {
      name: body.name,
      code: body.code,
      description: body.description,
      departmentId: body.departmentId || undefined,
      plantId: body.plantId,
    },
    key,
  ),
);
