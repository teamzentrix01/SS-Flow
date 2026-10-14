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

  const bom = await tx.bomHeader.findFirst({
    where: { plantId: input.plantId, productId: input.productId, active: true },
    orderBy: { version: "desc" },
  });

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
      bomHeaderId: bom?.id ?? null,
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
        salesOrderId: input.salesOrderId,
        salesOrderItemId: input.salesOrderItemId,
        bomHeaderId: bom?.id ?? null,
        bomVersion: bom?.version ?? null,
        routingId: routing?.id ?? null,
        number: jobNo,
        sequence: step.sequence,
        name: step.name,
        status: "draft",
        locationId: location.id,
        batchId: step.sequence === 1 ? sourceBatchId : null,
        targetQty: input.targetQty,
        allocatedQty: step.sequence === 1 && sourceBatchId ? inputQty : 0,
        uom: input.uom,
        instructions:
          step.sequence === 1
            ? "Run per active BOM (formula). Assign operator from this sales order before shop start."
            : "Starts when the previous operation passes final QC.",
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
    title: "Sales production planned",
    body: `${number} job cards are ready — assign from the sales order.`,
    href: `/sales/${input.salesOrderId}`,
  });
  await audit(tx, {
    userId: session.userId,
    action: "production.from_sales",
    resource: "production_order",
    resourceId: order.id,
  });
  return { productionOrderId: order.id, number, jobs: jobIds.length };
}
