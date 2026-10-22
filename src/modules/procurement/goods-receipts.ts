import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { primaryPlant } from "@/lib/access";
import { setLocalPgSchema } from "@/lib/db/pg-schema";
import { fromMilli, toMilli } from "@/lib/domain/qty";
import { convertQuantity, isMassUom } from "@/lib/domain/uom";
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
  batchNo?: string;
  actualWeight?: string;
  grade?: string;
  thickness?: string;
  width?: string;
  length?: string;
  diameter?: string;
  finish?: string;
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

function nonEmpty(value?: string | null | Decimal) {
  if (value == null) return undefined;
  const str = typeof value === "object" ? value.toString() : value;
  return str?.trim() ? str.trim() : undefined;
}

async function createGoodsReceiptInTx(
  tx: Tx,
  session: SessionUser,
  plantId: string,
  input: {
    orderId: string;
    locationId: string;
    notes?: string;
    allowOverReceipt?: boolean;
    overReceiptReason?: string;
    tolerancePct?: number;
    lines: ReceiptLineInput[];
  },
) {
  await lockPurchaseOrder(tx, input.orderId);
  const order = await tx.purchaseOrder.findFirst({
    where: { id: input.orderId, plantId },
    include: { items: { include: { material: true } } },
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
      intendedPlantId: order.plantId,
      orderId: order.id,
      number,
      status: RECEIPT_STATUSES.draft,
      receivedAt: new Date(),
      receivedBy: session.userId,
      notes: input.notes,
    },
  });

  // Audit factory mismatch if receiving plant differs from PO's intended plant
  if (plantId !== order.plantId) {
    await audit(tx, {
      userId: session.userId,
      action: "grn.factory_mismatch",
      resource: "goods_receipt",
      resourceId: receipt.id,
      reason: `PO ${order.number} intended for plant ${order.plantId} but received at plant ${plantId}`,
      payload: {
        intendedPlantId: order.plantId,
        receivingPlantId: plantId,
        poNumber: order.number,
        grnNumber: number,
      },
    });
  }
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
    if (convertQuantity("1", uom, item.material.uom) === null) {
      throw new AppError(409, "UOM_MISMATCH", `Receipt unit ${uom} cannot be converted to material unit ${item.material.uom}.`);
    }
    const outstanding = outstandingMilli(item.qty.toString(), item.receivedQty.toString());
    const reserved = pending.get(item.id) ?? 0n;
    const open = outstanding - reserved;
    const over = assertWithinOutstanding(totals.accepted, open, {
      allowOverReceipt: input.allowOverReceipt,
      tolerancePct: input.tolerancePct,
    });
    if (over.error) {
      throw new AppError(409, "OVER_RECEIPT", "Accepted quantity is above the open order quantity. Authorized manager approval required for excess.");
    }
    if (over.excess > 0n) {
      if (!hasPermission(session, "purchase.approve") && !hasPermission(session, "purchase.manage")) {
        throw new AppError(403, "FORBIDDEN", "Only purchase managers or approvers can authorize over-receipt.");
      }
      await audit(tx, {
        userId: session.userId,
        action: "grn.over_receipt_approved",
        resource: "goods_receipt",
        resourceId: receipt.id,
        reason: input.overReceiptReason ?? "Authorized excess receipt",
        payload: {
          orderId: order.id,
          orderNumber: order.number,
          orderItemId: item.id,
          orderedQty: item.qty.toString(),
          deliveredQty: line.deliveredQty,
          acceptedQty: line.acceptedQty,
          excessQty: fromMilli(over.excess),
          approvedBy: session.userId,
        },
      });
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
        actualWeight: nonEmpty(line.actualWeight),
        heatNo: line.heatNo,
        batchNo: line.batchNo ?? "",
        grade: nonEmpty(line.grade) ?? item.grade,
        thickness: nonEmpty(line.thickness) ?? item.thickness,
        width: nonEmpty(line.width) ?? item.width,
        length: nonEmpty(line.length) ?? item.length,
        diameter: nonEmpty(line.diameter) ?? item.diameter,
        finish: nonEmpty(line.finish),
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
      items: { include: { orderItem: { include: { material: true } } } },
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
    const item = line.orderItem;
    const acceptedQty = toMilli(line.acceptedQty.toString());
    const rejectedQty = toMilli(line.rejectedQty.toString());
    if (acceptedQty + rejectedQty <= 0n) continue;
    const outstanding = outstandingMilli(item.qty.toString(), item.receivedQty.toString());
    const over = assertWithinOutstanding(acceptedQty, outstanding);
    if (over.error) {
      const approvalAudit = await tx.auditEvent.findFirst({
        where: { action: "grn.over_receipt_approved", resourceId: receipt.id },
      });
      if (!approvalAudit && !hasPermission(session, "purchase.approve") && !hasPermission(session, "purchase.manage")) {
        throw new AppError(409, "OVER_RECEIPT", "Accepted quantity is above the open order quantity. Approval required before posting excess.");
      }
    }
    const locationId = line.locationId;
    if (!locationId) throw new AppError(400, "VALIDATION", "Each line needs a storage location before posting.");
    const batchNo = await nextNumber(tx, plantId, "BATCH");
    const acceptedBase = convertQuantity(line.acceptedQty.toString(), line.uom, item.material.uom);
    const rejectedBase = convertQuantity(line.rejectedQty.toString(), line.uom, item.material.uom);
    if (acceptedBase === null || rejectedBase === null) {
      throw new AppError(409, "UOM_MISMATCH", `Receipt unit ${line.uom} cannot be converted to material unit ${item.material.uom}.`);
    }
    const actualWeightKg = nonEmpty(line.actualWeight) ?? (isMassUom(line.uom) ? convertQuantity(line.acceptedQty.toString(), line.uom, "KG") : null);
    const batch = await tx.materialBatch.create({
      data: {
        id: uuidv7(),
        plantId,
        materialId: item.materialId,
        locationId,
        batchNo,
        supplierBatchNo: line.batchNo || null,
        heatNo: line.heatNo,
        grade: nonEmpty(line.grade) ?? (item.grade ? item.grade.toString() : undefined),
        thickness: nonEmpty(line.thickness) ?? (item.thickness ? item.thickness.toString() : undefined),
        width: nonEmpty(line.width) ?? (item.width ? item.width.toString() : undefined),
        length: nonEmpty(line.length) ?? (item.length ? item.length.toString() : undefined),
        diameter: nonEmpty(line.diameter) ?? (item.diameter ? item.diameter.toString() : undefined),
        finish: nonEmpty(line.finish) ?? undefined,
        weight: acceptedBase,
        receivedQty: line.deliveredQty,
        receivedUom: line.uom,
        actualWeightKg,
        qualityStatus: acceptedQty > 0n ? "pending" : "rejected",
        supplierId: receipt.order.supplierId,
        specs: item.specs as Prisma.InputJsonObject,
      },
    });
    await tx.goodsReceiptItem.update({
      where: { id: line.id },
      data: { batchId: batch.id },
    });
    if (acceptedQty > 0n) await postMovement(tx, {
      plantId,
      batchId: batch.id,
      locationId,
      type: "receipt",
      qty: acceptedBase,
      uom: item.material.uom,
      reason: receipt.number,
      referenceType: "goods_receipt",
      referenceId: receipt.id,
      referenceLineId: line.id,
      performedBy: session.userId,
    });
    if (rejectedQty > 0n) await postMovement(tx, {
      plantId, batchId: batch.id, locationId, type: "receipt_reject", qty: rejectedBase,
      uom: item.material.uom, reason: line.rejectionReason ?? receipt.number,
      referenceType: "goods_receipt", referenceId: receipt.id, referenceLineId: line.id,
      performedBy: session.userId,
    });
    if (acceptedQty > 0n) await tx.qcInspection.create({
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
    const kg = convertQuantity(acceptedBase, item.material.uom, "KG");
    if (kg !== null) receivedKg += toMilli(kg);
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

  // Log factory mismatch if receiving plant differs from PO's intended plant (only once on post)
  if (receipt.plantId !== receipt.intendedPlantId && receipt.intendedPlantId) {
    await audit(tx, {
      userId: session.userId,
      action: "grn.posted_factory_mismatch",
      resource: "goods_receipt",
      resourceId: receipt.id,
      reason: `GRN ${receipt.number} posted at plant ${receipt.plantId} but PO intended for plant ${receipt.intendedPlantId}`,
      payload: {
        intendedPlantId: receipt.intendedPlantId,
        receivingPlantId: receipt.plantId,
        grnNumber: receipt.number,
      },
    });
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
    allowOverReceipt?: boolean;
    overReceiptReason?: string;
    tolerancePct?: number;
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
    allowOverReceipt?: boolean;
    overReceiptReason?: string;
    tolerancePct?: number;
    lines: {
      orderItemId: string;
      qty?: string;
      deliveredQty?: string;
      acceptedQty?: string;
      rejectedQty?: string;
      uom?: string;
      heatNo?: string;
      batchNo?: string;
      actualWeight?: string;
      grade?: string;
      thickness?: string;
      width?: string;
      length?: string;
      diameter?: string;
      finish?: string;
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
      uom: line.uom,
      heatNo: line.heatNo,
      batchNo: line.batchNo,
      actualWeight: line.actualWeight,
      grade: line.grade,
      thickness: line.thickness,
      width: line.width,
      length: line.length,
      diameter: line.diameter,
      finish: line.finish,
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
        allowOverReceipt: input.allowOverReceipt,
        overReceiptReason: input.overReceiptReason,
        tolerancePct: input.tolerancePct,
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
