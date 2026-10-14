import type { Prisma } from "@prisma/client";
import { fromMilli, toMilli } from "@/lib/domain/qty";
import { AppError } from "@/lib/errors";
import { postMovement } from "@/lib/inventory/post";
import { allocateReservationsForRequirement } from "@/modules/planning/reservations";

type Tx = Prisma.TransactionClient;

type JobWithMo = Prisma.JobCardGetPayload<{ include: { productionOrder: true } }>;

async function reservedNetForMaterial(
  tx: Tx,
  salesOrderItemId: string,
  materialId: string,
) {
  const rows = await tx.stockReservation.findMany({
    where: {
      salesOrderItemId,
      status: "active",
      batch: { materialId },
    },
  });
  return rows.reduce((sum, row) => sum + toMilli(row.qty.toString()), 0n);
}

/** Reserve stock (if needed) and link batch/qty on step-1 job cards for sales-driven MOs. */
export async function ensureFirstJobMaterialLinked(
  tx: Tx,
  input: {
    plantId: string;
    job: JobWithMo;
    performedBy: string;
  },
): Promise<{ linked: boolean; batchId?: string; allocatedQty?: string }> {
  const { job } = input;
  if (job.batchId || job.sequence !== 1) {
    return { linked: Boolean(job.batchId), batchId: job.batchId ?? undefined };
  }

  const mo = job.productionOrder;
  let batchId = mo.sourceBatchId;
  let locationId = job.locationId ?? mo.locationId;
  let inputQty =
    toMilli(mo.inputQty.toString()) > 0n
      ? mo.inputQty.toString()
      : job.targetQty.toString();

  if (!batchId && job.salesOrderItemId && job.salesOrderId) {
    const requirements = await tx.materialRequirement.findMany({
      where: { salesOrderItemId: job.salesOrderItemId },
    });
    for (const req of requirements) {
      const have = await reservedNetForMaterial(tx, job.salesOrderItemId, req.materialId);
      const need = toMilli(req.netQty.toString()) - have;
      if (need <= 0n) continue;
      await allocateReservationsForRequirement(tx, {
        plantId: input.plantId,
        materialId: req.materialId,
        needQty: fromMilli(need),
        salesOrderId: job.salesOrderId,
        salesOrderItemId: job.salesOrderItemId,
        performedBy: input.performedBy,
      });
    }

    const primary = await tx.stockReservation.findFirst({
      where: { salesOrderItemId: job.salesOrderItemId, status: "active" },
      orderBy: { createdAt: "asc" },
    });
    if (primary) {
      batchId = primary.batchId;
      locationId = primary.locationId;
      inputQty = primary.qty.toString();
    }
  }

  if (!batchId) {
    return { linked: false };
  }

  let locId: string | undefined = locationId ?? undefined;
  if (!locId) {
    const balance = await tx.stockBalance.findFirst({
      where: { plantId: input.plantId, batchId },
    });
    locId = balance?.locationId ?? undefined;
  }
  if (!locId) return { linked: false };

  const allocatedQty =
    toMilli(job.allocatedQty.toString()) > 0n ? job.allocatedQty.toString() : inputQty;

  if (!mo.sourceBatchId || toMilli(mo.inputQty.toString()) === 0n) {
    await tx.productionOrder.update({
      where: { id: mo.id },
      data: {
        sourceBatchId: batchId,
        locationId: locId,
        inputQty: toMilli(mo.inputQty.toString()) > 0n ? mo.inputQty : allocatedQty,
      },
    });
  }

  await tx.jobCard.update({
    where: { id: job.id },
    data: {
      batchId,
      locationId: locId,
      allocatedQty,
    },
  });

  return { linked: true, batchId, allocatedQty };
}

/** Job start issues from reserved qty — top up reservation from available when needed. */
export async function ensureReservedForIssue(
  tx: Tx,
  input: {
    plantId: string;
    batchId: string;
    locationId: string;
    qty: string;
    performedBy: string;
    salesOrderId?: string | null;
  },
) {
  const need = toMilli(input.qty);
  if (need <= 0n) return;

  const balance = await tx.stockBalance.findUnique({
    where: {
      batchId_locationId: { batchId: input.batchId, locationId: input.locationId },
    },
  });
  if (!balance) {
    throw new AppError(
      409,
      "NO_STOCK",
      "No stock balance exists for this batch at the job location. Reserve material again from the job screen.",
    );
  }

  const reserved = toMilli(balance.reservedQty.toString());
  if (reserved >= need) return;

  const gap = need - reserved;
  const available = toMilli(balance.availableQty.toString());
  if (available < gap) {
    throw new AppError(
      409,
      "INSUFFICIENT_STOCK",
      `Need ${fromMilli(gap)} kg reserved for this job but only ${fromMilli(available)} kg is available on this batch.`,
    );
  }

  await postMovement(tx, {
    plantId: input.plantId,
    batchId: input.batchId,
    locationId: input.locationId,
    type: "reserve",
    qty: fromMilli(gap),
    referenceType: input.salesOrderId ? "sales_order" : "job",
    referenceId: input.salesOrderId ?? undefined,
    performedBy: input.performedBy,
  });
}
