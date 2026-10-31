import { prisma } from "@/db";
import { BUSINESS_ROOTS } from "@/lib/domain/business-categories";
import { MERGED_PRODUCT_SKUS } from "@/lib/domain/product-spec-fields";

export async function leadProductCatalog(plantIds: string[]) {
  const primaryPlantId = plantIds[0];

  // 1. Fetch root categories for both TRADING and MFG across the provided plants
  const roots = await prisma.productCategory.findMany({
    where: {
      plantId: { in: plantIds },
      parentId: null,
      code: { in: [BUSINESS_ROOTS.trading.code, BUSINESS_ROOTS.manufactured.code] },
      status: "active",
    },
    select: { id: true, name: true, code: true, plantId: true },
    orderBy: { name: "asc" },
  });

  // 2. Fetch all active categories to support subcategories under TRADING / MFG
  const allCategories = await prisma.productCategory.findMany({
    where: { plantId: { in: plantIds }, status: "active" },
    select: { id: true, name: true, code: true, parentId: true, plantId: true },
  });

  // Build map of categoryId -> business root code ("TRADING" | "MFG")
  const categoryRootCodeMap = new Map<string, string>();
  for (const cat of allCategories) {
    let current: typeof cat | undefined = cat;
    while (current) {
      if (current.code === BUSINESS_ROOTS.trading.code) {
        categoryRootCodeMap.set(cat.id, BUSINESS_ROOTS.trading.code);
        break;
      }
      if (current.code === BUSINESS_ROOTS.manufactured.code) {
        categoryRootCodeMap.set(cat.id, BUSINESS_ROOTS.manufactured.code);
        break;
      }
      current = allCategories.find((c) => c.id === current?.parentId);
    }
  }

  // Deduplicate roots so the UI has exactly one option for "Trading Products" and one for "Manufactured Products"
  const categoryByCode = new Map<string, { id: string; name: string; code: string }>();
  for (const root of roots) {
    if (!categoryByCode.has(root.code) || root.plantId === primaryPlantId) {
      categoryByCode.set(root.code, { id: root.id, name: root.name, code: root.code });
    }
  }
  const uiCategories = Array.from(categoryByCode.values()).sort((a, b) => a.name.localeCompare(b.name));

  // 3. Query all active products in the plant(s)
  const products = await prisma.product.findMany({
    where: {
      plantId: { in: plantIds },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      categoryId: true,
      plantId: true,
      category: { select: { id: true, name: true, code: true, parentId: true } },
      variants: {
        where: { isActive: true },
        orderBy: [{ grade: "asc" }, { thicknessMm: "asc" }, { widthMm: "asc" }, { lengthMm: "asc" }, { sku: "asc" }],
        select: {
          id: true,
          sku: true,
          displayName: true,
          grade: true,
          finish: true,
          thicknessMm: true,
          widthMm: true,
          lengthMm: true,
          diameterMm: true,
          attributes: true,
          unit: { select: { symbol: true, isActive: true } },
          materialMaster: {
            select: {
              id: true,
              specs: true,
              uom: true,
              salesUom: true,
              grade: true,
              thickness: true,
              width: true,
              length: true,
              diameter: true,
              weightPerPiece: true,
            },
          },
        },
      },
    },
    orderBy: [{ name: "asc" }, { sku: "asc" }],
  });

  // Helper to determine business kind if category link is missing or indirect
  function inferBusinessCode(sku: string, name: string): string | null {
    const s = sku.trim().toUpperCase();
    const n = name.trim().toLowerCase();
    if (s.startsWith("SSM-TRD-") || ["WIRE", "SHEET", "ROD", "COIL"].includes(s) || /^(wire|sheet|rod|coil)/.test(n)) {
      return BUSINESS_ROOTS.trading.code;
    }
    if (
      s.startsWith("SSM-MFG-") ||
      ["CIRCLE", "FARMA", "FARMA-1"].includes(s) ||
      /^(circle|farma|laser cut farma|semi finish)/.test(n)
    ) {
      return BUSINESS_ROOTS.manufactured.code;
    }
    return null;
  }

  // Canonical product key for distinct grouping
  function canonicalProductKey(name: string, sku: string): string {
    const n = name.trim().toLowerCase();
    const s = sku.trim().toUpperCase();
    if (/laser cut farma/i.test(n) || s === "SSM-MFG-LASER-FARMA") return "laser_cut_farma";
    if (/semi[\s_-]*finish/i.test(n) || s.startsWith("SSM-MFG-SEMI-FINISH")) return "semi_finish_utensils";
    if (n === "farma" || s === "SSM-MFG-FARMA" || s === "FARMA" || s === "FARMA-1") return "farma";
    if (n === "circle" || s === "SSM-MFG-CIRCLE" || s === "CIRCLE") return "circle";
    if (n === "wire" || s === "SSM-TRD-WIRE" || s === "WIRE") return "wire";
    if (n === "sheet" || s === "SSM-TRD-SHEET" || s === "SHEET") return "sheet";
    if (n === "rod" || s === "SSM-TRD-ROD" || s === "ROD") return "rod";
    if (n === "coil" || s === "SSM-TRD-COIL" || s === "COIL") return "coil";
    return `${s}:${n}`;
  }

  const retiredSkus = new Set(Object.keys(MERGED_PRODUCT_SKUS));

  // Map and deduplicate products
  const productMap = new Map<string, typeof products[number]>();

  for (const prod of products) {
    if (retiredSkus.has(prod.sku)) continue;
    const businessCode =
      (prod.categoryId ? categoryRootCodeMap.get(prod.categoryId) : null) ??
      (prod.category?.code === BUSINESS_ROOTS.trading.code || prod.category?.code === BUSINESS_ROOTS.manufactured.code
        ? prod.category.code
        : null) ??
      inferBusinessCode(prod.sku, prod.name);

    if (!businessCode) continue;

    const key = `${businessCode}:${canonicalProductKey(prod.name, prod.sku)}`;
    const existing = productMap.get(key);

    if (!existing) {
      productMap.set(key, prod);
    } else {
      const existingIsPrimary = existing.plantId === primaryPlantId;
      const currentIsPrimary = prod.plantId === primaryPlantId;
      if (!existingIsPrimary && currentIsPrimary) {
        productMap.set(key, prod);
      } else if (existingIsPrimary === currentIsPrimary && prod.variants.length > existing.variants.length) {
        productMap.set(key, prod);
      }
    }
  }

  const distinctProducts = Array.from(productMap.values());

  return {
    categories: uiCategories,
    products: distinctProducts.map((product) => {
      const businessCode =
        (product.categoryId ? categoryRootCodeMap.get(product.categoryId) : null) ??
        (product.category?.code === BUSINESS_ROOTS.trading.code ||
        product.category?.code === BUSINESS_ROOTS.manufactured.code
          ? product.category.code
          : null) ??
        inferBusinessCode(product.sku, product.name);

      const uiCat = (businessCode ? categoryByCode.get(businessCode) : undefined) ?? uiCategories[0];

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        categoryId: uiCat ? uiCat.id : (product.categoryId ?? ""),
        categoryName: uiCat ? uiCat.name : "",
        variants: product.variants.map((variant) => {
          const materialMaster = variant.materialMaster;
          const attributes =
            variant.attributes && typeof variant.attributes === "object" && !Array.isArray(variant.attributes)
              ? (variant.attributes as Record<string, unknown>)
              : {};
          const saved =
            materialMaster?.specs && typeof materialMaster.specs === "object" && !Array.isArray(materialMaster.specs)
              ? (materialMaster.specs as Record<string, unknown>)
              : {};
          return {
            id: variant.id,
            materialMasterId: materialMaster?.id ?? variant.id,
            sku: variant.sku,
            displayName:
              variant.displayName ??
              [
                product.name,
                variant.grade,
                variant.finish,
                variant.thicknessMm && `${variant.thicknessMm} mm`,
                variant.widthMm && `${variant.widthMm} mm`,
                variant.lengthMm && `${variant.lengthMm} mm`,
              ]
                .filter(Boolean)
                .join(" · "),
            uom: variant.unit?.isActive ? variant.unit.symbol : materialMaster?.salesUom ?? materialMaster?.uom ?? "PCS",
            specs: {
              ...Object.fromEntries(Object.entries(saved).filter(([key]) => key !== "seedMetadata")),
              ...Object.fromEntries(Object.entries(attributes).filter(([key]) => key !== "seedMetadata")),
              grade: variant.grade ?? materialMaster?.grade ?? attributes.grade ?? saved.grade,
              finish: variant.finish ?? attributes.finish ?? saved.finish,
              thickness:
                variant.thicknessMm?.toString() ??
                materialMaster?.thickness?.toString() ??
                attributes.thickness ??
                saved.thickness,
              width: variant.widthMm?.toString() ?? materialMaster?.width?.toString() ?? attributes.width ?? saved.width,
              length:
                variant.lengthMm?.toString() ?? materialMaster?.length?.toString() ?? attributes.length ?? saved.length,
              diameter:
                variant.diameterMm?.toString() ??
                materialMaster?.diameter?.toString() ??
                attributes.diameter ??
                saved.diameter,
              weightPerPiece:
                materialMaster?.weightPerPiece?.toString() ?? attributes.weightPerPiece ?? saved.weightPerPiece,
            },
          };
        }),
      };
    }),
  };
}

