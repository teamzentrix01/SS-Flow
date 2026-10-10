import { releaseMaintenance } from "@/lib/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/access";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("machine.manage");
    const { id } = await context.params;
    return jsonData(await releaseMaintenance(session, id, idempotencyKey(request)));
  } catch (error) {
    return jsonError(error);
  }
}
