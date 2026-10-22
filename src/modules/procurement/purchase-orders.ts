import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import { assertPlant, plantIdsForSession } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, nextNumber, runCommand } from "@/lib/inventory/post";
import { allow } from "@/modules/shared/allow";
import {
  PO_STATUSES,
  canApprovePo,
  canCancelPo,
  canEditPo,
  canSendPo,
  canSubmitPo,
} from "./domain";

type Tx = Prisma.TransactionClient;

async function findPurchaseOrder(tx: Tx, session: SessionUser, orderId: string, include?: Prisma.PurchaseOrderInclude) {
  const plantIds = await plantIdsForSession(session);
  const order = await tx.purchaseOrder.findFirst({
    where: { id: orderId, plantId: { in: plantIds } },
    ...(include ? { include } : {}),
  });
  if (!order) throw new AppError(404, "NOT_FOUND", "Purchase order was not found.");
  return order;
}

type PoLineInput = {
  materialId: string;
  qty: string;
  uom?: string;
  rate: string;
  taxPct?: string;
  grade?: string;
  thickness?: string;
  width?: string;
  length?: string;
  diameter?: string;
  finish?: string;
};

async function loadMaterials(tx: Tx, lines: PoLineInput[]) {
  for (const line of lines) {
    const qtyNum = Number(line.qty);
    if (!line.qty || isNaN(qtyNum) || qtyNum <= 0) {
      throw new AppError(400, "VALIDATION", "Purchase order line quantity must be greater than zero.");
    }
  }
  const materialIds = [...new Set(lines.map((line) => line.materialId))];
  const materials = await tx.materialMaster.findMany({
    where: {
      id: { in: materialIds },
      active: true,
    },
    include: { productCategory: { select: { id: true, name: true, code: true, status: true, categoryType: true } } },
  });
  if (materials.length !== materialIds.length) {
    throw new AppError(400, "VALIDATION", "One of the materials is not available.");
  }
  for (const material of materials) {
    if (!material.purchaseAllowed) {
      throw new AppError(400, "VALIDATION", `Material "${material.name}" is not eligible for purchase.`);
    }
    if (material.productCategory) {
      if (material.productCategory.status !== "active") {
        throw new AppError(
          409,
          "CATEGORY_INACTIVE",
          `Category "${material.productCategory.name}" is not active. Activate it before creating purchase orders.`,
        );
      }
      if (material.productCategory.categoryType === "scrap") {
        throw new AppError(400, "VALIDATION", `Category "${material.productCategory.name}" (scrap) is not eligible for purchase orders.`);
      }
    }
  }
  return materials;
}

function snapshotLine(
  material: Awaited<ReturnType<typeof loadMaterials>>[number],
  line: PoLineInput,
) {
  return {
    id: uuidv7(),
    materialId: material.id,
    description: material.name,
    grade: line.grade?.trim() || material.grade,
    thickness: line.thickness?.trim() || material.thickness?.toString() || null,
    width: line.width?.trim() || material.width?.toString() || null,
    length: line.length?.trim() || material.length?.toString() || null,
    diameter: line.diameter?.trim() || material.diameter?.toString() || null,
    finish: line.finish?.trim() || null,
    qty: line.qty,
    rate: line.rate,
    taxPct: line.taxPct ?? material.taxRate?.toString() ?? "0",
    uom: (line.uom?.trim().toUpperCase() || material.purchaseUom || material.uom).toUpperCase(),
    specs: {
      category: material.category,
      categoryId: material.categoryId,
      categoryName: material.productCategory?.name ?? material.category,
      hsnCode: material.hsnCode,
      brand: material.brand,
      shape: material.shape,
    } satisfies Prisma.InputJsonObject,
  };
}

export async function createPurchaseOrder(
  session: SessionUser,
  input: {
    plantId: string;
    supplierId: string;
    expectedDate?: string;
    notes?: string;
    submit?: boolean;
    lines: PoLineInput[];
  },
  key: string | null,
) {
  allow(session, "purchase.manage");
  const plantId = input.plantId;
  assertPlant(session, plantId);
  return runCommand({
    userId: session.userId,
    route: "purchase.order",
    key,
    run: async (tx) => {
      const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId } });
      if (!supplier) throw new AppError(404, "NOT_FOUND", "Supplier was not found.");
      const materials = await loadMaterials(tx, input.lines);
      const number = await nextNumber(tx, plantId, "PO");
      const status = input.submit ? PO_STATUSES.pendingApproval : PO_STATUSES.draft;
      const order = await tx.purchaseOrder.create({
        data: {
          id: uuidv7(),
          plantId,
          supplierId: supplier.id,
          number,
          status,
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          notes: input.notes?.trim() || null,
          submittedAt: input.submit ? new Date() : null,
          createdBy: session.userId,
          items: {
            create: input.lines.map((line) => {
              const material = materials.find((item) => item.id === line.materialId)!;
              return snapshotLine(material, line);
            }),
          },
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "purchase.create",
        resource: "purchase_order",
        resourceId: order.id,
        payload: { status },
      });
      return { id: order.id, number, status };
    },
  });
}

