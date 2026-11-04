import { prisma } from "@/db";
import { lostReasonLabel } from "@/modules/leads/lost-reason";

export type LeadReportInput = {
  plantIds: string[];
  assigneeId?: string;
  from?: Date;
  to?: Date;
};

function leadWhere(input: LeadReportInput) {
  return {
    plantId: { in: input.plantIds },
    deletedAt: null,
    ...(input.assigneeId ? { assigneeId: input.assigneeId } : {}),
    ...(input.from || input.to
      ? {
          createdAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lte: input.to } : {}),
          },
        }
      : {}),
  };
}

function avg(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function daysBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

export async function reportLeadAnalytics(input: LeadReportInput) {
  const where = leadWhere(input);
  const leadIds = await prisma.lead.findMany({ where, select: { id: true } });
  const ids = leadIds.map((row) => row.id);

  const [
    byStatus,
    bySource,
    convertedBySource,
    lostByCode,
    assigneeGroups,
    responseSample,
    quotations,
    convertedLeads,
  ] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where, _count: true }),
    prisma.lead.groupBy({ by: ["source"], where, _count: true }),
    prisma.lead.groupBy({
      by: ["source"],
      where: { ...where, status: "CONVERTED" },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["lostReasonCode", "status"],
      where: { ...where, status: { in: ["LOST", "REJECTED"] }, lostReasonCode: { not: null } },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["assigneeId", "status"],
      where: { ...where, assigneeId: { not: null } },
      _count: true,
    }),
    prisma.lead.findMany({
      where: { ...where, firstResponseMinutes: { not: null } },
      select: { firstResponseMinutes: true },
    }),
    ids.length
      ? prisma.quotation.findMany({
          where: { leadId: { in: ids }, status: { in: ["SENT", "ACCEPTED", "SUPERSEDED", "EXPIRED"] } },
          select: { leadId: true, sentAt: true, status: true },
          orderBy: { sentAt: "asc" },
        })
      : Promise.resolve([]),
    prisma.lead.findMany({
      where: { ...where, status: "CONVERTED", convertedAt: { not: null } },
      select: {
        id: true,
        convertedAt: true,
        source: true,
        assigneeId: true,
        salesOrder: {
          select: {
            items: {
              select: {
                qtyOrdered: true,
                unitPrice: true,
                uom: true,
                product: { select: { productCategory: { select: { id: true, name: true } } } },
              },
            },
          },
        },
        items: {
          select: {
            quantity: true,
            uom: true,
            estimatedWeight: true,
            product: { select: { productCategory: { select: { id: true, name: true } } } },
          },
        },
      },
    }),
  ]);

  const totalLeads = ids.length;
  const funnel = Object.fromEntries(byStatus.map((row) => [row.status, row._count]));

  const leadsWithSentQuote = new Set(quotations.map((q) => q.leadId));
  const quotedLeadCount = leadsWithSentQuote.size;
  const convertedCount = funnel.CONVERTED ?? 0;

  const firstSentByLead = new Map<string, Date>();
  for (const quote of quotations) {
    if (!quote.sentAt) continue;
    if (!firstSentByLead.has(quote.leadId)) firstSentByLead.set(quote.leadId, quote.sentAt);
  }

  const quoteToCloseDays: number[] = [];
  for (const lead of convertedLeads) {
    if (!lead.convertedAt) continue;
    const firstSent = firstSentByLead.get(lead.id);
    if (firstSent) quoteToCloseDays.push(daysBetween(firstSent, lead.convertedAt));
  }

  const sourceConversion = bySource.map((row) => {
    const won = convertedBySource.find((c) => c.source === row.source)?._count ?? 0;
    return {
      source: row.source,
      leads: row._count,
      converted: won,
      conversionRate: row._count ? Math.round((won / row._count) * 1000) / 10 : 0,
    };
  });

  const lostReasonBreakdown = lostByCode.map((row) => ({
    status: row.status,
    code: row.lostReasonCode!,
    label: lostReasonLabel(row.lostReasonCode!, row.status as "LOST" | "REJECTED"),
    count: row._count,
  }));

  const assigneeIds = [...new Set(assigneeGroups.map((row) => row.assigneeId).filter(Boolean))] as string[];
  const assigneeNames = assigneeIds.length
    ? await prisma.employee.findMany({ where: { id: { in: assigneeIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(assigneeNames.map((row) => [row.id, row.name]));

  const assigneeStats = new Map<
    string,
    { assigneeId: string; name: string; total: number; converted: number; lost: number; rejected: number }
  >();
  for (const row of assigneeGroups) {
    if (!row.assigneeId) continue;
    const current = assigneeStats.get(row.assigneeId) ?? {
      assigneeId: row.assigneeId,
      name: nameById.get(row.assigneeId) ?? "—",
      total: 0,
      converted: 0,
      lost: 0,
      rejected: 0,
    };
    current.total += row._count;
    if (row.status === "CONVERTED") current.converted += row._count;
    if (row.status === "LOST") current.lost += row._count;
    if (row.status === "REJECTED") current.rejected += row._count;
    assigneeStats.set(row.assigneeId, current);
  }

  let orderValueWon = 0;
  let tonnageKg = 0;
  const categoryWins = new Map<string, { categoryId: string; categoryName: string; convertedLeads: number; lineCount: number }>();

  for (const lead of convertedLeads) {
    const categoriesOnLead = new Set<string>();
    if (lead.salesOrder?.items.length) {
      for (const line of lead.salesOrder.items) {
        const qty = Number(line.qtyOrdered.toString());
        const price = Number(line.unitPrice.toString());
        orderValueWon += qty * price;
        const uom = line.uom.toUpperCase();
        if (uom === "KG" || uom === "KGS") tonnageKg += qty;
        const cat = line.product.productCategory;
        if (cat) {
          categoriesOnLead.add(cat.id);
          const bucket = categoryWins.get(cat.id) ?? {
            categoryId: cat.id,
            categoryName: cat.name,
            convertedLeads: 0,
            lineCount: 0,
          };
          bucket.lineCount += 1;
          categoryWins.set(cat.id, bucket);
        }
      }
    } else {
      for (const item of lead.items) {
        const qty = Number(item.quantity.toString());
        const uom = item.uom.toUpperCase();
        if (item.estimatedWeight) tonnageKg += Number(item.estimatedWeight.toString());
        else if (uom === "KG" || uom === "KGS") tonnageKg += qty;
        const cat = item.product?.productCategory;
        if (cat) {
          categoriesOnLead.add(cat.id);
          const bucket = categoryWins.get(cat.id) ?? {
            categoryId: cat.id,
            categoryName: cat.name,
            convertedLeads: 0,
            lineCount: 0,
          };
          bucket.lineCount += 1;
          categoryWins.set(cat.id, bucket);
        }
      }
    }
    for (const catId of categoriesOnLead) {
      const bucket = categoryWins.get(catId);
      if (bucket) bucket.convertedLeads += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      assigneeId: input.assigneeId ?? null,
      from: input.from?.toISOString() ?? null,
      to: input.to?.toISOString() ?? null,
    },
    totals: {
      leads: totalLeads,
      quotedLeads: quotedLeadCount,
      convertedLeads: convertedCount,
      leadToQuoteRate: totalLeads ? Math.round((quotedLeadCount / totalLeads) * 1000) / 10 : 0,
      quoteToOrderRate: quotedLeadCount ? Math.round((convertedCount / quotedLeadCount) * 1000) / 10 : 0,
      avgFirstResponseMinutes: avg(responseSample.map((row) => row.firstResponseMinutes ?? 0)),
      avgQuoteToCloseDays: avg(quoteToCloseDays),
      orderValueWon: Math.round(orderValueWon * 100) / 100,
      tonnageKg: Math.round(tonnageKg * 1000) / 1000,
    },
    funnel,
    sourceConversion,
    lostReasonBreakdown,
    assigneePerformance: [...assigneeStats.values()].sort((a, b) => b.total - a.total),
    categoryConversion: [...categoryWins.values()].sort((a, b) => b.convertedLeads - a.convertedLeads),
  };
}
