import { upsertBom } from "@/modules/bom/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { activeBom } from "@/lib/queries";
import { bomSchema } from "@/lib/schemas";

export async function GET(_request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    const session = await requirePermission("production.manage");
    const { productId } = await context.params;
    return jsonData(await activeBom(productId, session.plantIds));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("production.manage");
    const { productId } = await context.params;
    const body = await readJson(request, bomSchema);
    return jsonData(await upsertBom(session, productId, body, idempotencyKey(request)));
  } catch (error) {
    return jsonError(error);
  }
}