export async function updatePurchaseOrder(
  session: SessionUser,
  orderId: string,
  input: {
    expectedDate?: string;
    notes?: string;
    lines: PoLineInput[];
  },
  key: string | null,
) {
  allow(session, "purchase.manage");
  return runCommand({
    userId: session.userId,
    route: "purchase.order.update",
    key,
    run: async (tx) => {
      const order = await findPurchaseOrder(tx, session, orderId, { items: true });
      if (!canEditPo(order.status)) {
        throw new AppError(409, "INVALID_STATE", "Only draft orders can be edited.");
      }
      const materials = await loadMaterials(tx, input.lines);
      await tx.purchaseOrderItem.deleteMany({ where: { orderId: order.id } });
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          notes: input.notes?.trim() || null,
          items: {
            create: input.lines.map((line) => {
              const material = materials.find((item) => item.id === line.materialId)!;
              return snapshotLine(material, line);
            }),
          },
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "purchase.update",
        resource: "purchase_order",
        resourceId: order.id,
      });
      return { id: order.id };
    },
  });
}

export async function submitPurchaseOrder(session: SessionUser, orderId: string, key: string | null) {
  allow(session, "purchase.submit");
  return runCommand({
    userId: session.userId,
    route: "purchase.submit",
    key,
    run: async (tx) => {
      const order = await findPurchaseOrder(tx, session, orderId);
      if (!canSubmitPo(order.status)) {
        throw new AppError(409, "INVALID_STATE", "This order cannot be submitted.");
      }
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: PO_STATUSES.pendingApproval, submittedAt: new Date() },
      });
      await audit(tx, {
        userId: session.userId,
        action: "purchase.submit",
        resource: "purchase_order",
        resourceId: order.id,
      });
      return { id: order.id, status: PO_STATUSES.pendingApproval };
    },
  });
}

export async function approvePurchaseOrder(session: SessionUser, orderId: string, key: string | null) {
  allow(session, "purchase.approve");
  return runCommand({
    userId: session.userId,
    route: "purchase.approve",
    key,
    run: async (tx) => {
      const order = await findPurchaseOrder(tx, session, orderId);
      if (!canApprovePo(order.status)) {
        throw new AppError(409, "INVALID_STATE", "This order is not waiting for approval.");
      }
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: PO_STATUSES.approved,
          approvedBy: session.userId,
          approvedAt: new Date(),
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "purchase.approve",
        resource: "purchase_order",
        resourceId: order.id,
      });
      return { id: order.id, status: PO_STATUSES.approved };
    },
  });
}

export async function sendPurchaseOrder(session: SessionUser, orderId: string, key: string | null) {
  allow(session, "purchase.manage");
  return runCommand({
    userId: session.userId,
    route: "purchase.send",
    key,
    run: async (tx) => {
      const order = await findPurchaseOrder(tx, session, orderId);
      if (!canSendPo(order.status)) {
        throw new AppError(409, "INVALID_STATE", "Only approved orders can be sent to the supplier.");
      }
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: PO_STATUSES.sent, sentAt: new Date() },
      });
      await audit(tx, {
        userId: session.userId,
        action: "purchase.send",
        resource: "purchase_order",
        resourceId: order.id,
      });
      return { id: order.id, status: PO_STATUSES.sent };
    },
  });
}

export async function cancelPurchaseOrder(
  session: SessionUser,
  orderId: string,
  reason: string,
  key: string | null,
) {
  allow(session, "purchase.cancel");
  return runCommand({
    userId: session.userId,
    route: "purchase.cancel",
    key,
    run: async (tx) => {
      const order = await findPurchaseOrder(tx, session, orderId);
      if (!canCancelPo(order.status)) {
        throw new AppError(409, "INVALID_STATE", "This order cannot be cancelled.");
      }
      const postedReceipts = await tx.goodsReceipt.count({
        where: { orderId: order.id, status: "posted" },
      });
      if (postedReceipts > 0) {
        throw new AppError(409, "INVALID_STATE", "Posted receipts exist; cancel is not allowed.");
      }
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: PO_STATUSES.cancelled,
          cancelledAt: new Date(),
          cancelledBy: session.userId,
        },
      });
      await tx.goodsReceipt.updateMany({
        where: { orderId: order.id, status: "draft" },
        data: { status: "cancelled" },
      });
      await audit(tx, {
        userId: session.userId,
        action: "purchase.cancel",
        resource: "purchase_order",
        resourceId: order.id,
        reason,
      });
      return { id: order.id, status: PO_STATUSES.cancelled };
    },
  });
}
