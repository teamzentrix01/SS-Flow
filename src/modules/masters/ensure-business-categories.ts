import type { Prisma, PrismaClient } from "@prisma/client";
import {
  BUSINESS_KIND,
  BUSINESS_ROOTS,
  inferBusinessKindForExistingCategory,
  isAmbiguousCircleProduct,
  isBusinessRootCode,
  type BusinessKind,
} from "@/lib/domain/business-categories";
import { uuidv7 } from "@/lib/ids";

type Db = PrismaClient | Prisma.TransactionClient;

export type BusinessCategoryEnsureReport = {
  plants: number;
  rootsCreated: string[];
  categoriesReparented: { code: string; plantCode: string; kind: BusinessKind }[];
  productsAligned: { sku: string; plantCode: string; supplyMode: string }[];
  materialsAligned: { code: string; plantCode: string; purchaseAllowed: boolean; manufacturingAllowed: boolean }[];
  flagged: { sku?: string; code?: string; name: string; reason: string }[];
};

async function upsertRoot(db: Db, plantId: string, kind: BusinessKind) {
  const spec = BUSINESS_ROOTS[kind];
  const existing = await db.productCategory.findFirst({
    where: { plantId, code: spec.code },
  });
  if (existing) {
    await db.productCategory.update({
      where: { id: existing.id },
      data: {
        name: spec.name,
        subtitle: spec.subtitle,
        description: spec.description,
        categoryType: spec.categoryType,
        parentId: null,
        status: "active",
      },
    });
    return { id: existing.id, created: false, code: spec.code };
  }
  const created = await db.productCategory.create({
    data: {
      id: uuidv7(),
      plantId,
      code: spec.code,
      name: spec.name,
      subtitle: spec.subtitle,
      description: spec.description,
      categoryType: spec.categoryType,
      parentId: null,
      status: "active",
    },
  });
  return { id: created.id, created: true, code: spec.code };
}

export async function ensureBusinessCategories(db: Db): Promise<BusinessCategoryEnsureReport> {
  const report: BusinessCategoryEnsureReport = {
    plants: 0,
    rootsCreated: [],
    categoriesReparented: [],
    productsAligned: [],
    materialsAligned: [],
    flagged: [],
  };

  const plants = await db.plant.findMany({ select: { id: true, code: true } });
  report.plants = plants.length;

  for (const plant of plants) {
    const trading = await upsertRoot(db, plant.id, BUSINESS_KIND.trading);
    const manufactured = await upsertRoot(db, plant.id, BUSINESS_KIND.manufactured);
    if (trading.created) report.rootsCreated.push(`${plant.code}:${trading.code}`);
    if (manufactured.created) report.rootsCreated.push(`${plant.code}:${manufactured.code}`);

    const roots = {
      trading: trading.id,
      manufactured: manufactured.id,
    };

    const categories = await db.productCategory.findMany({
      where: { plantId: plant.id },
      select: { id: true, code: true, name: true, parentId: true, categoryType: true, productForm: true },
    });

    for (const category of categories) {
      if (isBusinessRootCode(category.code)) continue;
      if (category.parentId) continue;
      const kind = inferBusinessKindForExistingCategory(category);
      await db.productCategory.update({
        where: { id: category.id },
        data: { parentId: roots[kind] },
      });
      report.categoriesReparented.push({ code: category.code, plantCode: plant.code, kind });
    }

    const products = await db.product.findMany({
      where: { plantId: plant.id },
      include: { category: { select: { code: true, name: true } } },
    });

    for (const product of products) {
      if (isAmbiguousCircleProduct(product)) {
        report.flagged.push({
          sku: product.sku,
          name: product.name,
          reason: "Circle is semi-finished with supply mode 'both'. Nested under Manufactured via Semi-Finished, but not locked to manufactured-only.",
        });
        continue;
      }
      if (product.sku.toUpperCase() === "FARMA" && product.supplyMode !== "manufactured") {
        await db.product.update({
          where: { id: product.id },
          data: { supplyMode: "manufactured" },
        });
        report.productsAligned.push({ sku: product.sku, plantCode: plant.code, supplyMode: "manufactured" });
      }
    }

    const materials = await db.materialMaster.findMany({
      where: { plantId: plant.id },
      include: {
        productCategory: { select: { code: true, name: true, parentId: true, categoryType: true, productForm: true } },
        productVariant: { select: { product: { select: { sku: true, name: true, supplyMode: true } } } },
        _count: { select: { boms: true, purchaseOrderItems: true, orders: true } },
      },
    });

    for (const material of materials) {
      const linked = material.productVariant?.product;
      if (linked && isAmbiguousCircleProduct(linked)) {
        report.flagged.push({
          code: material.code,
          name: material.name,
          reason: "Linked to Circle; supply flags left unchanged pending confirmation.",
        });
        continue;
      }

      const kind = material.productCategory
        ? inferBusinessKindForExistingCategory(material.productCategory)
        : inferBusinessKindForExistingCategory({
            code: linked?.sku ?? material.category,
            name: linked?.name ?? material.name,
            categoryType:
              material.productType === "raw_material"
                ? "raw_material"
                : material.productType === "semi_finished"
                  ? "wip"
                  : material.productType === "consumable"
                    ? "consumable"
                    : "finished_goods",
          });

      const hasProduction = material._count.boms > 0 || material._count.orders > 0;
      const hasPurchases = material._count.purchaseOrderItems > 0;
      let purchaseAllowed = material.purchaseAllowed;
      let manufacturingAllowed = material.manufacturingAllowed;

      if (kind === BUSINESS_KIND.trading && !hasProduction) {
        manufacturingAllowed = false;
      }
      if (kind === BUSINESS_KIND.manufactured && !hasPurchases) {
        purchaseAllowed = false;
      }

      if (purchaseAllowed !== material.purchaseAllowed || manufacturingAllowed !== material.manufacturingAllowed) {
        await db.materialMaster.update({
          where: { id: material.id },
          data: { purchaseAllowed, manufacturingAllowed },
        });
        report.materialsAligned.push({
          code: material.code,
          plantCode: plant.code,
          purchaseAllowed,
          manufacturingAllowed,
        });
      }
    }
  }

  const pcsAsProduct = await db.product.findMany({
    where: { OR: [{ sku: { equals: "PCS", mode: "insensitive" } }, { name: { equals: "PCS", mode: "insensitive" } }] },
    select: { sku: true, name: true },
  });
  if (!pcsAsProduct.length) {
    report.flagged.push({
      name: "PCS",
      reason: "PCS is used as a unit of measure (e.g. utensils), not as a separate product family. No PCS product type was created.",
    });
  }

  return report;
}
