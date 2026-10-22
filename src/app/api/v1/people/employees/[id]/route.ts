import { updateEmployee } from "@/lib/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { updateEmployeeSchema } from "@/lib/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("employee.manage");
    const { id } = await context.params;
    const body = await readJson(request, updateEmployeeSchema);
    return jsonData(
      await updateEmployee(
        session,
        id,
        {
          ...body,
          shiftId: body.shiftId || undefined,
          password: body.password || undefined,
          permissionCodes: body.permissionCodes,
        },
        idempotencyKey(request),
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
}
