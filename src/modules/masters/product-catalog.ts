import { prisma } from "@/db";
import { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import { plantIdsForSession, primaryPlant } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, nextNumber, runCommand } from "@/lib/inventory/post";
import { BUSINESS_ROOTS } from "@/lib/domain/business-categories";
import { legacyCategoryFromProductType } from "@/lib/domain/master-entities";
import { allow } from "@/modules/shared/allow";
import { normalizeMasterName, validateSpecificationCompatibility } from "./grades-finishes";

export type CreateDeskProductInput = {
  sku?: string;
  name: string;
  businessKind: "trading" | "manufactured";
  baseUnitSymbol: string;
  description?: string;
  specs?: Record<string, string>;
};

export type ProductVariantInput = {
  id?: string;
  displayName?: string;
  grade?: string;
  finish?: string;
  thickness?: string;
  width?: string;
  length?: string;
  diameter?: string;
  uom?: string;
  attributes?: Record<string, unknown>;
  isActive?: boolean;
};

export async function saveProductVariant(session: SessionUser, productId: string, input: ProductVariantInput, key: string | null) {
  allow(session, "plant.manage");
  const plantIds = await plantIdsForSession(session);
  return runCommand({
    userId: session.userId,
    route: input.id ? "product.variant.update" : "product.variant.create",
    key,
    run: async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, plantId: { in: plantIds }, isActive: true },
        include: { variants: { include: { materialMaster: true, unit: true } } },
      });
      if (!product) throw new AppError(404, "NOT_FOUND", "Active parent product not found.");
      const existing = input.id ? product.variants.find((variant) => variant.id === input.id) : undefined;
      if (input.id && !existing) throw new AppError(404, "NOT_FOUND", "Variant not found under this product.");
      const clean = (value?: string | null) => value?.trim() || null;
      const numeric = (value?: string) => value?.trim() ? value.trim() : null;
      const asDecimal = (value?: string | null) => (value && Number.isFinite(Number(value)) ? new Prisma.Decimal(value) : null);
      const values = {
        grade: clean(input.grade), finish: clean(input.finish),
        thicknessMm: numeric(input.thickness), widthMm: numeric(input.width),
        lengthMm: numeric(input.length), diameterMm: numeric(input.diameter),
      };
      const duplicate = product.variants.find((variant) => variant.id !== input.id && variant.isActive &&
        variant.grade === values.grade && variant.finish === values.finish &&
        Number(variant.thicknessMm ?? 0) === Number(values.thicknessMm ?? 0) &&
        Number(variant.widthMm ?? 0) === Number(values.widthMm ?? 0) &&
        Number(variant.lengthMm ?? 0) === Number(values.lengthMm ?? 0) &&
        Number(variant.diameterMm ?? 0) === Number(values.diameterMm ?? 0));
      if (duplicate && input.isActive !== false) throw new AppError(409, "DUPLICATE", "An active variant with these specifications already exists.");
      const baseMaterial = existing?.materialMaster ?? product.variants.find((variant) => variant.materialMaster)?.materialMaster;
      if (!baseMaterial) throw new AppError(409, "INVALID_STATE", "This product has no linked stock SKU to use as a variant template.");
      const unit = input.uom ? await tx.unitOfMeasure.findFirst({ where: { plantId: product.plantId, symbol: input.uom, isActive: true } }) : (existing?.unit ?? product.variants.find((variant) => variant.unit)?.unit);
      if (!unit) throw new AppError(400, "VALIDATION", "Choose a valid unit of measure.");
      const previousAttrs = existing?.attributes && typeof existing.attributes === "object" && !Array.isArray(existing.attributes) ? existing.attributes as Record<string, unknown> : {};
      const attrs: Record<string, unknown> = { ...(input.attributes ?? previousAttrs) };
      for (const [key, value] of Object.entries({ grade: values.grade, finish: values.finish, thickness: values.thicknessMm, width: values.widthMm, length: values.lengthMm, diameter: values.diameterMm })) {
        delete attrs[key];
        if (value) attrs[key] = value;
      }
      const autoName = [product.name, values.grade, values.finish, values.thicknessMm && `${values.thicknessMm} mm`, values.widthMm && `W ${values.widthMm} mm`, values.lengthMm && `L ${values.lengthMm} mm`, values.diameterMm && `Ø ${values.diameterMm} mm`].filter(Boolean).join(" · ");
      const displayName = clean(input.displayName) ?? autoName;
      const compats = await validateSpecificationCompatibility(tx, {
        productId: product.id,
        grade: values.grade,
        finish: values.finish,
      });
      const resolvedGrade = compats.gradeName ?? values.grade;
      const resolvedFinish = compats.finishName ?? values.finish;

      if (existing) {
        const active = input.isActive ?? existing.isActive;
        await tx.productVariant.update({
          where: { id: existing.id },
          data: {
            displayName,
            ...values,
            grade: resolvedGrade,
            finish: resolvedFinish,
            gradeId: compats.gradeId ?? existing.gradeId,
            finishId: compats.finishId ?? existing.finishId,
            unitId: unit.id,
            attributes: attrs as Prisma.InputJsonObject,
            isActive: active,
          },
        });
        if (existing.materialMasterId) {
          await tx.materialMaster.update({
            where: { id: existing.materialMasterId },
            data: {
              name: displayName,
              grade: resolvedGrade,
              thickness: asDecimal(values.thicknessMm),
              width: asDecimal(values.widthMm),
              length: asDecimal(values.lengthMm),
              diameter: asDecimal(values.diameterMm),
              uom: unit.symbol,
              active,
              specs: attrs as Prisma.InputJsonObject,
            },
          });
        }
        await audit(tx, { userId: session.userId, action: active ? "product.variant.update" : "product.variant.deactivate", resource: "product_variant", resourceId: existing.id });
        return { id: existing.id, displayName, isActive: active };
      }
      const variantId = uuidv7();
      const materialId = uuidv7();
      const sku = `${product.sku.slice(0, 20)}-V${variantId.slice(-6).toUpperCase()}`;
      const collision = await tx.materialMaster.findFirst({ where: { plantId: product.plantId, code: sku } });
      if (collision) throw new AppError(409, "DUPLICATE", "Generated variant SKU collided. Please retry.");
      await tx.materialMaster.create({ data: {
        id: materialId, plantId: product.plantId, code: sku, name: displayName,
        category: baseMaterial.category, categoryId: baseMaterial.categoryId, productType: baseMaterial.productType,
        shape: baseMaterial.shape, description: baseMaterial.description, brand: baseMaterial.brand, hsnCode: baseMaterial.hsnCode,
        uom: unit.symbol, purchaseUom: baseMaterial.purchaseUom, salesUom: unit.symbol,
        batchTracking: baseMaterial.batchTracking, serialTracking: baseMaterial.serialTracking,
        grade: resolvedGrade, thickness: asDecimal(values.thicknessMm), width: asDecimal(values.widthMm), length: asDecimal(values.lengthMm), diameter: asDecimal(values.diameterMm),
        purchaseAllowed: baseMaterial.purchaseAllowed, salesAllowed: baseMaterial.salesAllowed, manufacturingAllowed: baseMaterial.manufacturingAllowed,
        purchasePrice: baseMaterial.purchasePrice, sellingPrice: baseMaterial.sellingPrice, taxRate: baseMaterial.taxRate, specs: attrs as Prisma.InputJsonObject, active: input.isActive ?? true,
      } });
      await tx.productVariant.create({ data: {
        id: variantId, plantId: product.plantId, productId, sku, displayName, materialMasterId: materialId,
        unitId: unit.id, ...values, grade: resolvedGrade, finish: resolvedFinish,
        gradeId: compats.gradeId, finishId: compats.finishId,
        attributes: attrs as Prisma.InputJsonObject, isActive: input.isActive ?? true,
      } });
      await audit(tx, { userId: session.userId, action: "product.variant.create", resource: "product_variant", resourceId: variantId });
      return { id: variantId, displayName, sku, isActive: input.isActive ?? true };
    },
  });
}

