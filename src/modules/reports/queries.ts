import { prisma } from "@/db";
import { qtyText } from "@/lib/domain/qty";

export async function reportStockSummary(plantIds: string[]) {
  const rows = await prisma.stockBalance.groupBy({
    by: ["plantId"],
    where: { plantId: { in: plantIds } },
    _sum: {
      availableQty: true,
      reservedQty: true,
      qcHoldQty: true,
      wipQty: true,
      finishedQty: true,
      scrapQty: true,
      rejectedQty: true,
      inTransitQty: true,
    },
  });
  const sumQty = (key: keyof (typeof rows)[number]["_sum"]) =>
    qtyText(rows.reduce((total, row) => total + Number(row._sum[key] ?? 0), 0));
  return {
    available: sumQty("availableQty"),
    reserved: sumQty("reservedQty"),
    qcHold: sumQty("qcHoldQty"),
    wip: sumQty("wipQty"),
    finished: sumQty("finishedQty"),
    scrap: sumQty("scrapQty"),
    rejected: sumQty("rejectedQty"),
    inTransit: sumQty("inTransitQty"),
  };
}

export async function reportSalesSummary(plantIds: string[]) {
  const orders = await prisma.salesOrder.groupBy({
    by: ["status"],
    where: { plantId: { in: plantIds } },
    _count: true,
  });
  return orders.map((row) => ({ status: row.status, count: row._count }));
}

export async function reportPendingPurchase(plantIds: string[]) {
  const items = await prisma.purchaseOrderItem.findMany({
    where: { order: { plantId: { in: plantIds }, status: { in: ["approved", "partial"] } } },
    include: { order: { include: { supplier: true } } },
    take: 100,
  });
  return items.map((item) => ({
    orderId: item.orderId,
    po: item.order.number,
    supplier: item.order.supplier.name,
    material: item.description,
    pending: qtyText(Number(item.qty) - Number(item.receivedQty)),
  }));
}

export async function reportJobsByStatus(plantIds: string[]) {
  return prisma.jobCard.groupBy({
    by: ["status"],
    where: { plantId: { in: plantIds } },
    _count: true,
  });
}