export type LeadListFilters = {
  plantIds: string[];
  q?: string;
  status?: string;
  source?: string;
  assigneeId?: string;
  overdueFollowUp?: boolean;
  unconfirmedPromised?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "createdAt" | "nextFollowUpAt" | "leadNumber" | "requiredDeliveryDate" | "promisedDeliveryDate";
  dir?: "asc" | "desc";
};

export async function leadDashboardStats(plantIds: string[]) {
  const [byStatus, bySource, byAssignee, overdue] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      where: { plantId: { in: plantIds }, deletedAt: null },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["source"],
      where: { plantId: { in: plantIds }, deletedAt: null },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["assigneeId"],
      where: { plantId: { in: plantIds }, deletedAt: null, assigneeId: { not: null } },
      _count: true,
    }),
    prisma.lead.count({
      where: {
        plantId: { in: plantIds },
        deletedAt: null,
        nextFollowUpAt: { lt: new Date() },
        status: { notIn: ["CONVERTED", "LOST", "REJECTED"] },
      },
    }),
  ]);

  const assigneeIds = byAssignee.map((row) => row.assigneeId).filter((id): id is string => Boolean(id));
  const assignees = assigneeIds.length
    ? await prisma.employee.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
    : [];

  return {
    byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count])),
    bySource: Object.fromEntries(bySource.map((row) => [row.source, row._count])),
    byAssignee: byAssignee.map((row) => ({
      assigneeId: row.assigneeId,
      count: row._count,
      name: assignees.find((employee) => employee.id === row.assigneeId)?.name ?? "—",
    })),
    overdueFollowUps: overdue,
  };
}

