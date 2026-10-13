import type { SessionUser } from "@/lib/auth/session";
import { primaryPlant } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, nextNumber, runCommand } from "@/lib/inventory/post";
import { allow } from "@/modules/shared/allow";
import { explodeBomForLine } from "@/modules/planning/mrp";
import { loadStockPools } from "@/modules/planning/stock-pools";
import { allocateReservationsForRequirement } from "@/modules/planning/reservations";
import { createAndReleaseProductionForSalesLine } from "@/modules/production/from-sales";

async function recordStatus(
  tx: Parameters<Parameters<typeof runCommand>[0]["run"]>[0],
  orderId: string,
  userId: string,
  fromStatus: string | null,
  toStatus: string,
  remarks?: string,
) {
  await tx.salesOrderStatusEvent.create({
    data: { id: uuidv7(), orderId, fromStatus, toStatus, remarks, userId },
  });
  await tx.salesOrder.update({ where: { id: orderId }, data: { status: toStatus } });
}

export async function createSalesOrder(
  session: SessionUser,
  input: {
    customerId: string;
    promisedDate?: string;
    priority?: string;
    notes?: string;
    productionNotes?: string;
    lines: {
      productId: string;
      qtyOrdered: string;
      unitPrice?: string;
      taxPct?: string;
      discountPct?: string;
      specs?: Record<string, unknown>;
    }[];
  },
  key: string | null,
) {
  allow(session, "sales.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "sales.create",
    key,
    run: async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, plantId } });
      if (!customer) throw new AppError(404, "NOT_FOUND", "Customer not found.");
      const products = await tx.materialMaster.findMany({
        where: { plantId, id: { in: input.lines.map((l) => l.productId) } },
      });
      if (products.length !== new Set(input.lines.map((l) => l.productId)).size) {
        throw new AppError(400, "VALIDATION", "Invalid product on a line.");
      }
      const number = await nextNumber(tx, plantId, "SO");
      const order = await tx.salesOrder.create({
        data: {
          id: uuidv7(),
          plantId,
          customerId: customer.id,
          number,
          status: "draft",
          priority: input.priority ?? "normal",
          promisedDate: input.promisedDate ? new Date(input.promisedDate) : null,
          notes: input.notes,
          productionNotes: input.productionNotes,
          items: {
            create: input.lines.map((line) => {
              const product = products.find((p) => p.id === line.productId)!;
              return {
                id: uuidv7(),
                productId: product.id,
                qtyOrdered: line.qtyOrdered,
                unitPrice: line.unitPrice ?? "0",
                taxPct: line.taxPct ?? "0",
                discountPct: line.discountPct ?? "0",
                uom: product.uom,
                specs: (line.specs ?? {}) as object,
              };
            }),
          },
        },
      });
      await recordStatus(tx, order.id, session.userId, null, "draft");
      await audit(tx, { userId: session.userId, action: "sales.create", resource: "sales_order", resourceId: order.id });
      return { id: order.id, number };
    },
  });
}

export async function submitSalesOrder(session: SessionUser, orderId: string, key: string | null) {
  allow(session, "sales.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "sales.submit",
    key,
    run: async (tx) => {
      const order = await tx.salesOrder.findFirst({ where: { id: orderId, plantId } });
      if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
      if (order.status !== "draft") throw new AppError(409, "INVALID_STATE", "Only draft orders can be submitted.");
      await recordStatus(tx, order.id, session.userId, order.status, "submitted");
      return { id: order.id, status: "submitted" };
    },
  });
}

