import { updateProductCategory } from "@/modules/masters/categories";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { categoryUpdateSchema } from "@/lib/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("plant.manage");
    const { id } = await context.params;
    const body = await readJson(request, categoryUpdateSchema);
    return jsonData(
      await updateProductCategory(
        session,
        id,
        {
          code: body.code,
          name: body.name,
          categoryType: body.categoryType,
          parentId: body.parentId || undefined,
          productForm: body.productForm || undefined,
          description: body.description,
          status: body.status,
        },
        idempotencyKey(request),
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
}