export async function listLeads(filters: LeadListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(10, filters.pageSize ?? 20));
  const where = {
    plantId: { in: filters.plantIds },
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.overdueFollowUp
      ? {
          nextFollowUpAt: { lt: new Date() },
          status: { notIn: ["CONVERTED", "LOST", "REJECTED"] },
        }
      : {}),
    ...(filters.unconfirmedPromised
      ? {
          promisedDeliveryDate: null,
          requiredDeliveryDate: { not: null },
          status: { notIn: ["CONVERTED", "LOST", "REJECTED"] },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { leadNumber: { contains: filters.q, mode: "insensitive" as const } },
            { customerName: { contains: filters.q, mode: "insensitive" as const } },
            { phone: { contains: filters.q } },
            { email: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    filters.sort === "nextFollowUpAt"
      ? { nextFollowUpAt: filters.dir ?? "asc" }
      : filters.sort === "leadNumber"
        ? { leadNumber: filters.dir ?? "desc" }
        : filters.sort === "requiredDeliveryDate"
          ? { requiredDeliveryDate: filters.dir ?? "asc" }
          : filters.sort === "promisedDeliveryDate"
            ? { promisedDeliveryDate: filters.dir ?? "asc" }
            : { createdAt: filters.dir ?? "desc" };

  const [total, rows] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        customer: { select: { id: true, code: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, page, pageSize, rows };
}

export async function leadDetail(id: string, plantIds: string[]) {
  return prisma.lead.findFirst({
    where: { id, plantId: { in: plantIds }, deletedAt: null },
    include: {
      assignee: true,
      attendedBy: true,
      customer: true,
      salesOrder: { select: { id: true, number: true, status: true } },
      items: {
        include: {
          product: { 
            select: { 
              id: true, 
              name: true, 
              code: true, 
              sellingPrice: true,
                  grade: true,
                  thickness: true,
                  width: true,
                  length: true,
                  weightPerPiece: true,
              productCategory: { select: { id: true, code: true, name: true } }
            } 
          },
          productVariant: { select: { id: true, sku: true } },
          unit: { select: { id: true, symbol: true } },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { performedBy: { select: { id: true, name: true } } },
        take: 50,
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: { changedBy: { select: { id: true, name: true } } },
      },
      verifiedBy: { select: { id: true, name: true } },
      convertedBy: { select: { id: true, name: true } },
      customerNotifications: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
}
