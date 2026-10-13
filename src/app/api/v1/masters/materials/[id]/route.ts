import type { z } from "zod";
import { updateMaterial } from "@/modules/masters/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { materialUpdateSchema } from "@/lib/schemas";

function normalize(body: z.infer<typeof materialUpdateSchema>) {
  const optional = (value?: string) => value?.trim() || undefined;
  return {
    ...body,
    categoryId: optional(body.categoryId),
    thickness: optional(body.thickness),
    width: optional(body.width),
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("plant.manage");
    const { id } = await context.params;
    const body = await readJson(request, materialUpdateSchema);
    return jsonData(await updateMaterial(session, id, normalize(body), idempotencyKey(request)));
  } catch (error) {
    return jsonError(error);
  }
}