export async function approveSalesOrder(session: SessionUser, orderId: string, key: string | null) {
  allow(session, "sales.approve");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "sales.approve",
    key,
    run: async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, plantId },
        include: { items: { include: { product: true } } },
      });
      if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
      if (!["submitted", "draft"].includes(order.status)) {
        throw new AppError(409, "INVALID_STATE", "Order cannot be approved from this status.");
      }

      await tx.materialRequirement.deleteMany({ where: { salesOrderId: order.id } });

      const materialIds = new Set<string>();
      for (const item of order.items) {
        const bom = await tx.bomHeader.findFirst({
          where: { plantId, productId: item.productId, active: true },
          include: { items: true },
        });
        if (!bom) throw new AppError(409, "BOM_MISSING", `No active BOM for ${item.product.name}.`);
        const exploded = explodeBomForLine(
          item.qtyOrdered.toString(),
          bom.scrapRate.toString(),
          bom.items.map((row) => ({
            materialId: row.materialId,
            qtyPer: row.qtyPer.toString(),
            lossPct: row.lossPct.toString(),
            uom: row.uom,
          })),
        );
        for (const row of exploded) {
          materialIds.add(row.materialId);
          await tx.materialRequirement.create({
            data: {
              id: uuidv7(),
              plantId,
              salesOrderId: order.id,
              salesOrderItemId: item.id,
              materialId: row.materialId,
              grossQty: row.grossQty,
              scrapQty: row.scrapQty,
              netQty: row.netQty,
              uom: row.uom,
            },
          });
        }
      }

      const pools = await loadStockPools(tx, plantId, [...materialIds]);
      for (const item of order.items) {
        const reqs = await tx.materialRequirement.findMany({ where: { salesOrderItemId: item.id } });
        for (const req of reqs) {
          await allocateReservationsForRequirement(tx, {
            plantId,
            materialId: req.materialId,
            needQty: req.netQty.toString(),
            salesOrderId: order.id,
            salesOrderItemId: item.id,
            performedBy: session.userId,
          });
        }
        const primaryReservation = await tx.stockReservation.findFirst({
          where: { salesOrderItemId: item.id, status: "active" },
          orderBy: { createdAt: "asc" },
        });
        await createAndReleaseProductionForSalesLine(tx, session, {
          plantId,
          salesOrderId: order.id,
          salesOrderItemId: item.id,
          productId: item.productId,
          targetQty: item.qtyOrdered.toString(),
          uom: item.uom,
          reservedBatchId: primaryReservation?.batchId ?? null,
          reservedLocationId: primaryReservation?.locationId ?? null,
          reservedQty: primaryReservation?.qty.toString() ?? null,
        });
      }

      await tx.salesOrder.update({
        where: { id: order.id },
        data: { approvedBy: session.userId, approvedAt: new Date() },
      });
      await recordStatus(tx, order.id, session.userId, order.status, "material_planning");
      await recordStatus(tx, order.id, session.userId, "material_planning", "production");
      await audit(tx, { userId: session.userId, action: "sales.approve", resource: "sales_order", resourceId: order.id, payload: { pools: [...pools.keys()] } });
      return { id: order.id, status: "production" };
    },
  });
}

export async function holdSalesOrder(session: SessionUser, orderId: string, reason: string, key: string | null) {
  allow(session, "sales.approve");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "sales.hold",
    key,
    run: async (tx) => {
      const order = await tx.salesOrder.findFirst({ where: { id: orderId, plantId } });
      if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
      await tx.salesOrder.update({ where: { id: order.id }, data: { onHoldReason: reason } });
      await recordStatus(tx, order.id, session.userId, order.status, "on_hold", reason);
      return { id: order.id, status: "on_hold" };
    },
  });
}

export async function cancelSalesOrder(session: SessionUser, orderId: string, reason: string, key: string | null) {
  allow(session, "sales.approve");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "sales.cancel",
    key,
    run: async (tx) => {
      const order = await tx.salesOrder.findFirst({ where: { id: orderId, plantId } });
      if (!order) throw new AppError(404, "NOT_FOUND", "Order not found.");
      await recordStatus(tx, order.id, session.userId, order.status, "cancelled", reason);
      return { id: order.id, status: "cancelled" };
    },
  });
}
