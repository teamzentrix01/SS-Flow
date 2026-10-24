import { prisma } from "@/db";

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
      where: { plantId: { in: plantIds } },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["source"],
      where: { plantId: { in: plantIds } },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["assigneeId"],
      where: { plantId: { in: plantIds }, assigneeId: { not: null } },
      _count: true,
    }),
    prisma.lead.count({
      where: {
        plantId: { in: plantIds },
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
    where: { id, plantId: { in: plantIds } },
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
