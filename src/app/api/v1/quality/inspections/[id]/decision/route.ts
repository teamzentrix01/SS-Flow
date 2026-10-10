import { decideInspection } from "@/lib/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { decisionSchema } from "@/lib/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("qc.decide");
    const { id } = await context.params;
    const body = await readJson(request, decisionSchema);
    return jsonData(await decideInspection(session, id, body, idempotencyKey(request)));
  } catch (error) {
    return jsonError(error);
  }
}
