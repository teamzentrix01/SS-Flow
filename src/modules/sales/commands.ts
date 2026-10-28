import type { SessionUser } from "@/lib/auth/session";
import { primaryPlant } from "@/lib/access";
import { salesLineRequiresBom } from "@/lib/domain/master-entities";
import { defaultUomForCategory } from "@/lib/domain/material-conventions";
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
  customerNote?: string,
) {
  await tx.salesOrderStatusEvent.create({
    data: { id: uuidv7(), orderId, fromStatus, toStatus, remarks, customerNote: customerNote ?? null, userId },
  });
  await tx.salesOrder.update({ where: { id: orderId }, data: { status: toStatus } });
  if (customerNote?.trim()) {
    const { queueCustomerNotification } = await import("@/modules/leads/customer-notify");
    const order = await tx.salesOrder.findUnique({
      where: { id: orderId },
      select: { plantId: true, customerId: true },
    });
    if (order) {
      await queueCustomerNotification(tx, {
        plantId: order.plantId,
        customerId: order.customerId,
        salesOrderId: orderId,
        channel: "email",
        message: customerNote.trim(),
      });
    }
  }
}

export async function createSalesOrder(
  session: SessionUser,
  input: {
    customerId?: string;
    newCustomer?: { name: string; phone?: string };
    requiredDeliveryDate?: string;
    promisedDate?: string;
    priority?: string;
    notes?: string;
    productionNotes?: string;
    lines: {
      productId?: string;
      newProduct?: { name: string; code?: string };
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
      let customerId: string;
      if (input.newCustomer) {
        const code = await nextNumber(tx, plantId, "CUS");
        const created = await tx.customer.create({
          data: {
            id: uuidv7(),
            plantId,
            code,
            name: input.newCustomer.name.trim(),
            phone: input.newCustomer.phone?.trim() || null,
          },
        });
        await audit(tx, {
          userId: session.userId,
          action: "customer.create",
          resource: "customer",
          resourceId: created.id,
        });
        customerId = created.id;
      } else {
        const customer = await tx.customer.findFirst({ where: { id: input.customerId, plantId } });
        if (!customer) throw new AppError(404, "NOT_FOUND", "Customer not found.");
        customerId = customer.id;
      }

      const resolvedProducts: { lineIndex: number; material: { id: string; uom: string } }[] = [];
      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i]!;
        if (line.newProduct) {
          const code = line.newProduct.code?.trim() || (await nextNumber(tx, plantId, "MAT"));
          const duplicate = await tx.materialMaster.findFirst({
            where: { plantId, code: { equals: code, mode: "insensitive" } },
          });
          if (duplicate) throw new AppError(409, "DUPLICATE", "Product code already exists.");
          const material = await tx.materialMaster.create({
            data: {
              id: uuidv7(),
              plantId,
              code,
              name: line.newProduct.name.trim(),
              category: "utensil",
              productType: "finished",
              shape: "product",
              uom: defaultUomForCategory("utensil"),
              batchTracking: true,
              salesAllowed: true,
              manufacturingAllowed: true,
              purchaseAllowed: true,
              active: true,
              specs: {},
            },
          });
          await audit(tx, {
            userId: session.userId,
            action: "material.create",
            resource: "material",
            resourceId: material.id,
          });
          resolvedProducts.push({ lineIndex: i, material: { id: material.id, uom: material.uom } });
        } else {
          const material = await tx.materialMaster.findFirst({
            where: { id: line.productId, plantId, active: true },
          });
          if (!material) throw new AppError(400, "VALIDATION", "Invalid product on a line.");
          resolvedProducts.push({ lineIndex: i, material: { id: material.id, uom: material.uom } });
        }
      }

      const number = await nextNumber(tx, plantId, "SO");
      const order = await tx.salesOrder.create({
        data: {
          id: uuidv7(),
          plantId,
          customerId,
          number,
          status: "draft",
          priority: input.priority ?? "normal",
          requiredDeliveryDate: input.requiredDeliveryDate ? new Date(input.requiredDeliveryDate) : null,
          promisedDate: input.promisedDate ? new Date(input.promisedDate) : null,
          notes: input.notes,
          productionNotes: input.productionNotes,
          items: {
            create: input.lines.map((line, index) => {
              const product = resolvedProducts.find((p) => p.lineIndex === index)!.material;
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
      let manufactureLines = 0;
      for (const item of order.items) {
        if (salesLineRequiresBom(item.product)) {
          const bom = await tx.bomHeader.findFirst({
            where: { plantId, productId: item.productId, active: true },
            include: { items: true },
          });
          if (!bom) {
            throw new AppError(
              409,
              "BOM_MISSING",
              `No active BOM for ${item.product.name}. Create a bill of materials before approving a manufactured product.`,
            );
          }
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
          manufactureLines += 1;
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
          continue;
        }

        // Purchased / raw SKUs (e.g. HR coil received on a PO) have no BOM — reserve the sold material itself.
        materialIds.add(item.productId);
        await tx.materialRequirement.create({
          data: {
            id: uuidv7(),
            plantId,
            salesOrderId: order.id,
            salesOrderItemId: item.id,
            materialId: item.productId,
            grossQty: item.qtyOrdered,
            scrapQty: "0",
            netQty: item.qtyOrdered,
            uom: item.uom,
          },
        });
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
        if (!salesLineRequiresBom(item.product)) {
          await tx.salesOrderItem.update({
            where: { id: item.id },
            data: { qtyProduced: item.qtyOrdered },
          });
          continue;
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

      const nextStatus = manufactureLines > 0 ? "material_planning" : "ready_for_dispatch";
      const remarks =
        manufactureLines > 0
          ? "BOM exploded, stock reserved, job cards created — assign operators on this order."
          : "Purchased stock reserved — no BOM or production required. Ready to dispatch.";

      await tx.salesOrder.update({
        where: { id: order.id },
        data: { approvedBy: session.userId, approvedAt: new Date() },
      });
      await recordStatus(tx, order.id, session.userId, order.status, nextStatus, remarks);
      await audit(tx, { userId: session.userId, action: "sales.approve", resource: "sales_order", resourceId: order.id, payload: { pools: [...pools.keys()], manufactureLines } });
      return { id: order.id, status: nextStatus };
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

export async function updateSalesOrderDeliveryDates(
  session: SessionUser,
  orderId: string,
  input: {
    requiredDeliveryDate?: string | null;
    promisedDate?: string | null;
  },
  key: string | null,
) {
  allow(session, "sales.manage");
  return runCommand({
    userId: session.userId,
    route: "sales.order.dates",
    key,
    run: async (tx) => {
      const plantId = primaryPlant(session);
      const order = await tx.salesOrder.findFirst({
        where: { id: orderId, plantId },
      });
      if (!order) throw new AppError(404, "NOT_FOUND", "Sales order not found.");

      const data: { requiredDeliveryDate?: Date | null; promisedDate?: Date | null } = {};
      if (input.requiredDeliveryDate !== undefined) {
        data.requiredDeliveryDate = input.requiredDeliveryDate ? new Date(input.requiredDeliveryDate) : null;
      }
      if (input.promisedDate !== undefined) {
        data.promisedDate = input.promisedDate ? new Date(input.promisedDate) : null;
      }

      await tx.salesOrder.update({
        where: { id: orderId },
        data,
      });

      return {
        id: orderId,
        requiredDeliveryDate: data.requiredDeliveryDate !== undefined ? data.requiredDeliveryDate : order.requiredDeliveryDate,
        promisedDate: data.promisedDate !== undefined ? data.promisedDate : order.promisedDate,
      };
    },
  });
}

