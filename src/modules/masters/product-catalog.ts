import { prisma } from "@/db";

export async function listUnits(plantIds: string[]) {
  return prisma.unitOfMeasure.findMany({
    where: { plantId: { in: plantIds }, isActive: true },
    orderBy: { name: "asc" },
  });
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
    orderBy: { name: "asc" },
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
