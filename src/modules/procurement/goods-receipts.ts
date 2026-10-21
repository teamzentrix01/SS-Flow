import type { Prisma } from "@prisma/client";
import { primaryPlant } from "@/lib/access";
import { setLocalPgSchema } from "@/lib/db/pg-schema";
import { fromMilli, toMilli } from "@/lib/domain/qty";
import { uuidv7 } from "@/lib/ids";
import {
  addDaily,
  audit,
  nextNumber,
  notifyUsers,
  postMovement,
  runCommand,
  usersWithPermission,
} from "@/lib/inventory/post";
import type { SessionUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/authz";
import { AppError } from "@/lib/errors";
import {
  RECEIPT_STATUSES,
  RECEIVABLE_PO_STATUSES,
  assertSameUom,
  assertWithinOutstanding,
  derivePoReceiptStatus,
  outstandingMilli,
  receiptLineTotals,
} from "./domain";

function allowReceive(session: SessionUser) {
  if (!hasPermission(session, "inventory.receive") && !hasPermission(session, "purchase.manage")) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this action.");
  }
}

type Tx = Prisma.TransactionClient;

type ReceiptLineInput = {
  orderItemId: string;
  deliveredQty: string;
  acceptedQty: string;
  rejectedQty?: string;
  uom?: string;
  heatNo?: string;
  batchNo: string;
  actualWeight?: string;
  grade?: string;
  thickness?: string;
  width?: string;
  inspectionStatus?: string;
  rejectionReason?: string;
};

