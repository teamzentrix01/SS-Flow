import { prisma } from "@/db";
import { BUSINESS_ROOTS } from "@/lib/domain/business-categories";

export async function leadProductCatalog(plantIds: string[]) {
  const roots = await prisma.productCategory.findMany({
    where: { plantId: { in: plantIds }, parentId: null, code: { in: [BUSINESS_ROOTS.trading.code, BUSINESS_ROOTS.manufactured.code] }, status: "active" },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  const products = await prisma.product.findMany({
    where: { plantId: { in: plantIds }, isActive: true, categoryId: { in: roots.map((root) => root.id) } },
    select: {
      id: true, name: true, sku: true, categoryId: true,
      variants: {
        where: { isActive: true, materialMaster: { is: { active: true, salesAllowed: true, isDemo: false } } },
        orderBy: [{ grade: "asc" }, { thicknessMm: "asc" }, { widthMm: "asc" }, { lengthMm: "asc" }, { sku: "asc" }],
        select: {
          id: true, sku: true, displayName: true, grade: true, finish: true, thicknessMm: true, widthMm: true, lengthMm: true, diameterMm: true, attributes: true,
          unit: { select: { symbol: true, isActive: true } },
          materialMaster: { select: { id: true, specs: true, uom: true, salesUom: true, grade: true, thickness: true, width: true, length: true, diameter: true, weightPerPiece: true } },
        },
      },
    },
    orderBy: [{ name: "asc" }, { sku: "asc" }],
  });
  return {
    categories: roots,
    products: products.map((product) => ({
      id: product.id, name: product.name, sku: product.sku, categoryId: product.categoryId ?? "",
      categoryName: roots.find((root) => root.id === product.categoryId)?.name ?? "",
      variants: product.variants.flatMap((variant) => {
        const materialMaster = variant.materialMaster;
        if (!materialMaster) return [];
        const attributes = variant.attributes && typeof variant.attributes === "object" && !Array.isArray(variant.attributes) ? variant.attributes as Record<string, unknown> : {};
        const saved = materialMaster.specs && typeof materialMaster.specs === "object" && !Array.isArray(materialMaster.specs) ? materialMaster.specs as Record<string, unknown> : {};
        return {
          id: variant.id, materialMasterId: materialMaster.id, sku: variant.sku,
          displayName: variant.displayName ?? [product.name, variant.grade, variant.finish, variant.thicknessMm && `${variant.thicknessMm} mm`, variant.widthMm && `${variant.widthMm} mm`, variant.lengthMm && `${variant.lengthMm} mm`].filter(Boolean).join(" · "),
          uom: variant.unit?.isActive ? variant.unit.symbol : materialMaster.salesUom ?? materialMaster.uom,
          specs: {
          ...Object.fromEntries(Object.entries(saved).filter(([key]) => key !== "seedMetadata")),
          ...Object.fromEntries(Object.entries(attributes).filter(([key]) => key !== "seedMetadata")),
            grade: variant.grade ?? materialMaster.grade ?? attributes.grade ?? saved.grade,
            finish: variant.finish ?? attributes.finish ?? saved.finish,
            thickness: variant.thicknessMm?.toString() ?? materialMaster.thickness?.toString() ?? attributes.thickness ?? saved.thickness,
            width: variant.widthMm?.toString() ?? materialMaster.width?.toString() ?? attributes.width ?? saved.width,
            length: variant.lengthMm?.toString() ?? materialMaster.length?.toString() ?? attributes.length ?? saved.length,
            diameter: variant.diameterMm?.toString() ?? materialMaster.diameter?.toString() ?? attributes.diameter ?? saved.diameter,
            weightPerPiece: materialMaster.weightPerPiece?.toString() ?? attributes.weightPerPiece ?? saved.weightPerPiece,
          },
        };
      }),
    })),
  };
}

export type LeadListFilters = {
  plantIds: string[];
  q?: string;
  status?: string;
  source?: string;
  assigneeId?: string;
  overdueFollowUp?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "createdAt" | "nextFollowUpAt" | "leadNumber";
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
