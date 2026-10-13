import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, nextNumber, notifyUsers, usersWithPermission } from "@/lib/inventory/post";

type Tx = Prisma.TransactionClient;

export async function createAndReleaseProductionForSalesLine(
  tx: Tx,
  session: SessionUser,
  input: {
    plantId: string;
    salesOrderId: string;
    salesOrderItemId: string;
    productId: string;
    targetQty: string;
    uom: string;
    reservedBatchId?: string | null;
    reservedLocationId?: string | null;
    reservedQty?: string | null;
  },
) {
  const location = input.reservedLocationId
    ? await tx.storageLocation.findFirst({ where: { id: input.reservedLocationId, warehouse: { plantId: input.plantId } } })
    : await tx.storageLocation.findFirst({ where: { warehouse: { plantId: input.plantId } } });
  if (!location) throw new AppError(400, "VALIDATION", "Configure a warehouse location first.");

  const sourceBatchId = input.reservedBatchId ?? null;
  const inputQty = input.reservedQty && Number(input.reservedQty) > 0 ? input.reservedQty : input.targetQty;

  const number = await nextNumber(tx, input.plantId, "MO");
  const order = await tx.productionOrder.create({
    data: {
      id: uuidv7(),
      plantId: input.plantId,
      number,
      productId: input.productId,
      sourceBatchId,
      locationId: location.id,
      inputQty,
      targetQty: input.targetQty,
      uom: input.uom,
      salesOrderId: input.salesOrderId,
      salesOrderItemId: input.salesOrderItemId,
      createdBy: session.userId,
      status: "draft",
    },
  });

  const routing = await tx.routingHeader.findFirst({
    where: { plantId: input.plantId, productId: input.productId, active: true },
    include: { operations: { orderBy: { sequence: "asc" } } },
  });
  const steps = routing?.operations.length ? routing.operations : [{ sequence: 1, name: "Process", machineType: null }];
  const jobIds: string[] = [];
  for (const step of steps) {
    const id = uuidv7();
    const jobNo = await nextNumber(tx, input.plantId, "JOB");
    await tx.jobCard.create({
      data: {
        id,
        plantId: input.plantId,
        productionOrderId: order.id,
        salesOrderItemId: input.salesOrderItemId,
        number: jobNo,
        sequence: step.sequence,
        name: step.name,
        status: "draft",
        locationId: location.id,
        batchId: step.sequence === 1 ? sourceBatchId : null,
        targetQty: input.targetQty,
        allocatedQty: step.sequence === 1 && sourceBatchId ? inputQty : 0,
        uom: input.uom,
      },
    });
    jobIds.push(id);
  }
  for (let i = 1; i < jobIds.length; i += 1) {
    await tx.jobDependency.create({ data: { predecessorId: jobIds[i - 1]!, successorId: jobIds[i]! } });
  }
  await tx.productionOrder.update({ where: { id: order.id }, data: { status: "released" } });
  const supervisors = await usersWithPermission(tx, input.plantId, "job.assign");
  await notifyUsers(tx, {
    userIds: supervisors,
    type: "production.released",
    title: "Sales production released",
    body: `${number} is ready to assign.`,
    href: `/production/${order.id}`,
  });
  await audit(tx, {
    userId: session.userId,
    action: "production.from_sales",
    resource: "production_order",
    resourceId: order.id,
  });
  return { productionOrderId: order.id, number, jobs: jobIds.length };
}
