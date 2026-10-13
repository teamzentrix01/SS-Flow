import type { Prisma } from "@prisma/client";
import { toMilli } from "@/lib/domain/qty";
import { uuidv7 } from "@/lib/ids";
import { postMovement } from "@/lib/inventory/post";

type Tx = Prisma.TransactionClient;

export async function allocateReservationsForRequirement(
  tx: Tx,
  input: {
    plantId: string;
    materialId: string;
    needQty: string;
    salesOrderId: string;
    salesOrderItemId: string;
    performedBy: string;
  },
): Promise<string> {
  let remaining = toMilli(input.needQty);
  if (remaining <= 0n) return "0";

  const balances = await tx.stockBalance.findMany({
    where: {
      plantId: input.plantId,
      availableQty: { gt: 0 },
      batch: { materialId: input.materialId, qualityStatus: "pass" },
    },
    orderBy: { updatedAt: "asc" },
    include: { batch: true },
  });

  for (const balance of balances) {
    if (remaining <= 0n) break;
    const available = toMilli(balance.availableQty.toString());
    if (available <= 0n) continue;
    const take = available < remaining ? available : remaining;
    await postMovement(tx, {
      plantId: input.plantId,
      batchId: balance.batchId,
      locationId: balance.locationId,
      type: "reserve",
      qty: (Number(take) / 1000).toFixed(3),
      referenceType: "sales_order",
      referenceId: input.salesOrderId,
      performedBy: input.performedBy,
    });
    await tx.stockReservation.create({
      data: {
        id: uuidv7(),
        plantId: input.plantId,
        batchId: balance.batchId,
        locationId: balance.locationId,
        qty: (Number(take) / 1000).toFixed(3),
        uom: balance.uom,
        referenceType: "sales_order",
        referenceId: input.salesOrderId,
        salesOrderItemId: input.salesOrderItemId,
        status: "active",
      },
    });
    remaining -= take;
  }

  const allocated = toMilli(input.needQty) - remaining;
  return (Number(allocated) / 1000).toFixed(3);
}