export async function createDeskProduct(session: SessionUser, input: CreateDeskProductInput, key: string | null) {
  allow(session, "plant.manage");
  const plantId = primaryPlant(session);
  if (input.businessKind !== "trading" && input.businessKind !== "manufactured") {
    throw new AppError(400, "VALIDATION", "Invalid business category.");
  }

  return runCommand({
    userId: session.userId,
    route: "product.create",
    key,
    run: async (tx) => {
      const sku = input.sku?.trim().toUpperCase() || (await nextNumber(tx, plantId, "PRD"));
      const name = input.name.trim();
      const productType = input.businessKind === "trading" ? "raw_material" : "finished";
      const supplyMode = input.businessKind === "trading" ? "purchased" : "manufactured";

      const duplicateProduct = await tx.product.findFirst({
        where: { plantId, sku: { equals: sku, mode: "insensitive" } },
      });
      if (duplicateProduct) throw new AppError(409, "DUPLICATE", "Product SKU already exists.");

      const duplicateMaterial = await tx.materialMaster.findFirst({
        where: { plantId, code: { equals: sku, mode: "insensitive" } },
      });
      if (duplicateMaterial) throw new AppError(409, "DUPLICATE", "Product SKU already exists on a stock record.");

      const root = await tx.productCategory.findFirst({
        where: { plantId, code: BUSINESS_ROOTS[input.businessKind].code, parentId: null },
      });
      if (!root) throw new AppError(409, "CATEGORY_NOT_FOUND", "Business categories are not configured for this factory.");
      const categoryId = root.id;
      const productShape = "product";
      const specs = input.specs ?? {};

      let unitId: string;
      {
        const symbol = input.baseUnitSymbol.trim().toUpperCase();
        const unit = await tx.unitOfMeasure.findFirst({
          where: { plantId, symbol, isActive: true },
        });
        if (!unit) {
          throw new AppError(404, "NOT_FOUND", "Unit was not found for this factory.");
        }
        unitId = unit.id;
      }

      const unitRow = await tx.unitOfMeasure.findFirstOrThrow({ where: { id: unitId } });
      const legacyCategory = legacyCategoryFromProductType(productType);
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
          productType,
          supplyMode,
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
          productType,
          shape: productShape,
          description: input.description?.trim() || null,
          uom: unitRow.symbol,
          grade: specs.grade?.trim() || null,
          thickness: specs.thickness || null,
          width: specs.width || null,
          length: specs.length || null,
          diameter: specs.diameter || null,
          weightPerPiece: specs.netWeightKg || null,
          batchTracking: true,
          purchaseAllowed: supplyMode !== "manufactured",
          salesAllowed: true,
          manufacturingAllowed: supplyMode !== "purchased",
          active: true,
          specs,
        },
      });

      let initialGradeId: string | null = null;
      let initialFinishId: string | null = null;

      if (specs.grade?.trim()) {
        const norm = normalizeMasterName(specs.grade);
        let g = await tx.gradeMaster.findUnique({
          where: { plantId_normalizedName: { plantId, normalizedName: norm } },
        });
        if (!g) {
          g = await tx.gradeMaster.create({
            data: { id: uuidv7(), plantId, name: specs.grade.trim(), normalizedName: norm, isActive: true, createdById: session.userId },
          });
        }
        initialGradeId = g.id;
        await tx.productGradeCompatibility.create({
          data: { id: uuidv7(), plantId, productId, gradeId: g.id, isActive: true },
        });
      }

      if (specs.finish?.trim()) {
        const norm = normalizeMasterName(specs.finish);
        let f = await tx.finishMaster.findUnique({
          where: { plantId_normalizedName: { plantId, normalizedName: norm } },
        });
        if (!f) {
          f = await tx.finishMaster.create({
            data: { id: uuidv7(), plantId, name: specs.finish.trim(), normalizedName: norm, isActive: true, createdById: session.userId },
          });
        }
        initialFinishId = f.id;
        await tx.productFinishCompatibility.create({
          data: { id: uuidv7(), plantId, productId, finishId: f.id, isActive: true },
        });
      }

      await tx.productVariant.create({
        data: {
          id: variantId,
          plantId,
          productId,
          sku,
          materialMasterId: materialId,
          unitId,
          grade: specs.grade?.trim() || null,
          gradeId: initialGradeId,
          finish: specs.finish?.trim() || null,
          finishId: initialFinishId,
          thicknessMm: specs.thickness || null,
          widthMm: specs.width || null,
          lengthMm: specs.length || null,
          diameterMm: specs.diameter || null,
          attributes: specs,
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

export async function updateDeskProduct(
  session: SessionUser,
  productId: string,
  input: CreateDeskProductInput,
  key: string | null,
) {
  allow(session, "plant.manage");
  const plantId = primaryPlant(session);
  if (input.businessKind !== "trading" && input.businessKind !== "manufactured") {
    throw new AppError(400, "VALIDATION", "Invalid business category.");
  }

  return runCommand({
    userId: session.userId,
    route: "product.update",
    key,
    run: async (tx) => {
      const existing = await tx.product.findFirst({
        where: { id: productId, plantId },
        include: { variants: { include: { materialMaster: true } } },
      });
      if (!existing) throw new AppError(404, "NOT_FOUND", "Product was not found.");
      const primaryVariant = existing.variants.find((variant) => variant.sku === existing.sku) ?? existing.variants[0];
      const sku = input.sku?.trim().toUpperCase() || existing.sku;
      const duplicate = await tx.product.findFirst({
        where: { plantId, id: { not: productId }, sku: { equals: sku, mode: "insensitive" } },
      });
      if (duplicate) throw new AppError(409, "DUPLICATE", "Product SKU already exists.");
      const stockDuplicate = await tx.materialMaster.findFirst({
        where: { plantId, code: { equals: sku, mode: "insensitive" }, ...(primaryVariant?.materialMasterId ? { id: { not: primaryVariant.materialMasterId } } : {}) },
      });
      if (stockDuplicate) throw new AppError(409, "DUPLICATE", "Product SKU already exists on a stock record.");

      const unit = await tx.unitOfMeasure.findFirst({
        where: { plantId, symbol: input.baseUnitSymbol.trim().toUpperCase(), isActive: true },
      });
      if (!unit) throw new AppError(404, "NOT_FOUND", "Unit was not found for this factory.");
      const root = await tx.productCategory.findFirst({
        where: { plantId, code: BUSINESS_ROOTS[input.businessKind].code, parentId: null },
      });
      if (!root) throw new AppError(409, "CATEGORY_NOT_FOUND", "Business categories are not configured for this factory.");

      const productType = input.businessKind === "trading" ? "raw_material" : "finished";
      const supplyMode = input.businessKind === "trading" ? "purchased" : "manufactured";
      const legacyCategory = legacyCategoryFromProductType(productType);
      const specs = input.specs ?? {};
      await tx.product.update({
        where: { id: productId },
        data: { sku, name: input.name.trim(), categoryId: root.id, productType, supplyMode, baseUnitId: unit.id, description: input.description?.trim() || null },
      });
      if (primaryVariant) {
        await tx.productVariant.update({
          where: { id: primaryVariant.id },
          data: { sku, unitId: unit.id, grade: specs.grade?.trim() || null, thicknessMm: specs.thickness || null, widthMm: specs.width || null, lengthMm: specs.length || null, diameterMm: specs.diameter || null, finish: specs.finish?.trim() || null, attributes: specs },
        });
        if (primaryVariant.materialMasterId) {
          await tx.materialMaster.update({
            where: { id: primaryVariant.materialMasterId },
            data: { code: sku, name: input.name.trim(), category: legacyCategory, categoryId: root.id, productType, description: input.description?.trim() || null, uom: unit.symbol, grade: specs.grade?.trim() || null, thickness: specs.thickness || null, width: specs.width || null, length: specs.length || null, diameter: specs.diameter || null, weightPerPiece: specs.netWeightKg || null, purchaseAllowed: supplyMode !== "manufactured", manufacturingAllowed: supplyMode !== "purchased", specs },
          });
        }
      }
      await audit(tx, { userId: session.userId, action: "product.update", resource: "product", resourceId: productId });
      return { id: productId, sku };
    },
  });
}

export async function softDeleteDeskProduct(session: SessionUser, productId: string, key: string | null) {
  allow(session, "plant.manage");
  const plantIds = await plantIdsForSession(session);
  if (!plantIds.length) throw new AppError(403, "FORBIDDEN", "No plant is assigned to this user.");
  return runCommand({
    userId: session.userId,
    route: "product.soft_delete",
    key,
    run: async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, plantId: { in: plantIds } }, include: { variants: true } });
      if (!product) throw new AppError(404, "NOT_FOUND", "Product was not found.");
      await tx.product.update({ where: { id: productId }, data: { isActive: false } });
      await tx.productVariant.updateMany({ where: { productId, plantId: { in: plantIds } }, data: { isActive: false } });
      const materialIds = product.variants.flatMap((variant) => variant.materialMasterId ? [variant.materialMasterId] : []);
      if (materialIds.length) await tx.materialMaster.updateMany({ where: { id: { in: materialIds }, plantId: { in: plantIds } }, data: { active: false } });
      await audit(tx, { userId: session.userId, action: "product.soft_delete", resource: "product", resourceId: productId });
      return { id: productId, deleted: true };
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
      isActive: true,
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
      category: {
        select: {
          id: true,
          name: true,
          code: true,
          parentId: true,
          parent: { select: { id: true, name: true, code: true, parent: { select: { code: true, name: true } } } },
        },
      },
      baseUnit: { select: { symbol: true } },
      variants: {
        select: { grade: true, finish: true, widthMm: true, lengthMm: true },
        orderBy: { sku: "asc" },
      },
      plant: { select: { id: true, name: true } },
      _count: { select: { variants: { where: { isActive: true } }, boms: true } },
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
      isActive: true,
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
      category: {
        select: {
          id: true,
          name: true,
          code: true,
          parentId: true,
          parent: { select: { id: true, name: true, code: true, parent: { select: { code: true, name: true } } } },
        },
      },
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
      category: {
        include: { parent: { select: { id: true, name: true, code: true, parent: { select: { code: true, name: true } } } } },
      },
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
