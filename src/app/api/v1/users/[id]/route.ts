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
          password: body.password || undefined,
        },
        idempotencyKey(request),
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
}
