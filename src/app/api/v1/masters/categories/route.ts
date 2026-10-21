import { createProductCategory, listProductCategories } from "@/modules/masters/categories";
import { action } from "@/lib/action";
import { categorySchema } from "@/lib/schemas";
import { requirePermission } from "@/lib/access";
import { jsonData, jsonError } from "@/lib/api";

export async function GET() {
  try {
    const session = await requirePermission("plant.manage");
    const rows = await listProductCategories(session.plantIds);
    return jsonData(
      rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        parentId: row.parentId,
        parentName: row.parent?.name ?? null,
        categoryType: row.categoryType,
        productForm: row.productForm,
        requiredSpecs: row.requiredSpecs,
        description: row.description,
        status: row.status,
      })),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export const POST = action("plant.manage", categorySchema, (session, body, key) =>
  createProductCategory(
    session,
    {
      code: body.code,
      name: body.name,
      categoryType: body.categoryType,
      parentId: body.parentId || undefined,
      productForm: body.productForm || undefined,
      requiredSpecs: body.requiredSpecs,
      description: body.description,
      status: body.status,
    },
    key,
  ),
);
