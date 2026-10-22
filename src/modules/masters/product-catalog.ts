import { prisma } from "@/db";
import type { SessionUser } from "@/lib/auth/session";
import { primaryPlant } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, runCommand } from "@/lib/inventory/post";
import {
  CATEGORY_TYPES,
  defaultCategoryTypeForProductType,
  legacyCategoryFromProductType,
  PRODUCT_FORMS,
  type CategoryType,
  type ProductForm,
  type ProductType,
} from "@/lib/domain/master-entities";
import { allow } from "@/modules/shared/allow";
import { missingMaterialSpecifications, type MaterialSpecKey } from "@/lib/domain/material-specifications";

const SUPPLY_MODES = ["purchased", "manufactured", "both"] as const;
const PRODUCT_TYPES = ["raw_material", "semi_finished", "finished", "consumable"] as const;
const UNIT_TYPES = ["weight", "count", "length"] as const;

export type CreateDeskProductInput = {
  sku: string;
  name: string;
  categoryId?: string;
  newCategory?: {
    code: string;
    name: string;
    categoryType?: CategoryType;
    productForm?: ProductForm;
    requiredSpecs?: MaterialSpecKey[];
    description?: string;
  };
  productType: ProductType;
  supplyMode: (typeof SUPPLY_MODES)[number];
  baseUnitSymbol?: string;
  newUnit?: {
    symbol: string;
    name: string;
    unitType?: (typeof UNIT_TYPES)[number];
  };
  description?: string;
  grade?: string;
  thickness?: string;
  width?: string;
  length?: string;
  diameter?: string;
  weightPerPiece?: string;
};

export async function createDeskProduct(session: SessionUser, input: CreateDeskProductInput, key: string | null) {
  allow(session, "plant.manage");
  const plantId = primaryPlant(session);
  if (!PRODUCT_TYPES.includes(input.productType)) {
    throw new AppError(400, "VALIDATION", "Invalid product type.");
  }
  if (!SUPPLY_MODES.includes(input.supplyMode)) {
    throw new AppError(400, "VALIDATION", "Invalid supply mode.");
  }

  return runCommand({
    userId: session.userId,
    route: "product.create",
    key,
    run: async (tx) => {
      const sku = input.sku.trim().toUpperCase();
      const name = input.name.trim();

      const duplicateProduct = await tx.product.findFirst({
        where: { plantId, sku: { equals: sku, mode: "insensitive" } },
      });
      if (duplicateProduct) throw new AppError(409, "DUPLICATE", "Product SKU already exists.");

      const duplicateMaterial = await tx.materialMaster.findFirst({
        where: { plantId, code: { equals: sku, mode: "insensitive" } },
      });
      if (duplicateMaterial) throw new AppError(409, "DUPLICATE", "Product SKU already exists on a stock record.");

      let categoryId: string | null = input.categoryId || null;
      let categoryRequiredSpecs: string[] = [];
      let productShape = "product";
      if (input.newCategory) {
        const categoryType =
          input.newCategory.categoryType ?? defaultCategoryTypeForProductType(input.productType);
        if (!CATEGORY_TYPES.includes(categoryType)) {
          throw new AppError(400, "VALIDATION", "Invalid category type.");
        }
        const productForm = input.newCategory.productForm || null;
        productShape = productForm ?? productShape;
        if (productForm && !PRODUCT_FORMS.includes(productForm)) {
          throw new AppError(400, "VALIDATION", "Invalid product form.");
        }
        const code = input.newCategory.code.trim().toUpperCase();
        const duplicateCategory = await tx.productCategory.findFirst({
          where: { plantId, code: { equals: code, mode: "insensitive" } },
        });
        if (duplicateCategory) throw new AppError(409, "DUPLICATE", "Category code already exists.");
        const category = await tx.productCategory.create({
          data: {
            id: uuidv7(),
            plantId,
            code,
            name: input.newCategory.name.trim(),
            categoryType,
            productForm,
            requiredSpecs: input.newCategory.requiredSpecs ?? [],
            description: input.newCategory.description?.trim() || null,
            status: "active",
          },
        });
        categoryId = category.id;
      } else if (categoryId) {
        const cat = await tx.productCategory.findFirst({ where: { id: categoryId, plantId } });
        if (!cat) throw new AppError(404, "NOT_FOUND", "Product category was not found.");
        if (cat.status !== "active") {
          throw new AppError(409, "CATEGORY_INACTIVE", `Category "${cat.name}" is not active. Activate it before assigning products.`);
        }
        categoryRequiredSpecs = cat.requiredSpecs;
        productShape = cat.productForm ?? productShape;
      }

      if (input.newCategory) categoryRequiredSpecs = input.newCategory.requiredSpecs ?? [];
      const missingSpecs = missingMaterialSpecifications(categoryRequiredSpecs, input);
      if (missingSpecs.length) {
        throw new AppError(400, "VALIDATION", `Required specifications: ${missingSpecs.join(", ")}.`);
      }

      let unitId: string;
      if (input.newUnit) {
        const symbol = input.newUnit.symbol.trim().toUpperCase();
        const unitType = input.newUnit.unitType ?? "count";
        if (!UNIT_TYPES.includes(unitType)) {
          throw new AppError(400, "VALIDATION", "Invalid unit type.");
        }
        const existing = await tx.unitOfMeasure.findFirst({
          where: { plantId, symbol: { equals: symbol, mode: "insensitive" } },
        });
        if (existing) {
          unitId = existing.id;
        } else {
          const created = await tx.unitOfMeasure.create({
            data: {
              id: uuidv7(),
              plantId,
              symbol,
              name: input.newUnit.name.trim(),
              unitType,
              isActive: true,
            },
          });
          unitId = created.id;
        }
      } else {
        const symbol = input.baseUnitSymbol!.trim().toUpperCase();
        const unit = await tx.unitOfMeasure.findFirst({
          where: { plantId, symbol, isActive: true },
        });
        if (!unit) {
          throw new AppError(404, "NOT_FOUND", "Unit was not found for this factory. Add a new unit instead.");
        }
        unitId = unit.id;
      }

      const unitRow = await tx.unitOfMeasure.findFirstOrThrow({ where: { id: unitId } });
      const legacyCategory = legacyCategoryFromProductType(input.productType);
      const productId = uuidv7();
      const materialId = uuidv7();
      const variantId = uuidv7();

      await tx.product.create({
        data: {
          id: productId,
          plantId,
          sku,
          name,
          categoryId,
          productType: input.productType,
          supplyMode: input.supplyMode,
          baseUnitId: unitId,
          description: input.description?.trim() || null,
          trackInventory: true,
          isActive: true,
        },
      });

      await tx.materialMaster.create({
        data: {
          id: materialId,
          plantId,
          code: sku,
          name,
          category: legacyCategory,
          categoryId,
          productType: input.productType,
          shape: productShape,
          description: input.description?.trim() || null,
          uom: unitRow.symbol,
          grade: input.grade?.trim() || null,
          thickness: input.thickness || null,
          width: input.width || null,
          length: input.length || null,
          diameter: input.diameter || null,
          weightPerPiece: input.weightPerPiece || null,
          batchTracking: true,
          purchaseAllowed: input.supplyMode !== "manufactured",
          salesAllowed: true,
          manufacturingAllowed: input.supplyMode !== "purchased",
          active: true,
          specs: {},
        },
      });

      await tx.productVariant.create({
        data: {
          id: variantId,
          plantId,
          productId,
          sku,
          materialMasterId: materialId,
          unitId,
          grade: input.grade?.trim() || null,
          thicknessMm: input.thickness || null,
          widthMm: input.width || null,
          lengthMm: input.length || null,
          diameterMm: input.diameter || null,
        },
      });

      await audit(tx, {
        userId: session.userId,
        action: "product.create",
        resource: "product",
        resourceId: productId,
      });
      return { id: productId, materialId, sku };
    },
  });
}

