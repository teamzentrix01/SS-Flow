import type { SessionUser } from "@/lib/auth/session";
import { primaryPlant } from "@/lib/access";
import { netProcurementForMaterial } from "@/modules/planning/mrp";
import { loadStockPools } from "@/modules/planning/stock-pools";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, nextNumber, runCommand } from "@/lib/inventory/post";
import { allow } from "@/modules/shared/allow";

export async function createRequisitionFromRequirements(
  session: SessionUser,
  input: { salesOrderId?: string; notes?: string },
  key: string | null,
) {
  allow(session, "purchase.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "requisition.create",
    key,
    run: async (tx) => {
      const requirements = await tx.materialRequirement.findMany({
        where: {
          plantId,
          ...(input.salesOrderId ? { salesOrderId: input.salesOrderId } : {}),
        },
      });
      if (!requirements.length) throw new AppError(404, "NOT_FOUND", "No material requirements to consolidate.");

      const materialIds = [...new Set(requirements.map((r) => r.materialId))];
      const pools = await loadStockPools(tx, plantId, materialIds);
      const consolidated = new Map<string, { materialId: string; qty: number; requirementId: string }>();

      for (const req of requirements) {
        const pool = pools.get(req.materialId);
        const net = netProcurementForMaterial(
          {
            materialId: req.materialId,
            grossQty: req.grossQty.toString(),
            scrapQty: req.scrapQty.toString(),
            netQty: req.netQty.toString(),
            uom: req.uom,
          },
          pool,
          0n,
        );
        const add = Number(net.netProcurement);
        if (add <= 0) continue;
        const current = consolidated.get(req.materialId);
        if (current) current.qty += add;
        else consolidated.set(req.materialId, { materialId: req.materialId, qty: add, requirementId: req.id });
      }

      if (!consolidated.size) throw new AppError(409, "NOTHING_TO_BUY", "All requirements are covered by stock and incoming POs.");

      const number = await nextNumber(tx, plantId, "PR");
      const requisition = await tx.purchaseRequisition.create({
        data: {
          id: uuidv7(),
          plantId,
          number,
          notes: input.notes,
          createdBy: session.userId,
          items: {
            create: [...consolidated.values()].map((row) => ({
              id: uuidv7(),
              materialId: row.materialId,
              requirementId: row.requirementId,
              qty: row.qty.toFixed(3),
              uom: "KG",
            })),
          },
        },
        include: { items: true },
      });
      await audit(tx, { userId: session.userId, action: "requisition.create", resource: "purchase_requisition", resourceId: requisition.id });
      return { id: requisition.id, number, lines: requisition.items.length };
    },
  });
}