async function lockPurchaseOrder(tx: Tx, orderId: string) {
  await setLocalPgSchema(tx);
  await tx.$executeRaw`SELECT id FROM purchase_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
}

async function pendingAcceptedOnOrder(tx: Tx, orderId: string, excludeReceiptId?: string) {
  const drafts = await tx.goodsReceipt.findMany({
    where: {
      orderId,
      status: RECEIPT_STATUSES.draft,
      ...(excludeReceiptId ? { id: { not: excludeReceiptId } } : {}),
    },
    include: { items: true },
  });
  const map = new Map<string, bigint>();
  for (const receipt of drafts) {
    for (const item of receipt.items) {
      map.set(
        item.orderItemId,
        (map.get(item.orderItemId) ?? 0n) + toMilli(item.acceptedQty.toString()),
      );
    }
  }
  return map;
}

function inspectionForLine(accepted: bigint, rejected: bigint, input?: string) {
  if (input) return input;
  if (rejected > 0n && accepted > 0n) return "partial";
  if (rejected > 0n) return "rejected";
  if (accepted > 0n) return "accepted";
  return "pending";
}

async function createGoodsReceiptInTx(
  tx: Tx,
  session: SessionUser,
  plantId: string,
  input: {
    orderId: string;
    locationId: string;
    notes?: string;
    lines: ReceiptLineInput[];
  },
) {
  await lockPurchaseOrder(tx, input.orderId);
  const order = await tx.purchaseOrder.findFirst({
    where: { id: input.orderId, plantId },
    include: { items: true },
  });
  if (!order) throw new AppError(404, "NOT_FOUND", "Purchase order was not found.");
  if (!RECEIVABLE_PO_STATUSES.includes(order.status as (typeof RECEIVABLE_PO_STATUSES)[number])) {
    throw new AppError(409, "INVALID_STATE", "Receive against a sent or approved order.");
  }
  const location = await tx.storageLocation.findFirst({
    where: { id: input.locationId, warehouse: { plantId } },
  });
  if (!location) throw new AppError(404, "NOT_FOUND", "Location was not found.");
  const pending = await pendingAcceptedOnOrder(tx, order.id);
  const number = await nextNumber(tx, plantId, "GRN");
  const receipt = await tx.goodsReceipt.create({
    data: {
      id: uuidv7(),
      plantId,
      orderId: order.id,
      number,
      status: RECEIPT_STATUSES.draft,
      receivedAt: new Date(),
      receivedBy: session.userId,
      notes: input.notes,
    },
  });
  for (const line of input.lines) {
    const totals = receiptLineTotals({
      delivered: line.deliveredQty,
      accepted: line.acceptedQty,
      rejected: line.rejectedQty ?? "0",
    });
    if (totals.error === "DELIVERED_REQUIRED") continue;
    if (totals.error) {
      throw new AppError(400, "VALIDATION", "Delivered quantity must equal accepted plus rejected.");
    }
    const item = order.items.find((row) => row.id === line.orderItemId);
    if (!item) {
      throw new AppError(400, "VALIDATION", "A receipt line does not belong to this order.");
    }
    const uom = line.uom ?? item.uom;
    const uomCheck = assertSameUom(item.uom, uom);
    if (uomCheck.error) {
      throw new AppError(409, "UOM_MISMATCH", "Receipt unit must match the purchase order line.");
    }
    const outstanding = outstandingMilli(item.qty.toString(), item.receivedQty.toString());
    const reserved = pending.get(item.id) ?? 0n;
    const open = outstanding - reserved;
    const over = assertWithinOutstanding(totals.accepted, open);
    if (over.error) {
      throw new AppError(409, "OVER_RECEIPT", "Accepted quantity is above the open order quantity.");
    }
    pending.set(item.id, reserved + totals.accepted);
    await tx.goodsReceiptItem.create({
      data: {
        id: uuidv7(),
        receiptId: receipt.id,
        orderItemId: item.id,
        locationId: location.id,
        deliveredQty: line.deliveredQty,
        acceptedQty: line.acceptedQty,
        rejectedQty: line.rejectedQty ?? "0",
        qty: line.acceptedQty,
        uom,
        actualWeight: line.actualWeight ?? line.deliveredQty,
        heatNo: line.heatNo,
        batchNo: line.batchNo,
        inspectionStatus: inspectionForLine(totals.accepted, totals.rejected, line.inspectionStatus),
        rejectionReason: line.rejectionReason,
      },
    });
  }
  const count = await tx.goodsReceiptItem.count({ where: { receiptId: receipt.id } });
  if (!count) {
    throw new AppError(400, "VALIDATION", "Add at least one receipt line with delivered quantity.");
  }
  return receipt;
}

async function postGoodsReceiptInTx(tx: Tx, session: SessionUser, plantId: string, receiptId: string) {
  const receipt = await tx.goodsReceipt.findFirst({
    where: { id: receiptId, plantId },
    include: {
      items: { include: { orderItem: true } },
      order: true,
    },
  });
  if (!receipt) throw new AppError(404, "NOT_FOUND", "Goods receipt was not found.");
  if (receipt.status === RECEIPT_STATUSES.posted) {
    throw new AppError(409, "ALREADY_POSTED", "This receipt has already been posted.");
  }
  if (receipt.status !== RECEIPT_STATUSES.draft) {
    throw new AppError(409, "INVALID_STATE", "Only draft receipts can be posted.");
  }
  await lockPurchaseOrder(tx, receipt.orderId);
  const existingLedger = await tx.stockLedger.findFirst({
    where: { referenceId: receipt.id, referenceType: "goods_receipt" },
  });
  if (existingLedger) {
    throw new AppError(409, "ALREADY_POSTED", "Stock movements already exist for this receipt.");
  }
  let receivedKg = 0n;
  for (const line of receipt.items) {
    if (toMilli(line.acceptedQty.toString()) <= 0n) continue;
    const item = line.orderItem;
    const outstanding = outstandingMilli(item.qty.toString(), item.receivedQty.toString());
    const over = assertWithinOutstanding(toMilli(line.acceptedQty.toString()), outstanding);
    if (over.error) {
      throw new AppError(409, "OVER_RECEIPT", "Accepted quantity is above the open order quantity.");
    }
    const locationId = line.locationId;
    if (!locationId) {
      throw new AppError(400, "VALIDATION", "Each line needs a storage location before posting.");
    }
    const batch = await tx.materialBatch.create({
      data: {
        id: uuidv7(),
        plantId,
        materialId: item.materialId,
        locationId,
        batchNo: line.batchNo,
        heatNo: line.heatNo,
        grade: item.grade,
        thickness: item.thickness,
        width: item.width,
        length: item.length,
        diameter: item.diameter,
        weight: line.acceptedQty,
        qualityStatus: "pending",
        supplierId: receipt.order.supplierId,
        specs: item.specs as Prisma.InputJsonObject,
      },
    });
    await tx.goodsReceiptItem.update({
      where: { id: line.id },
      data: { batchId: batch.id },
    });
    await postMovement(tx, {
      plantId,
      batchId: batch.id,
      locationId,
      type: "receipt",
      qty: line.acceptedQty.toString(),
      uom: line.uom,
      reason: receipt.number,
      referenceType: "goods_receipt",
      referenceId: receipt.id,
      referenceLineId: line.id,
      performedBy: session.userId,
    });
    await tx.qcInspection.create({
      data: {
        id: uuidv7(),
        plantId,
        kind: "incoming",
        batchId: batch.id,
        status: "pending",
      },
    });
    await tx.purchaseOrderItem.update({
      where: { id: item.id },
      data: {
        receivedQty: { increment: line.acceptedQty },
        rejectedQty: { increment: line.rejectedQty },
      },
    });
    receivedKg += toMilli(line.acceptedQty.toString());
  }
  const freshItems = await tx.purchaseOrderItem.findMany({ where: { orderId: receipt.orderId } });
  const nextStatus = derivePoReceiptStatus(
    freshItems.map((row) => ({
      qty: row.qty.toString(),
      receivedQty: row.receivedQty.toString(),
    })),
  );
  await tx.purchaseOrder.update({
    where: { id: receipt.orderId },
    data: { status: nextStatus },
  });
  await tx.goodsReceipt.update({
    where: { id: receipt.id },
    data: {
      status: RECEIPT_STATUSES.posted,
      postedAt: new Date(),
      postedBy: session.userId,
    },
  });
  if (receivedKg > 0n) {
    await addDaily(tx, plantId, fromMilli(receivedKg), "0", "0");
  }
  const inspectors = await usersWithPermission(tx, plantId, "qc.decide");
  await notifyUsers(tx, {
    userIds: inspectors,
    type: "material.received",
    title: "Incoming material",
    body: `${receipt.number} is waiting for QC.`,
    href: "/quality",
  });
  await audit(tx, {
    userId: session.userId,
    action: "purchase.receipt.post",
    resource: "goods_receipt",
    resourceId: receipt.id,
  });
  return { id: receipt.id, number: receipt.number, status: RECEIPT_STATUSES.posted };
}

function allowManage(session: SessionUser) {
  if (!hasPermission(session, "purchase.manage")) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this action.");
  }
}

export async function createGoodsReceipt(
  session: SessionUser,
  input: {
    orderId: string;
    locationId: string;
    notes?: string;
    lines: ReceiptLineInput[];
  },
  key: string | null,
) {
  allowManage(session);
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "purchase.receipt.create",
    key,
    run: async (tx) => {
      const receipt = await createGoodsReceiptInTx(tx, session, plantId, input);
      await audit(tx, {
        userId: session.userId,
        action: "purchase.receipt.draft",
        resource: "goods_receipt",
        resourceId: receipt.id,
      });
      return { id: receipt.id, number: receipt.number, status: RECEIPT_STATUSES.draft };
    },
  });
}

export async function postGoodsReceipt(session: SessionUser, receiptId: string, key: string | null) {
  allowReceive(session);
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "purchase.receipt.post",
    key,
    run: async (tx) => postGoodsReceiptInTx(tx, session, plantId, receiptId),
  });
}

export async function receiveAndPostGoods(
  session: SessionUser,
  input: {
    orderId: string;
    locationId: string;
    notes?: string;
    post?: boolean;
    lines: {
      orderItemId: string;
      qty?: string;
      deliveredQty?: string;
      acceptedQty?: string;
      rejectedQty?: string;
      heatNo?: string;
      batchNo: string;
      grade?: string;
      thickness?: string;
      width?: string;
      rejectionReason?: string;
    }[];
  },
  key: string | null,
) {
  allowManage(session);
  const plantId = primaryPlant(session);
  const mapped: ReceiptLineInput[] = input.lines.map((line) => {
    const delivered = line.deliveredQty ?? line.qty ?? "0";
    const accepted = line.acceptedQty ?? line.qty ?? "0";
    return {
      orderItemId: line.orderItemId,
      deliveredQty: delivered,
      acceptedQty: accepted,
      rejectedQty: line.rejectedQty ?? "0",
      heatNo: line.heatNo,
      batchNo: line.batchNo,
      grade: line.grade,
      thickness: line.thickness,
      width: line.width,
      rejectionReason: line.rejectionReason,
    };
  });
  const shouldPost = input.post !== false;
  if (shouldPost) allowReceive(session);
  return runCommand({
    userId: session.userId,
    route: shouldPost ? "purchase.receipt" : "purchase.receipt.create",
    key,
    run: async (tx) => {
      const receipt = await createGoodsReceiptInTx(tx, session, plantId, {
        orderId: input.orderId,
        locationId: input.locationId,
        notes: input.notes,
        lines: mapped,
      });
      if (!shouldPost) {
        await audit(tx, {
          userId: session.userId,
          action: "purchase.receipt.draft",
          resource: "goods_receipt",
          resourceId: receipt.id,
        });
        return { id: receipt.id, number: receipt.number, status: RECEIPT_STATUSES.draft };
      }
      return postGoodsReceiptInTx(tx, session, plantId, receipt.id);
    },
  });
}
