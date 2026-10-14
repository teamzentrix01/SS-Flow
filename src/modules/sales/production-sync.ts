import type { Prisma } from "@prisma/client";
import { uuidv7 } from "@/lib/ids";

type Tx = Prisma.TransactionClient;

async function recordSalesStatus(
  tx: Tx,
  orderId: string,
  userId: string,
  fromStatus: string,
  toStatus: string,
  remarks?: string,
) {
  await tx.salesOrderStatusEvent.create({
    data: { id: uuidv7(), orderId, fromStatus, toStatus, remarks, userId },
  });
  await tx.salesOrder.update({ where: { id: orderId }, data: { status: toStatus } });
}

/** Move SO to production once every job card for the order has an assignee. */
export async function advanceSalesOrderWhenJobsAssigned(
  tx: Tx,
  salesOrderId: string,
  userId: string,
) {
  const order = await tx.salesOrder.findUnique({ where: { id: salesOrderId } });
  if (!order || order.status !== "material_planning") return;

  const jobs = await tx.jobCard.findMany({
    where: { salesOrderId, status: { not: "cancelled" } },
  });
  if (!jobs.length) return;
  if (!jobs.every((job) => job.assigneeId)) return;

  await recordSalesStatus(
    tx,
    salesOrderId,
    userId,
    order.status,
    "production",
    "All job cards assigned — shop floor can start.",
  );
}

/** Roll up finished good qty to the sales line when a production order completes. */
export async function syncSalesLineWhenProductionCompletes(
  tx: Tx,
  productionOrderId: string,
  producedQty: string,
  userId: string,
) {
  const mo = await tx.productionOrder.findUnique({
    where: { id: productionOrderId },
    include: { salesOrderItem: { include: { order: true } } },
  });
  if (!mo?.salesOrderItemId || !mo.salesOrderItem) return;

  await tx.productionOrder.update({
    where: { id: productionOrderId },
    data: { completedQty: producedQty, status: "completed" },
  });

  const line = mo.salesOrderItem;
  const nextProduced = (Number(line.qtyProduced.toString()) + Number(producedQty)).toString();
  await tx.salesOrderItem.update({
    where: { id: line.id },
    data: { qtyProduced: nextProduced },
  });

  const order = line.order;
  const items = await tx.salesOrderItem.findMany({ where: { orderId: order.id } });
  const allLinesMet = items.every(
    (row) => Number(row.qtyProduced.toString()) >= Number(row.qtyOrdered.toString()),
  );
  if (!allLinesMet || order.status === "cancelled") return;

  const dispatchable = ["production", "material_planning"];
  if (!dispatchable.includes(order.status) && order.status !== "partially_dispatched") return;

  await recordSalesStatus(
    tx,
    order.id,
    userId,
    order.status,
    "ready_for_dispatch",
    "Production complete for all lines.",
  );
}
