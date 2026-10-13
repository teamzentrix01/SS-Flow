import type { SessionUser } from "@/lib/auth/session";
import { primaryPlant } from "@/lib/access";
import { defaultUomForCategory } from "@/lib/domain/material-conventions";
import {
  LEGACY_MATERIAL_CATEGORIES,
  PRODUCT_TYPES,
  legacyCategoryFromProductType,
  productTypeFromLegacyCategory,
  type ProductType,
} from "@/lib/domain/master-entities";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, nextNumber, runCommand } from "@/lib/inventory/post";
import { allow } from "@/modules/shared/allow";

export type CreateProductInput = {
  code?: string;
  name: string;
  category?: string;
  categoryId?: string;
  productType?: ProductType;
  shape: string;
  description?: string;
  brand?: string;
  hsnCode?: string;
  grade?: string;
  thickness?: string;
  width?: string;
  length?: string;
  diameter?: string;
  weightPerPiece?: string;
  standardScrapPct?: string;
  uom?: string;
  purchaseUom?: string;
  salesUom?: string;
  uomConversionFactor?: string;
  minStockLevel?: string;
  reorderLevel?: string;
  batchTracking?: boolean;
  serialTracking?: boolean;
  defaultBomHeaderId?: string;
  defaultRoutingId?: string;
  purchaseAllowed?: boolean;
  salesAllowed?: boolean;
  manufacturingAllowed?: boolean;
  defaultSupplierId?: string;
  purchasePrice?: string;
  sellingPrice?: string;
  taxRate?: string;
  specs?: Record<string, unknown>;
  status?: "active" | "inactive";
};

function resolveProductType(input: CreateProductInput): ProductType {
  if (input.productType && PRODUCT_TYPES.includes(input.productType)) return input.productType;
  if (input.category && LEGACY_MATERIAL_CATEGORIES.includes(input.category as (typeof LEGACY_MATERIAL_CATEGORIES)[number])) {
    return productTypeFromLegacyCategory(input.category);
  }
  throw new AppError(400, "VALIDATION", "Choose a product type or legacy category.");
}

export async function createMaterial(session: SessionUser, input: CreateProductInput, key: string | null) {
  allow(session, "plant.manage");
  const plantId = primaryPlant(session);
  const productType = resolveProductType(input);
  const legacyCategory =
    input.category && LEGACY_MATERIAL_CATEGORIES.includes(input.category as (typeof LEGACY_MATERIAL_CATEGORIES)[number])
      ? input.category
      : legacyCategoryFromProductType(productType);

  return runCommand({
    userId: session.userId,
    route: "material.create",
    key,
    run: async (tx) => {
      const code = input.code?.trim() || (await nextNumber(tx, plantId, "MAT"));
      const duplicate = await tx.materialMaster.findFirst({
        where: { plantId, code: { equals: code, mode: "insensitive" } },
      });
      if (duplicate) throw new AppError(409, "DUPLICATE", "Product code already exists.");

      if (input.categoryId) {
        const cat = await tx.productCategory.findFirst({ where: { id: input.categoryId, plantId } });
        if (!cat) throw new AppError(404, "NOT_FOUND", "Product category was not found.");
      }
      if (input.defaultBomHeaderId) {
        const bom = await tx.bomHeader.findFirst({ where: { id: input.defaultBomHeaderId, plantId } });
        if (!bom) throw new AppError(404, "NOT_FOUND", "Default BOM was not found.");
      }
      if (input.defaultRoutingId) {
        const routing = await tx.routingHeader.findFirst({ where: { id: input.defaultRoutingId, plantId } });
        if (!routing) throw new AppError(404, "NOT_FOUND", "Default routing was not found.");
      }

      const material = await tx.materialMaster.create({
        data: {
          id: uuidv7(),
          plantId,
          code,
          name: input.name.trim(),
          category: legacyCategory,
          categoryId: input.categoryId || null,
          productType,
          shape: input.shape.trim(),
          description: input.description?.trim() || null,
          brand: input.brand?.trim() || null,
          hsnCode: input.hsnCode?.trim() || null,
          grade: input.grade?.trim() || null,
          thickness: input.thickness || null,
          width: input.width || null,
          length: input.length || null,
          diameter: input.diameter || null,
          weightPerPiece: input.weightPerPiece || null,
          standardScrapPct: input.standardScrapPct || null,
          uom: input.uom?.trim() || defaultUomForCategory(legacyCategory),
          purchaseUom: input.purchaseUom?.trim() || null,
          salesUom: input.salesUom?.trim() || null,
          uomConversionFactor: input.uomConversionFactor || null,
          minStockLevel: input.minStockLevel || null,
          reorderLevel: input.reorderLevel || null,
          batchTracking: input.batchTracking ?? true,
          serialTracking: input.serialTracking ?? false,
          defaultBomHeaderId: input.defaultBomHeaderId || null,
          defaultRoutingId: input.defaultRoutingId || null,
          purchaseAllowed: input.purchaseAllowed ?? true,
          salesAllowed: input.salesAllowed ?? true,
          manufacturingAllowed: input.manufacturingAllowed ?? true,
          defaultSupplierId: input.defaultSupplierId || null,
          purchasePrice: input.purchasePrice || null,
          sellingPrice: input.sellingPrice || null,
          taxRate: input.taxRate || null,
          active: input.status !== "inactive",
          specs: (input.specs ?? {}) as object,
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "material.create",
        resource: "material",
        resourceId: material.id,
      });
      return { id: material.id, code: material.code };
    },
  });
}

export async function updateMaterial(
  session: SessionUser,
  id: string,
  input: CreateProductInput & { code: string },
  key: string | null,
) {
  allow(session, "plant.manage");
  const plantId = primaryPlant(session);
  const productType = resolveProductType(input);
  const legacyCategory =
    input.category && LEGACY_MATERIAL_CATEGORIES.includes(input.category as (typeof LEGACY_MATERIAL_CATEGORIES)[number])
      ? input.category
      : legacyCategoryFromProductType(productType);

  return runCommand({
    userId: session.userId,
    route: "material.update",
    key,
    run: async (tx) => {
      const existing = await tx.materialMaster.findFirst({ where: { id, plantId } });
      if (!existing) throw new AppError(404, "NOT_FOUND", "Product was not found.");
      const code = input.code.trim();
      const duplicate = await tx.materialMaster.findFirst({
        where: { plantId, id: { not: id }, code: { equals: code, mode: "insensitive" } },
      });
      if (duplicate) throw new AppError(409, "DUPLICATE", "Product code already exists.");
      if (input.categoryId) {
        const cat = await tx.productCategory.findFirst({ where: { id: input.categoryId, plantId } });
        if (!cat) throw new AppError(404, "NOT_FOUND", "Product category was not found.");
      }
      const material = await tx.materialMaster.update({
        where: { id },
        data: {
          code,
          name: input.name.trim(),
          category: legacyCategory,
          categoryId: input.categoryId || null,
          productType,
          shape: input.shape.trim(),
          description: input.description?.trim() || null,
          grade: input.grade?.trim() || null,
          thickness: input.thickness || null,
          width: input.width || null,
          uom: input.uom?.trim() || existing.uom,
          batchTracking: input.batchTracking ?? existing.batchTracking,
          active: input.status !== "inactive",
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "material.update",
        resource: "material",
        resourceId: material.id,
      });
      return { id: material.id };
    },
  });
}
