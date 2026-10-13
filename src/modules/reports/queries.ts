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
    },
  });
  const sum = rows[0]?._sum;
  return {
    available: qtyText(sum?.availableQty),
    reserved: qtyText(sum?.reservedQty),
    qcHold: qtyText(sum?.qcHoldQty),
    wip: qtyText(sum?.wipQty),
    finished: qtyText(sum?.finishedQty),
    scrap: qtyText(sum?.scrapQty),
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
