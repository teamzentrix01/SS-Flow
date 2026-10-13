import type { Prisma } from "@prisma/client";
import { toMilli } from "@/lib/domain/qty";
import type { StockPool } from "./mrp";

type Tx = Prisma.TransactionClient;

export async function loadStockPools(tx: Tx, plantId: string, materialIds: string[]): Promise<Map<string, StockPool>> {
  const map = new Map<string, StockPool>();
  if (!materialIds.length) return map;

  const balances = await tx.stockBalance.findMany({
    where: { plantId, batch: { materialId: { in: materialIds }, qualityStatus: "pass" } },
    include: { batch: true },
  });
  for (const row of balances) {
    const id = row.batch.materialId;
    const current = map.get(id) ?? { materialId: id, availableQty: 0n, reservedOtherQty: 0n, incomingQty: 0n };
    current.availableQty += toMilli(row.availableQty.toString());
    current.reservedOtherQty += toMilli(row.reservedQty.toString());
    map.set(id, current);
  }

  const poItems = await tx.purchaseOrderItem.findMany({
    where: {
      order: { plantId, status: { in: ["approved", "partial"] } },
      materialId: { in: materialIds },
    },
    select: { materialId: true, qty: true, receivedQty: true },
  });
  for (const item of poItems) {
    const pending = toMilli(item.qty.toString()) - toMilli(item.receivedQty.toString());
    if (pending <= 0n) continue;
    const current = map.get(item.materialId) ?? { materialId: item.materialId, availableQty: 0n, reservedOtherQty: 0n, incomingQty: 0n };
    current.incomingQty += pending;
    map.set(item.materialId, current);
  }

  for (const id of materialIds) {
    if (!map.has(id)) map.set(id, { materialId: id, availableQty: 0n, reservedOtherQty: 0n, incomingQty: 0n });
  }
  return map;
}