/** @deprecated Use createDeskProduct */
export async function createCatalogProduct(
  session: SessionUser,
  input: Parameters<typeof createDeskProduct>[1],
  key: string | null,
) {
  return createDeskProduct(session, input, key);
}

export async function listUnits(plantIds: string[]) {
  return prisma.unitOfMeasure.findMany({
    where: { plantId: { in: plantIds }, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function listAllCatalogProducts(options?: { q?: string }) {
  const q = options?.q?.trim();
  return prisma.product.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      category: { select: { name: true, code: true } },
      baseUnit: { select: { symbol: true } },
      plant: { select: { id: true, name: true } },
      _count: { select: { variants: true, boms: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllUnits() {
  return prisma.unitOfMeasure.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}

/** One row per symbol (KG, PCS, …) for dropdowns — avoids duplicate React keys across plants. */
export function dedupeUnitsBySymbol<T extends { symbol: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = row.symbol.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export async function listDistinctUnits() {
  return dedupeUnitsBySymbol(await listAllUnits());
}

export async function listCatalogProducts(plantIds: string[], options?: { q?: string }) {
  const q = options?.q?.trim();
  return prisma.product.findMany({
    where: {
      plantId: { in: plantIds },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      category: { select: { name: true, code: true } },
      baseUnit: { select: { symbol: true } },
      _count: { select: { variants: true, boms: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getCatalogProduct(id: string, plantIds: string[]) {
  return prisma.product.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: {
      category: true,
      baseUnit: true,
      variants: {
        include: {
          unit: true,
          materialMaster: { select: { id: true, code: true, active: true } },
        },
        orderBy: { sku: "asc" },
      },
    },
  });
}

export async function listVariantsForProduct(productId: string, plantIds: string[]) {
  return prisma.productVariant.findMany({
    where: { productId, plantId: { in: plantIds } },
    include: { unit: true, materialMaster: { select: { id: true, code: true } } },
    orderBy: { sku: "asc" },
  });
}
