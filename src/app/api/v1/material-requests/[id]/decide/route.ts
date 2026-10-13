import { decideMaterialRequest } from "@/modules/material-requests/commands";
import { materialRequestDecisionSchema } from "@/lib/schemas";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("material.request.review");
    const { id } = await context.params;
    const body = await readJson(request, materialRequestDecisionSchema);
    return jsonData(await decideMaterialRequest(session, id, body, idempotencyKey(request)));
  } catch (error) {
    return jsonError(error);
  }
}
