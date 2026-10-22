import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { assertPlant, plantIdsForSession, primaryPlant, requirePermission } from "@/lib/access";
import { uuidv7 } from "@/lib/ids";
import {
  addDaily,
  audit,
  nextNumber,
  postMovement,
  runCommand,
} from "@/lib/inventory/post";
import type { SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { fromMilli, toMilli } from "@/lib/domain/qty";
import { normalizeUom } from "@/lib/domain/uom";

type Tx = Prisma.TransactionClient;

const TRANSFER_STATUSES = {
  draft: "draft",
  approved: "approved",
  in_transit: "in_transit",
  received: "received",
  cancelled: "cancelled",
} as const;

type TransferStatus = (typeof TRANSFER_STATUSES)[keyof typeof TRANSFER_STATUSES];

/**
 * Create a draft inter-factory stock transfer request
 */
export async function createInterFactoryTransfer(
  session: SessionUser,
  input: {
    sourcePlantId: string;
    destinationPlantId: string;
    batchId: string;
    sourceLocationId: string;
    destLocationId: string;
    requestedQty: string;
    uom: string;
    notes?: string;
  },
  key: string | null,
) {
  requirePermission("inventory.move");

  // Validate source and destination are different
  if (input.sourcePlantId === input.destinationPlantId) {
    throw new AppError(400, "VALIDATION", "Source and destination plants must be different.");
  }

  // User must have access to both plants
  const plantIds = await plantIdsForSession(session);
  if (!plantIds.includes(input.sourcePlantId) || !plantIds.includes(input.destinationPlantId)) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to both plants.");
  }

  return runCommand({
    userId: session.userId,
    route: "inventory.inter_factory_transfer.create",
    key,
    run: async (tx) => {
      // Validate batch exists at source plant
      const batch = await tx.materialBatch.findFirst({
        where: { id: input.batchId, plantId: input.sourcePlantId },
        include: { material: true },
      });
      if (!batch) {
        throw new AppError(404, "NOT_FOUND", "Batch not found at source plant.");
      }

      // Validate locations exist at respective plants
      const [sourceLocation, destLocation] = await Promise.all([
        tx.storageLocation.findFirst({
          where: { id: input.sourceLocationId, warehouse: { plantId: input.sourcePlantId } },
        }),
        tx.storageLocation.findFirst({
          where: { id: input.destLocationId, warehouse: { plantId: input.destinationPlantId } },
        }),
      ]);

      if (!sourceLocation) {
        throw new AppError(404, "NOT_FOUND", "Source location not found at source plant.");
      }
      if (!destLocation) {
        throw new AppError(404, "NOT_FOUND", "Destination location not found at destination plant.");
      }

      // Validate UOM
      const uom = normalizeUom(input.uom);
      const materialUom = normalizeUom(batch.material.uom);
      if (uom !== materialUom) {
        throw new AppError(409, "UOM_MISMATCH", `Transfer UOM ${uom} does not match material UOM ${materialUom}.`);
      }

      // Check available stock at source
      const balance = await tx.stockBalance.findUnique({
        where: { batchId_locationId: { batchId: input.batchId, locationId: input.sourceLocationId } },
      });
      if (!balance) {
        throw new AppError(404, "NOT_FOUND", "No stock balance found for this batch at source location.");
      }

      const requested = toMilli(input.requestedQty);
      const available = toMilli(balance.availableQty.toString());
      if (requested > available) {
        throw new AppError(409, "INSUFFICIENT_STOCK", `Available stock is ${balance.availableQty} ${uom}, cannot transfer ${input.requestedQty}.`);
      }

      // Create transfer record
      const transfer = await tx.stockTransfer.create({
        data: {
          id: uuidv7(),
          sourcePlantId: input.sourcePlantId,
          destinationPlantId: input.destinationPlantId,
          batchId: input.batchId,
          sourceLocationId: input.sourceLocationId,
          destLocationId: input.destLocationId,
          requestedQty: input.requestedQty,
          uom,
          status: TRANSFER_STATUSES.draft,
          notes: input.notes,
          createdBy: session.userId,
        },
      });

      await audit(tx, {
        userId: session.userId,
        action: "transfer.create",
        resource: "stock_transfer",
        resourceId: transfer.id,
        reason: input.notes,
      });

      return { id: transfer.id };
    },
  });
}

