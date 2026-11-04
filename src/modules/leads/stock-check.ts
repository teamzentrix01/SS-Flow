import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";

type Db = Prisma.TransactionClient | typeof prisma;

export async function materialAvailableQty(db: Db, plantId: string, materialId: string) {
  const batches = await db.materialBatch.findMany({
    where: { plantId, materialId },
    select: { id: true },
  });
  if (!batches.length) return 0;
  const totals = await db.stockBalance.aggregate({
    where: { plantId, batchId: { in: batches.map((row) => row.id) } },
    _sum: { availableQty: true },
  });
  return Number(totals._sum.availableQty?.toString() ?? 0);
}

export type ConvertLinePlan = {
  leadItemId: string;
  quantity: number;
  uom: string;
  productId: string | null;
  availableQty: number;
  suggestedInStock: boolean;
  minOrderQty: number | null;
  belowMoq: boolean;
  mustProduce: boolean;
};

export async function buildConvertLinePlans(input: {
  plantId: string;
  lines: {
    leadItemId: string;
    quantity: { toString(): string };
    uom: string;
    productId: string | null;
    inStock: boolean | null;
    estimatedLeadTimeDays: number | null;
  }[];
  selectedProductIds: Record<string, string | undefined>;
  productMeta: Map<string, { minOrderQty: number | null }>;
}) {
  const plans: ConvertLinePlan[] = [];
  for (const line of input.lines) {
    const productId = input.selectedProductIds[line.leadItemId] ?? line.productId ?? null;
    const qty = Number(line.quantity.toString());
    let availableQty = 0;
    let minOrderQty: number | null = null;
    if (productId) {
      availableQty = await materialAvailableQty(prisma, input.plantId, productId);
      minOrderQty = input.productMeta.get(productId)?.minOrderQty ?? null;
    }
    const suggestedInStock = productId ? availableQty >= qty && qty > 0 : false;
    const belowMoq = minOrderQty != null && qty > 0 && qty < minOrderQty;
    const mustProduce = line.inStock === false || (!suggestedInStock && line.inStock !== true);
    plans.push({
      leadItemId: line.leadItemId,
      quantity: qty,
      uom: line.uom,
      productId,
      availableQty,
      suggestedInStock,
      minOrderQty,
      belowMoq,
      mustProduce,
    });
  }
  return plans;
}
