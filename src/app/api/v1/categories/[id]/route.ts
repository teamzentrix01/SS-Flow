import { getProductCategory, updateProductCategory } from "@/modules/masters/categories";
import { requirePermission } from "@/lib/access";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { categoryUpdateSchema } from "@/lib/schemas";

type RouteContext = { params: Promise<{ id: string }> };

function serializeCategory(row: NonNullable<Awaited<ReturnType<typeof getProductCategory>>>) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    parentId: row.parentId,
    parent: row.parent,
    categoryType: row.categoryType,
    productForm: row.productForm,
    requiredSpecs: row.requiredSpecs,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    counts: row._count,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requirePermission("plant.manage");
    const { id } = await context.params;
    const row = await getProductCategory(id, session.plantIds);
    if (!row) throw new AppError(404, "NOT_FOUND", "Category was not found.");
    return jsonData(serializeCategory(row));
  } catch (error) {
    return jsonError(error);
  }
}

async function updateFromRequest(request: Request, context: RouteContext) {
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
        requiredSpecs: body.requiredSpecs,
        description: body.description,
        status: body.status,
      },
      idempotencyKey(request),
    ),
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    return await updateFromRequest(request, context);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    return await updateFromRequest(request, context);
  } catch (error) {
    return jsonError(error);
  }
}