/**
 * Approve and dispatch an inter-factory transfer
 */
export async function approveInterFactoryTransfer(
  session: SessionUser,
  input: { transferId: string; dispatchedQty: string },
  key: string | null,
) {
  requirePermission("inventory.move");

  return runCommand({
    userId: session.userId,
    route: "inventory.inter_factory_transfer.approve",
    key,
    run: async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: input.transferId },
        include: { batch: true, sourceLocation: true },
      });

      if (!transfer) {
        throw new AppError(404, "NOT_FOUND", "Transfer not found.");
      }

      if (transfer.status !== TRANSFER_STATUSES.draft) {
        throw new AppError(409, "INVALID_STATE", "Only draft transfers can be approved.");
      }

      // User must have access to source plant
      assertPlant(session, transfer.sourcePlantId);

      // Validate dispatched quantity
      const dispatched = toMilli(input.dispatchedQty);
      const requested = toMilli(transfer.requestedQty.toString());
      if (dispatched > requested) {
        throw new AppError(409, "VALIDATION", "Dispatched quantity cannot exceed requested quantity.");
      }

      // Check available stock again (might have changed since draft)
      const balance = await tx.stockBalance.findUnique({
        where: { batchId_locationId: { batchId: transfer.batchId, locationId: transfer.sourceLocationId } },
      });
      if (!balance) {
        throw new AppError(404, "NOT_FOUND", "Stock balance not found.");
      }

      const available = toMilli(balance.availableQty.toString());
      if (dispatched > available) {
        throw new AppError(409, "INSUFFICIENT_STOCK", `Available stock is ${balance.availableQty} ${transfer.uom}, cannot dispatch ${input.dispatchedQty}.`);
      }

      // Create ledger movements: deduct from available, add to in-transit
      await postMovement(tx, {
        plantId: transfer.sourcePlantId,
        batchId: transfer.batchId,
        locationId: transfer.sourceLocationId,
        type: "inter_factory_dispatch_out",
        qty: input.dispatchedQty,
        uom: transfer.uom,
        reason: `Transfer ${transfer.id}`,
        referenceType: "stock_transfer",
        referenceId: transfer.id,
        performedBy: session.userId,
      });

      await postMovement(tx, {
        plantId: transfer.sourcePlantId,
        batchId: transfer.batchId,
        locationId: transfer.sourceLocationId,
        type: "inter_factory_dispatch_in",
        qty: input.dispatchedQty,
        uom: transfer.uom,
        reason: `Transfer ${transfer.id}`,
        referenceType: "stock_transfer",
        referenceId: transfer.id,
        performedBy: session.userId,
      });

      // Update transfer status
      await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: TRANSFER_STATUSES.in_transit,
          dispatchedQty: input.dispatchedQty,
          approvedBy: session.userId,
          approvedAt: new Date(),
          dispatchedBy: session.userId,
          dispatchedAt: new Date(),
        },
      });

      await audit(tx, {
        userId: session.userId,
        action: "transfer.approve",
        resource: "stock_transfer",
        resourceId: transfer.id,
        reason: `Dispatched ${input.dispatchedQty} ${transfer.uom}`,
      });

      return { id: transfer.id };
    },
  });
}

/**
 * Receive an inter-factory transfer at destination
 */
