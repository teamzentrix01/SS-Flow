import type { z } from "zod";
import { createDeskProduct } from "@/modules/masters/product-catalog";
import { action } from "@/lib/action";
import { defaultCategoryTypeForProductType } from "@/lib/domain/master-entities";
import { createProductSchema } from "@/lib/schemas";

function normalizeBody(body: z.infer<typeof createProductSchema>) {
  const optional = (value?: string) => value?.trim() || undefined;
  return {
    sku: body.sku.trim(),
    name: body.name,
    categoryId: optional(body.categoryId),
    newCategory: body.newCategory
      ? {
          code: body.newCategory.code,
          name: body.newCategory.name,
          categoryType:
            body.newCategory.categoryType ??
            defaultCategoryTypeForProductType(body.productType),
          productForm: optional(body.newCategory.productForm) as import("@/lib/domain/master-entities").ProductForm | undefined,
          requiredSpecs: body.newCategory.requiredSpecs,
          description: optional(body.newCategory.description),
        }
      : undefined,
    productType: body.productType,
    supplyMode: body.supplyMode,
    baseUnitSymbol: optional(body.baseUnitSymbol),
    newUnit: body.newUnit
      ? {
          symbol: body.newUnit.symbol,
          name: body.newUnit.name,
          unitType: body.newUnit.unitType,
        }
      : undefined,
    description: optional(body.description),
    grade: optional(body.grade),
    thickness: optional(body.thickness),
    width: optional(body.width),
    length: optional(body.length),
    diameter: optional(body.diameter),
    weightPerPiece: optional(body.weightPerPiece),
  };
}

export const POST = action("plant.manage", createProductSchema, (session, body, key) =>
  createDeskProduct(session, normalizeBody(body), key),
);