export async function receiveInterFactoryTransfer(
  session: SessionUser,
  input: {
    transferId: string;
    receivedQty: string;
    rejectedQty?: string;
    notes?: string;
  },
  key: string | null,
) {
  requirePermission("inventory.move");

  return runCommand({
    userId: session.userId,
    route: "inventory.inter_factory_transfer.receive",
    key,
    run: async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: input.transferId },
        include: { batch: true, destLocation: true },
      });

      if (!transfer) {
        throw new AppError(404, "NOT_FOUND", "Transfer not found.");
      }

      if (transfer.status !== TRANSFER_STATUSES.in_transit) {
        throw new AppError(409, "INVALID_STATE", "Only in-transit transfers can be received.");
      }

      // User must have access to destination plant
      assertPlant(session, transfer.destinationPlantId);

      const received = toMilli(input.receivedQty);
      const rejected = toMilli(input.rejectedQty ?? "0");
      const dispatched = toMilli(transfer.dispatchedQty.toString());

      // Validate received + rejected = dispatched
      if (received + rejected !== dispatched) {
        throw new AppError(409, "VALIDATION", "Received + rejected quantity must equal dispatched quantity.");
      }

      // Create destination batch (same batch number, different plant)
      const destBatch = await tx.materialBatch.create({
        data: {
          id: uuidv7(),
          plantId: transfer.destinationPlantId,
          materialId: transfer.batch.materialId,
          locationId: transfer.destLocationId,
          batchNo: transfer.batch.batchNo,
          supplierBatchNo: transfer.batch.supplierBatchNo,
          heatNo: transfer.batch.heatNo,
          grade: transfer.batch.grade?.toString(),
          thickness: transfer.batch.thickness,
          width: transfer.batch.width,
          length: transfer.batch.length,
          diameter: transfer.batch.diameter,
          finish: transfer.batch.finish,
          weight: new Decimal(input.receivedQty),
          specs: transfer.batch.specs as Prisma.InputJsonObject,
          qualityStatus: "pending",
          supplierId: transfer.batch.supplierId,
        },
      });

      // Create balance at destination
      await tx.stockBalance.create({
        data: {
          id: uuidv7(),
          plantId: transfer.destinationPlantId,
          batchId: destBatch.id,
          locationId: transfer.destLocationId,
          uom: transfer.uom,
        },
      });

      // Post accepted quantity to available (after QC)
      if (received > 0n) {
        await postMovement(tx, {
          plantId: transfer.destinationPlantId,
          batchId: destBatch.id,
          locationId: transfer.destLocationId,
          type: "receipt",
          qty: input.receivedQty,
          uom: transfer.uom,
          reason: `Transfer ${transfer.id}`,
          referenceType: "stock_transfer",
          referenceId: transfer.id,
          performedBy: session.userId,
        });
      }

      // Post rejected quantity
      if (rejected > 0n) {
        await postMovement(tx, {
          plantId: transfer.destinationPlantId,
          batchId: destBatch.id,
          locationId: transfer.destLocationId,
          type: "receipt_reject",
          qty: input.rejectedQty ?? "0",
          uom: transfer.uom,
          reason: input.notes ?? `Transfer ${transfer.id}`,
          referenceType: "stock_transfer",
          referenceId: transfer.id,
          performedBy: session.userId,
        });
      }

      // Update source transfer status
      await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: TRANSFER_STATUSES.received,
          receivedQty: input.receivedQty,
          rejectedQty: input.rejectedQty ?? "0",
          receivedBy: session.userId,
          receivedAt: new Date(),
        },
      });

      await audit(tx, {
        userId: session.userId,
        action: "transfer.receive",
        resource: "stock_transfer",
        resourceId: transfer.id,
        reason: input.notes,
      });

      return { id: transfer.id, destBatchId: destBatch.id };
    },
  });
}

/**
 * Cancel a draft transfer
 */
export async function cancelInterFactoryTransfer(
  session: SessionUser,
  input: { transferId: string; reason?: string },
  key: string | null,
) {
  requirePermission("inventory.move");

  return runCommand({
    userId: session.userId,
    route: "inventory.inter_factory_transfer.cancel",
    key,
    run: async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: input.transferId },
      });

      if (!transfer) {
        throw new AppError(404, "NOT_FOUND", "Transfer not found.");
      }

      if (transfer.status !== TRANSFER_STATUSES.draft) {
        throw new AppError(409, "INVALID_STATE", "Only draft transfers can be cancelled.");
      }

      // User must have access to source plant
      assertPlant(session, transfer.sourcePlantId);

      await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: TRANSFER_STATUSES.cancelled,
          cancelledBy: session.userId,
          cancelledAt: new Date(),
        },
      });

      await audit(tx, {
        userId: session.userId,
        action: "transfer.cancel",
        resource: "stock_transfer",
        resourceId: transfer.id,
        reason: input.reason,
      });

      return { id: transfer.id };
    },
  });
}
