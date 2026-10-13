import type { SessionUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { primaryPlant } from "@/lib/access";
import {
  canStartJob,
  predecessorsClosed,
  quantitiesReconcile,
  thicknessWithinTolerance,
} from "@/lib/domain/jobs";
import { fromMilli, toMilli } from "@/lib/domain/qty";
import { AppError } from "@/lib/errors";
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
import { recordJobStatus } from "@/modules/production/job-events";

function allow(session: SessionUser, code: string) {
  if (!session.permissions.has(code)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have access to this action.",
    );
  }
}

function allowPlantAdmin(session: SessionUser) {
  if (!session.roles.has("admin")) {
    throw new AppError(403, "FORBIDDEN", "Only the plant admin can edit or delete employees.");
  }
}

function dayValue(value?: string) {
  if (!value) return null;
  return new Date(value);
}

export async function createSupplier(
  session: SessionUser,
  input: { name: string; contact?: string; phone?: string; email?: string },
  key: string | null,
) {
  allow(session, "purchase.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "supplier.create",
    key,
    run: async (tx) => {
      const code = await nextNumber(tx, plantId, "SUP");
      const supplier = await tx.supplier.create({
        data: {
          id: uuidv7(),
          plantId,
          code,
          name: input.name,
          contact: input.contact,
          phone: input.phone,
          email: input.email,
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "supplier.create",
        resource: "supplier",
        resourceId: supplier.id,
      });
      return { id: supplier.id, code: supplier.code };
    },
  });
}

export async function createPurchaseOrder(
  session: SessionUser,
  input: {
    supplierId: string;
    expectedDate?: string;
    notes?: string;
    lines: {
      materialId: string;
      qty: string;
      rate: string;
      grade?: string;
      thickness?: string;
      width?: string;
    }[];
  },
  key: string | null,
) {
  allow(session, "purchase.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "purchase.order",
    key,
    run: async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: input.supplierId, plantId },
      });
      if (!supplier)
        throw new AppError(404, "NOT_FOUND", "Supplier was not found.");
      const materials = await tx.materialMaster.findMany({
        where: {
          plantId,
          id: { in: input.lines.map((line) => line.materialId) },
        },
      });
      if (
        materials.length !==
        new Set(input.lines.map((line) => line.materialId)).size
      ) {
        throw new AppError(
          400,
          "VALIDATION",
          "One of the materials is not in this plant.",
        );
      }
      const number = await nextNumber(tx, plantId, "PO");
      const order = await tx.purchaseOrder.create({
        data: {
          id: uuidv7(),
          plantId,
          supplierId: supplier.id,
          number,
          expectedDate: input.expectedDate
            ? new Date(input.expectedDate)
            : null,
          notes: input.notes,
          createdBy: session.userId,
          items: {
            create: input.lines.map((line) => {
              const material = materials.find(
                (item) => item.id === line.materialId,
              )!;
              return {
                id: uuidv7(),
                materialId: material.id,
                description: material.name,
                grade: line.grade || material.grade,
                thickness:
                  line.thickness || material.thickness?.toString() || null,
                width: line.width || material.width?.toString() || null,
                qty: line.qty,
                rate: line.rate,
                uom: material.uom,
              };
            }),
          },
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "purchase.create",
        resource: "purchase_order",
        resourceId: order.id,
      });
      return { id: order.id, number };
    },
  });
}

export async function approvePurchaseOrder(
  session: SessionUser,
  orderId: string,
  key: string | null,
) {
  allow(session, "purchase.approve");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "purchase.approve",
    key,
    run: async (tx) => {
      const order = await tx.purchaseOrder.findFirst({
        where: { id: orderId, plantId },
      });
      if (!order)
        throw new AppError(404, "NOT_FOUND", "Purchase order was not found.");
      if (order.status !== "pending_approval")
        throw new AppError(
          409,
          "INVALID_STATE",
          "This order is not waiting for approval.",
        );
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: "approved",
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
      return { id: order.id, status: "approved" };
    },
  });
}

export async function receiveGoods(
  session: SessionUser,
  input: {
    orderId: string;
    locationId: string;
    notes?: string;
    lines: {
      orderItemId: string;
      qty: string;
      heatNo?: string;
      batchNo: string;
      grade?: string;
      thickness?: string;
      width?: string;
    }[];
  },
  key: string | null,
) {
  allow(session, "purchase.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "purchase.receipt",
    key,
    run: async (tx) => {
      const order = await tx.purchaseOrder.findFirst({
        where: { id: input.orderId, plantId },
        include: { items: true },
      });
      if (!order)
        throw new AppError(404, "NOT_FOUND", "Purchase order was not found.");
      if (!["approved", "partial"].includes(order.status))
        throw new AppError(
          409,
          "INVALID_STATE",
          "Receive against an approved order.",
        );
      const location = await tx.storageLocation.findFirst({
        where: { id: input.locationId, warehouse: { plantId } },
      });
      if (!location)
        throw new AppError(404, "NOT_FOUND", "Location was not found.");
      const number = await nextNumber(tx, plantId, "GRN");
      const receipt = await tx.goodsReceipt.create({
        data: {
          id: uuidv7(),
          plantId,
          orderId: order.id,
          number,
          receivedAt: new Date(),
          receivedBy: session.userId,
          notes: input.notes,
        },
      });
      let receivedKg = 0n;
      for (const line of input.lines) {
        if (toMilli(line.qty) <= 0n) continue;
        const item = order.items.find((row) => row.id === line.orderItemId);
        if (!item)
          throw new AppError(
            400,
            "VALIDATION",
            "A receipt line does not belong to this order.",
          );
        const remaining =
          toMilli(item.qty.toString()) - toMilli(item.receivedQty.toString());
        if (toMilli(line.qty) > remaining)
          throw new AppError(
            409,
            "OVER_RECEIPT",
            "Received quantity is above the open order quantity.",
          );
        const batch = await tx.materialBatch.create({
          data: {
            id: uuidv7(),
            plantId,
            materialId: item.materialId,
            locationId: location.id,
            batchNo: line.batchNo,
            heatNo: line.heatNo,
            grade: line.grade || item.grade,
            thickness: line.thickness || item.thickness?.toString() || null,
            width: line.width || item.width?.toString() || null,
            weight: line.qty,
            qualityStatus: "pending",
            supplierId: order.supplierId,
          },
        });
        await tx.goodsReceiptItem.create({
          data: {
            id: uuidv7(),
            receiptId: receipt.id,
            orderItemId: item.id,
            batchId: batch.id,
            locationId: location.id,
            qty: line.qty,
            heatNo: line.heatNo,
            batchNo: line.batchNo,
          },
        });
        await postMovement(tx, {
          plantId,
          batchId: batch.id,
          locationId: location.id,
          type: "receipt",
          qty: line.qty,
          reason: number,
          referenceType: "goods_receipt",
          referenceId: receipt.id,
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
          data: { receivedQty: { increment: line.qty } },
        });
        receivedKg += toMilli(line.qty);
      }
      const fresh = await tx.purchaseOrderItem.findMany({
        where: { orderId: order.id },
      });
      const complete = fresh.every(
        (item) =>
          toMilli(item.receivedQty.toString()) >= toMilli(item.qty.toString()),
      );
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: complete ? "received" : "partial" },
      });
      await addDaily(tx, plantId, fromMilli(receivedKg), "0", "0");
      const inspectors = await usersWithPermission(tx, plantId, "qc.decide");
      await notifyUsers(tx, {
        userIds: inspectors,
        type: "material.received",
        title: "Incoming material",
        body: `${number} is waiting for QC.`,
        href: "/quality",
      });
      await audit(tx, {
        userId: session.userId,
        action: "purchase.receive",
        resource: "goods_receipt",
        resourceId: receipt.id,
      });
      return { id: receipt.id, number };
    },
  });
}

export async function transferStock(
  session: SessionUser,
  input: {
    batchId: string;
    fromLocationId: string;
    toLocationId: string;
    qty: string;
    reason: string;
  },
  key: string | null,
) {
  allow(session, "inventory.move");
  const plantId = primaryPlant(session);
  if (input.fromLocationId === input.toLocationId)
    throw new AppError(400, "VALIDATION", "Choose two different locations.");
  return runCommand({
    userId: session.userId,
    route: "inventory.transfer",
    key,
    run: async (tx) => {
      const batch = await tx.materialBatch.findFirst({
        where: { id: input.batchId, plantId },
      });
      if (!batch) throw new AppError(404, "NOT_FOUND", "Batch was not found.");
      const locations = await tx.storageLocation.findMany({
        where: {
          id: { in: [input.fromLocationId, input.toLocationId] },
          warehouse: { plantId },
        },
        select: { id: true },
      });
      if (locations.length !== 2)
        throw new AppError(
          400,
          "VALIDATION",
          "Choose locations from your plant.",
        );
      const source = await tx.stockBalance.findUnique({
        where: {
          batchId_locationId: {
            batchId: batch.id,
            locationId: input.fromLocationId,
          },
        },
      });
      if (!source)
        throw new AppError(
          409,
          "STOCK_MISSING",
          "This batch is not stored at the selected source location.",
        );
      const firstOut = input.fromLocationId < input.toLocationId;
      const move = (type: "transfer_out" | "transfer_in", locationId: string) =>
        postMovement(tx, {
          plantId,
          batchId: batch.id,
          locationId,
          destLocationId: input.toLocationId,
          type,
          qty: input.qty,
          reason: input.reason,
          referenceType: "transfer",
          performedBy: session.userId,
        });
      if (firstOut) {
        await move("transfer_out", input.fromLocationId);
        await move("transfer_in", input.toLocationId);
      } else {
        await move("transfer_in", input.toLocationId);
        await move("transfer_out", input.fromLocationId);
      }
      await tx.materialBatch.update({
        where: { id: batch.id },
        data: { locationId: input.toLocationId },
      });
      await audit(tx, {
        userId: session.userId,
        action: "inventory.transfer",
        resource: "batch",
        resourceId: batch.id,
        reason: input.reason,
      });
      return { id: batch.id };
    },
  });
}

export async function adjustStock(
  session: SessionUser,
  input: { batchId: string; locationId: string; qty: string; reason: string },
  key: string | null,
) {
  allow(session, "inventory.move");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "inventory.adjust",
    key,
    run: async (tx) => {
      const batch = await tx.materialBatch.findFirst({
        where: { id: input.batchId, plantId },
      });
      if (!batch) throw new AppError(404, "NOT_FOUND", "Batch was not found.");
      const location = await tx.storageLocation.findFirst({
        where: { id: input.locationId, warehouse: { plantId } },
      });
      if (!location)
        throw new AppError(
          400,
          "VALIDATION",
          "Choose a location from your plant.",
        );
      if (batch.locationId !== location.id)
        throw new AppError(
          409,
          "LOCATION_MISMATCH",
          "The batch is not stored at this location.",
        );
      await postMovement(tx, {
        plantId,
        batchId: batch.id,
        locationId: input.locationId,
        type: "adjust",
        qty: input.qty,
        reason: input.reason,
        referenceType: "adjustment",
        performedBy: session.userId,
      });
      await audit(tx, {
        userId: session.userId,
        action: "inventory.adjust",
        resource: "batch",
        resourceId: batch.id,
        reason: input.reason,
      });
      return { id: batch.id };
    },
  });
}

export async function decideInspection(
  session: SessionUser,
  inspectionId: string,
  input: { decision: "pass" | "hold" | "fail" | "rework"; remarks?: string },
  key: string | null,
) {
  allow(session, "qc.decide");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "quality.decision",
    key,
    run: async (tx) => {
      const inspection = await tx.qcInspection.findFirst({
        where: { id: inspectionId, plantId },
        include: { batch: true, job: true },
      });
      if (!inspection)
        throw new AppError(404, "NOT_FOUND", "Inspection was not found.");
      if (inspection.status !== "pending" && inspection.status !== "hold")
        throw new AppError(
          409,
          "INVALID_STATE",
          "This inspection is already decided.",
        );
      const status =
        input.decision === "pass"
          ? "pass"
          : input.decision === "hold"
            ? "hold"
            : input.decision === "rework"
              ? "rework"
              : "fail";
      if (inspection.kind === "incoming" && inspection.batch?.locationId) {
        if (input.decision === "pass") {
          await postMovement(tx, {
            plantId,
            batchId: inspection.batch.id,
            locationId: inspection.batch.locationId,
            type: "qc_release",
            qty: inspection.batch.weight.toString(),
            referenceType: "qc",
            referenceId: inspection.id,
            performedBy: session.userId,
          });
          await tx.materialBatch.update({
            where: { id: inspection.batch.id },
            data: { qualityStatus: "pass" },
          });
        } else if (input.decision === "fail") {
          await postMovement(tx, {
            plantId,
            batchId: inspection.batch.id,
            locationId: inspection.batch.locationId,
            type: "qc_reject",
            qty: inspection.batch.weight.toString(),
            referenceType: "qc",
            referenceId: inspection.id,
            performedBy: session.userId,
          });
          await tx.materialBatch.update({
            where: { id: inspection.batch.id },
            data: { qualityStatus: "rejected" },
          });
        }
      }
      if (inspection.kind === "in_process" && inspection.job) {
        await tx.jobCard.update({
          where: { id: inspection.job.id },
          data: { qcStatus: status === "pass" ? "pass" : status },
        });
        if (input.decision === "rework" || input.decision === "fail") {
          await tx.jobCard.update({
            where: { id: inspection.job.id },
            data: {
              status: "ready",
              approvalStatus: "rejected",
              instructions: input.remarks || "Correct and resubmit this job.",
            },
          });
        }
      }
      if (inspection.kind === "final" && inspection.batch?.locationId) {
        const balance = await tx.stockBalance.findUnique({
          where: {
            batchId_locationId: {
              batchId: inspection.batch.id,
              locationId: inspection.batch.locationId,
            },
          },
        });
        const held = balance?.qcHoldQty.toString() ?? "0";
        if (toMilli(held) <= 0n) {
          await tx.materialBatch.update({
            where: { id: inspection.batch.id },
            data: {
              qualityStatus: input.decision === "pass" ? "pass" : "rejected",
            },
          });
        } else if (input.decision === "pass") {
          const successors = inspection.job
            ? await tx.jobDependency.findMany({
                where: { predecessorId: inspection.job.id },
                include: { successor: true },
              })
            : [];
          if (successors.length > 1)
            throw new AppError(
              409,
              "ROUTING_BRANCH_UNSUPPORTED",
              "A routed output can currently feed one next operation.",
            );
          const next = successors[0]?.successor;
          await postMovement(tx, {
            plantId,
            batchId: inspection.batch.id,
            locationId: inspection.batch.locationId,
            type: next ? "qc_release" : "finish_release",
            qty: held,
            referenceType: "qc",
            referenceId: inspection.id,
            performedBy: session.userId,
          });
          if (next) {
            await postMovement(tx, {
              plantId,
              batchId: inspection.batch.id,
              locationId: inspection.batch.locationId,
              type: "reserve",
              qty: held,
              referenceType: "job",
              referenceId: next.id,
              performedBy: session.userId,
            });
            await tx.jobCard.update({
              where: { id: next.id },
              data: {
                batchId: inspection.batch.id,
                locationId: inspection.batch.locationId,
                allocatedQty: held,
                status: next.assigneeId ? "ready" : "draft",
              },
            });
          } else if (inspection.job) {
            const openJobs = await tx.jobCard.count({
              where: {
                productionOrderId: inspection.job.productionOrderId,
                id: { not: inspection.job.id },
                status: { notIn: ["closed", "cancelled"] },
              },
            });
            if (openJobs === 0) {
              await tx.productionOrder.update({
                where: { id: inspection.job.productionOrderId },
                data: { status: "completed" },
              });
            }
          }
          await tx.materialBatch.update({
            where: { id: inspection.batch.id },
            data: { qualityStatus: "pass" },
          });
        } else if (input.decision === "fail") {
          await postMovement(tx, {
            plantId,
            batchId: inspection.batch.id,
            locationId: inspection.batch.locationId,
            type: "qc_reject",
            qty: held,
            referenceType: "qc",
            referenceId: inspection.id,
            performedBy: session.userId,
          });
          await tx.materialBatch.update({
            where: { id: inspection.batch.id },
            data: { qualityStatus: "rejected" },
          });
        }
      }
      await tx.qcInspection.update({
        where: { id: inspection.id },
        data: {
          status,
          remarks: input.remarks,
          inspectorId: session.userId,
          decidedAt: new Date(),
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "qc.decision",
        resource: "qc_inspection",
        resourceId: inspection.id,
        reason: input.remarks,
        payload: { decision: input.decision },
      });
      return { id: inspection.id, status };
    },
  });
}

export async function createProductionOrder(
  session: SessionUser,
  input: {
    productId: string;
    sourceBatchId: string;
    locationId: string;
    inputQty: string;
    targetQty: string;
    priority?: "low" | "normal" | "high";
  },
  key: string | null,
) {
  allow(session, "production.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "production.create",
    key,
    run: async (tx) => {
      const product = await tx.materialMaster.findFirst({
        where: { id: input.productId, plantId },
      });
      const batch = await tx.materialBatch.findFirst({
        where: { id: input.sourceBatchId, plantId },
      });
      if (!product || !batch)
        throw new AppError(
          404,
          "NOT_FOUND",
          "Product or source batch was not found.",
        );
      const balance = await tx.stockBalance.findUnique({
        where: {
          batchId_locationId: {
            batchId: batch.id,
            locationId: input.locationId,
          },
        },
      });
      if (
        !balance ||
        toMilli(balance.availableQty.toString()) < toMilli(input.inputQty)
      ) {
        throw new AppError(
          409,
          "INSUFFICIENT_STOCK",
          "The selected batch does not have enough available stock at this location.",
        );
      }
      const number = await nextNumber(tx, plantId, "MO");
      const order = await tx.productionOrder.create({
        data: {
          id: uuidv7(),
          plantId,
          number,
          productId: product.id,
          sourceBatchId: batch.id,
          locationId: input.locationId,
          inputQty: input.inputQty,
          targetQty: input.targetQty,
          priority: input.priority ?? "normal",
          createdBy: session.userId,
          uom: "KG",
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "production.create",
        resource: "production_order",
        resourceId: order.id,
      });
      return { id: order.id, number };
    },
  });
}

export async function releaseProductionOrder(
  session: SessionUser,
  orderId: string,
  key: string | null,
) {
  allow(session, "production.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "production.release",
    key,
    run: async (tx) => {
      const order = await tx.productionOrder.findFirst({
        where: { id: orderId, plantId },
      });
      if (!order || !order.sourceBatchId)
        throw new AppError(404, "NOT_FOUND", "Production order was not found.");
      if (order.status !== "draft")
        throw new AppError(
          409,
          "INVALID_STATE",
          "Only a draft order can be released.",
        );
      await postMovement(tx, {
        plantId,
        batchId: order.sourceBatchId,
        locationId: order.locationId,
        type: "reserve",
        qty: order.inputQty.toString(),
        reason: order.number,
        referenceType: "production_order",
        referenceId: order.id,
        performedBy: session.userId,
      });
      const routing = await tx.routingHeader.findFirst({
        where: { plantId, productId: order.productId, active: true },
        include: { operations: { orderBy: { sequence: "asc" } } },
      });
      const steps = routing?.operations.length
        ? routing.operations
        : [{ sequence: 1, name: "Process" }];
      const jobIds: string[] = [];
      for (const step of steps) {
        const id = uuidv7();
        const number = await nextNumber(tx, plantId, "JOB");
        await tx.jobCard.create({
          data: {
            id,
            plantId,
            productionOrderId: order.id,
            number,
            sequence: step.sequence,
            name: step.name,
            status: "draft",
            locationId: order.locationId,
            batchId: step.sequence === 1 ? order.sourceBatchId : null,
            targetQty: order.targetQty,
            allocatedQty: step.sequence === 1 ? order.inputQty : 0,
            uom: order.uom,
          },
        });
        jobIds.push(id);
      }
      for (let index = 1; index < jobIds.length; index += 1) {
        await tx.jobDependency.create({
          data: {
            predecessorId: jobIds[index - 1]!,
            successorId: jobIds[index]!,
          },
        });
      }
      await tx.productionOrder.update({
        where: { id: order.id },
        data: { status: "released" },
      });
      const supervisors = await usersWithPermission(tx, plantId, "job.assign");
      await notifyUsers(tx, {
        userIds: supervisors,
        type: "production.released",
        title: "Order released",
        body: `${order.number} is ready to assign.`,
        href: `/production/${order.id}`,
      });
      await audit(tx, {
        userId: session.userId,
        action: "production.release",
        resource: "production_order",
        resourceId: order.id,
      });
      return { id: order.id, jobs: jobIds.length };
    },
  });
}

async function loadJob(
  tx: Parameters<Parameters<typeof runCommand>[0]["run"]>[0],
  id: string,
  plantId: string,
) {
  const job = await tx.jobCard.findFirst({
    where: { id, plantId },
    include: {
      machine: true,
      batch: true,
      assignee: true,
      predecessors: { include: { predecessor: true } },
      productionOrder: true,
    },
  });
  if (!job) throw new AppError(404, "NOT_FOUND", "Job was not found.");
  return job;
}

export async function createJob(
  session: SessionUser,
  input: {
    name: string;
    productId: string;
    sourceBatchId?: string;
    inputQty?: string;
    targetQty: string;
  },
  key: string | null,
) {
  allow(session, "job.assign");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "job.create",
    key,
    run: async (tx) => {
      const product = await tx.materialMaster.findFirst({
        where: { id: input.productId, plantId },
        include: {
          defaultBomHeader: true,
          defaultRouting: { include: { operations: { orderBy: { sequence: "asc" }, take: 1 } } },
        },
      });
      if (!product)
        throw new AppError(404, "NOT_FOUND", "Product was not found.");
      const activeBom =
        product.defaultBomHeader ??
        (await tx.bomHeader.findFirst({
          where: { plantId, productId: product.id, active: true },
          orderBy: { version: "desc" },
        }));
      const activeRouting =
        product.defaultRouting ??
        (await tx.routingHeader.findFirst({
          where: { plantId, productId: product.id, active: true },
          include: { operations: { orderBy: { sequence: "asc" }, take: 1 } },
        }));
      const firstOp = activeRouting?.operations[0];
      const batchId = input.sourceBatchId || null;
      const batch = batchId
        ? await tx.materialBatch.findFirst({ where: { id: batchId, plantId } })
        : null;
      if (batchId && !batch)
        throw new AppError(404, "NOT_FOUND", "Source batch was not found.");
      const balance = batch
        ? await tx.stockBalance.findFirst({
            where: { batchId: batch.id, plantId },
            orderBy: { availableQty: "desc" },
          })
        : null;
      const fallback = await tx.storageLocation.findFirst({
        where: { warehouse: { plantId } },
      });
      const locationId =
        balance?.locationId ?? batch?.locationId ?? fallback?.id;
      if (!locationId)
        throw new AppError(
          400,
          "VALIDATION",
          "Add a warehouse location before creating a job.",
        );
      const inputQty =
        input.inputQty && toMilli(input.inputQty) > 0n
          ? input.inputQty
          : input.targetQty;
      const orderNumber = await nextNumber(tx, plantId, "MO");
      const order = await tx.productionOrder.create({
        data: {
          id: uuidv7(),
          plantId,
          number: orderNumber,
          productId: product.id,
          sourceBatchId: batch?.id,
          locationId,
          inputQty,
          targetQty: input.targetQty,
          status: batch ? "released" : "draft",
          createdBy: session.userId,
          uom: "KG",
        },
      });
      if (batch && balance && toMilli(inputQty) > 0n) {
        await postMovement(tx, {
          plantId,
          batchId: batch.id,
          locationId: balance.locationId,
          type: "reserve",
          qty: inputQty,
          reason: orderNumber,
          referenceType: "production_order",
          referenceId: order.id,
          performedBy: session.userId,
        });
      }
      const number = await nextNumber(tx, plantId, "JOB");
      const job = await tx.jobCard.create({
        data: {
          id: uuidv7(),
          plantId,
          productionOrderId: order.id,
          number,
          sequence: 1,
          name: input.name,
          status: "draft",
          priority: order.priority,
          salesOrderId: order.salesOrderId,
          salesOrderItemId: order.salesOrderItemId,
          bomHeaderId: activeBom?.id ?? null,
          bomVersion: activeBom?.version ?? null,
          routingId: activeRouting?.id ?? null,
          currentStage: firstOp?.name ?? null,
          locationId,
          batchId: batch?.id,
          targetQty: input.targetQty,
          allocatedQty: batch && balance ? inputQty : 0,
          uom: product.uom,
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "job.create",
        resource: "job",
        resourceId: job.id,
      });
      return { id: job.id, number };
    },
  });
}

export async function assignJob(
  session: SessionUser,
  jobId: string,
  input: {
    employeeId: string;
    machineId: string;
    dieId?: string;
    plannedStart?: string;
    plannedEnd?: string;
  },
  key: string | null,
) {
  allow(session, "job.assign");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "job.assign",
    key,
    run: async (tx) => {
      const job = await loadJob(tx, jobId, plantId);
      if (!["draft", "assigned", "ready"].includes(job.status))
        throw new AppError(
          409,
          "INVALID_STATE",
          "This job can no longer be assigned.",
        );
      const employee = await tx.employee.findFirst({
        where: { id: input.employeeId, plantId, active: true },
      });
      const machine = await tx.machine.findFirst({
        where: { id: input.machineId, plantId },
      });
      if (!employee || !machine)
        throw new AppError(
          404,
          "NOT_FOUND",
          "Employee or machine was not found.",
        );
      if (machine.status === "down")
        throw new AppError(
          409,
          "MACHINE_BLOCKED",
          "This machine is blocked for maintenance.",
        );
      if (
        employee.skill &&
        !employee.skill
          .toLowerCase()
          .includes(machine.machineType.toLowerCase()) &&
        employee.skill.toLowerCase() !== "all"
      ) {
        throw new AppError(
          409,
          "SKILL_MISMATCH",
          "This employee is not authorized for this machine.",
        );
      }
      const dieId = input.dieId || null;
      if (dieId) {
        const die = await tx.die.findFirst({ where: { id: dieId, plantId } });
        if (!die || (die.status !== "available" && die.id !== job.dieId))
          throw new AppError(
            409,
            "DIE_UNAVAILABLE",
            "That die is not available.",
          );
        await tx.die.update({
          where: { id: die.id },
          data: { status: "in_use" },
        });
      }
      if (job.dieId && job.dieId !== dieId) {
        await tx.die.update({
          where: { id: job.dieId },
          data: { status: "available" },
        });
      }
      const predecessorStatuses = job.predecessors.map(
        (link) => link.predecessor.status,
      );
      const status = predecessorsClosed(predecessorStatuses)
        ? "ready"
        : "assigned";
      await tx.jobCard.update({
        where: { id: job.id },
        data: {
          assigneeId: employee.id,
          machineId: machine.id,
          dieId,
          plannedStart: dayValue(input.plannedStart),
          plannedEnd: dayValue(input.plannedEnd),
          status,
          supervisorId: session.employeeId,
        },
      });
      await recordJobStatus(tx, job.id, session.userId, job.status, status);
      if (employee.userId) {
        await notifyUsers(tx, {
          userIds: [employee.userId],
          type: "job.assigned",
          title: "Job assigned",
          body: `${job.number} is on your shift.`,
          href: `/shop/jobs/${job.id}`,
        });
      }
      await audit(tx, {
        userId: session.userId,
        action: "job.assign",
        resource: "job",
        resourceId: job.id,
      });
      return { id: job.id, status };
    },
  });
}

export async function startJob(
  session: SessionUser,
  jobId: string,
  input: { openingReading?: string; confirmed: true },
  key: string | null,
) {
  allow(session, "job.execute");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "job.start",
    key,
    run: async (tx) => {
      const job = await loadJob(tx, jobId, plantId);
      const blocked = canStartJob({
        status: job.status,
        approvalStatus: job.approvalStatus,
        assigneeId: job.assigneeId,
        actorEmployeeId: session.employeeId,
        predecessors: job.predecessors.map((link) => link.predecessor.status),
        machineBlocked: job.machine?.status === "down",
      });
      if (blocked === "FORBIDDEN")
        throw new AppError(
          403,
          "FORBIDDEN",
          "Only the assigned operator can start this job.",
        );
      if (blocked)
        throw new AppError(
          409,
          blocked,
          blocked === "DEPENDENCY_OPEN"
            ? "The previous job is still open."
            : blocked === "MACHINE_BLOCKED"
              ? "This machine is blocked."
              : "This job is not ready to start.",
        );
      if (!job.machineId || !job.batchId)
        throw new AppError(
          409,
          "NOT_READY",
          "Machine and material batch are required.",
        );
      if (job.machine?.readingRequired && !input.openingReading)
        throw new AppError(
          400,
          "READING_REQUIRED",
          "Opening counter is required.",
        );
      const busy = await tx.jobSession.findFirst({
        where: {
          machineId: job.machineId,
          status: { in: ["in_progress", "paused"] },
        },
      });
      if (busy)
        throw new AppError(
          409,
          "MACHINE_BUSY",
          "This machine already has an active job.",
        );
      if (
        job.approvalStatus !== "rejected" &&
        toMilli(job.allocatedQty.toString()) > 0n
      ) {
        await postMovement(tx, {
          plantId,
          batchId: job.batchId,
          locationId: job.locationId,
          type: "issue",
          qty: job.allocatedQty.toString(),
          referenceType: "job",
          referenceId: job.id,
          performedBy: session.userId,
        });
      }
      await tx.jobSession.create({
        data: {
          id: uuidv7(),
          jobId: job.id,
          machineId: job.machineId,
          employeeId: session.employeeId!,
          status: "in_progress",
          openingReading: input.openingReading || null,
        },
      });
      await tx.machine.update({
        where: { id: job.machineId },
        data: { status: "running" },
      });
      await tx.jobCard.update({
        where: { id: job.id },
        data: {
          status: "in_progress",
          approvalStatus: "pending",
          actualStart: job.actualStart ?? new Date(),
        },
      });
      await recordJobStatus(tx, job.id, session.userId, job.status, "in_progress");
      await audit(tx, {
        userId: session.userId,
        action: "job.start",
        resource: "job",
        resourceId: job.id,
      });
      return { id: job.id, status: "in_progress" };
    },
  });
}

export async function pauseJob(
  session: SessionUser,
  jobId: string,
  input: { reason: string },
  key: string | null,
) {
  allow(session, "job.execute");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "job.pause",
    key,
    run: async (tx) => {
      const job = await loadJob(tx, jobId, plantId);
      if (job.assigneeId !== session.employeeId)
        throw new AppError(
          403,
          "FORBIDDEN",
          "Only the assigned operator can pause this job.",
        );
      if (job.status !== "in_progress" && job.status !== "paused")
        throw new AppError(409, "INVALID_STATE", "This job is not running.");
      const next = job.status === "paused" ? "in_progress" : "paused";
      await tx.jobSession.updateMany({
        where: { jobId: job.id, status: { in: ["in_progress", "paused"] } },
        data: { status: next, pauseReason: input.reason },
      });
      await tx.jobCard.update({
        where: { id: job.id },
        data: { status: next },
      });
      await audit(tx, {
        userId: session.userId,
        action: "job.pause",
        resource: "job",
        resourceId: job.id,
        reason: input.reason,
      });
      return { id: job.id, status: next };
    },
  });
}

export async function progressJob(
  session: SessionUser,
  jobId: string,
  input: {
    goodQty: string;
    rejectQty: string;
    scrapQty: string;
    notes?: string;
  },
  key: string | null,
) {
  allow(session, "job.execute");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "job.progress",
    key,
    run: async (tx) => {
      const job = await loadJob(tx, jobId, plantId);
      if (job.assigneeId !== session.employeeId)
        throw new AppError(
          403,
          "FORBIDDEN",
          "Only the assigned operator can update this job.",
        );
      if (!["in_progress", "paused"].includes(job.status))
        throw new AppError(
          409,
          "INVALID_STATE",
          "Start the job before entering progress.",
        );
      await tx.jobCard.update({
        where: { id: job.id },
        data: {
          goodQty: input.goodQty,
          rejectQty: input.rejectQty,
          scrapQty: input.scrapQty,
        },
      });
      await tx.jobSession.updateMany({
        where: { jobId: job.id, status: { in: ["in_progress", "paused"] } },
        data: { notes: input.notes },
      });
      return { id: job.id };
    },
  });
}

export async function submitJob(
  session: SessionUser,
  jobId: string,
  input: {
    goodQty: string;
    rejectQty: string;
    scrapQty: string;
    consumedQty: string;
    closingReading?: string;
    thickness?: string;
    notes?: string;
  },
  key: string | null,
) {
  allow(session, "job.execute");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "job.submit",
    key,
    run: async (tx) => {
      const job = await loadJob(tx, jobId, plantId);
      if (job.assigneeId !== session.employeeId)
        throw new AppError(
          403,
          "FORBIDDEN",
          "Only the assigned operator can submit this job.",
        );
      if (!["in_progress", "paused"].includes(job.status)) {
        throw new AppError(
          409,
          "INVALID_STATE",
          "This job cannot be submitted now.",
        );
      }
      const mismatch = quantitiesReconcile({
        consumed: toMilli(input.consumedQty),
        good: toMilli(input.goodQty),
        reject: toMilli(input.rejectQty),
        scrap: toMilli(input.scrapQty),
      });
      if (mismatch)
        throw new AppError(
          400,
          mismatch,
          mismatch === "QTY_MISMATCH"
            ? "Good, reject, and scrap must reconcile with consumption."
            : "Quantities cannot be negative.",
        );
      const sessionRow = await tx.jobSession.findFirst({
        where: { jobId: job.id },
        orderBy: { startedAt: "desc" },
      });
      if (job.machine?.readingRequired) {
        if (!input.closingReading)
          throw new AppError(
            400,
            "READING_REQUIRED",
            "Closing counter is required.",
          );
        if (
          sessionRow?.openingReading &&
          Number(input.closingReading) < Number(sessionRow.openingReading)
        ) {
          throw new AppError(
            400,
            "READING_INVALID",
            "Closing counter is below the opening counter.",
          );
        }
      }
      let outOfTolerance = false;
      if (input.thickness && job.batch?.thickness)
        outOfTolerance = !thicknessWithinTolerance(
          Number(input.thickness),
          Number(job.batch.thickness),
        );
      const version =
        (await tx.jobSubmission.count({ where: { jobId: job.id } })) + 1;
      await tx.jobSubmission.create({
        data: {
          id: uuidv7(),
          jobId: job.id,
          version,
          goodQty: input.goodQty,
          rejectQty: input.rejectQty,
          scrapQty: input.scrapQty,
          consumedQty: input.consumedQty,
          closingReading: input.closingReading || null,
          notes: input.notes,
          submittedBy: session.userId,
          measurements: { thickness: input.thickness ?? null, outOfTolerance },
        },
      });
      if (sessionRow && ["in_progress", "paused"].includes(sessionRow.status)) {
        await tx.jobSession.update({
          where: { id: sessionRow.id },
          data: {
            status: "ended",
            endedAt: new Date(),
            closingReading: input.closingReading || null,
          },
        });
      }
      if (job.machineId)
        await tx.machine.update({
          where: { id: job.machineId },
          data: { status: job.machine?.status === "down" ? "down" : "idle" },
        });
      await tx.jobCard.update({
        where: { id: job.id },
        data: {
          status: "submitted",
          qcStatus: "pending",
          approvalStatus: "pending",
          goodQty: input.goodQty,
          rejectQty: input.rejectQty,
          scrapQty: input.scrapQty,
        },
      });
      await tx.qcInspection.create({
        data: {
          id: uuidv7(),
          plantId,
          kind: "in_process",
          jobId: job.id,
          batchId: job.batchId,
          measurements: { thickness: input.thickness ?? null, outOfTolerance },
        },
      });
      const reviewers = await usersWithPermission(tx, plantId, "job.approve");
      const inspectors = await usersWithPermission(tx, plantId, "qc.decide");
      await notifyUsers(tx, {
        userIds: [...reviewers, ...inspectors],
        type: "job.submitted",
        title: "Job submitted",
        body: `${job.number} is waiting for review.`,
        href: `/jobs/${job.id}`,
      });
      await audit(tx, {
        userId: session.userId,
        action: "job.submit",
        resource: "job",
        resourceId: job.id,
      });
      return { id: job.id, status: "submitted" };
    },
  });
}

export async function approveJob(
  session: SessionUser,
  jobId: string,
  key: string | null,
) {
  allow(session, "job.approve");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "job.approve",
    key,
    run: async (tx) => {
      const job = await loadJob(tx, jobId, plantId);
      if (job.status !== "submitted")
        throw new AppError(
          409,
          "INVALID_STATE",
          "Submit the job before approval.",
        );
      if (job.qcStatus !== "pass")
        throw new AppError(
          409,
          "QC_PENDING",
          "Quality must pass before this job can be approved.",
        );
      const submission = await tx.jobSubmission.findFirst({
        where: { jobId: job.id },
        orderBy: { version: "desc" },
      });
      if (!submission)
        throw new AppError(
          409,
          "INVALID_STATE",
          "The submission record is missing.",
        );
      let outputBatchId: string | null = job.outputBatchId;
      if (toMilli(job.allocatedQty.toString()) > 0n || job.reworkOfJobId) {
        if (!job.batchId)
          throw new AppError(
            409,
            "BATCH_REQUIRED",
            "The source batch is missing.",
          );
        const consumed = toMilli(submission.consumedQty.toString());
        const issued = toMilli(job.allocatedQty.toString());
        if (consumed > 0n) {
          await postMovement(tx, {
            plantId,
            batchId: job.batchId,
            locationId: job.locationId,
            type: "consume",
            qty: submission.consumedQty.toString(),
            referenceType: "job",
            referenceId: job.id,
            performedBy: session.userId,
          });
        }
        if (issued > consumed) {
          await postMovement(tx, {
            plantId,
            batchId: job.batchId,
            locationId: job.locationId,
            type: "return",
            qty: fromMilli(issued - consumed),
            referenceType: "job",
            referenceId: job.id,
            performedBy: session.userId,
          });
        }
        const batchNo = await nextNumber(tx, plantId, "BATCH");
        const output = await tx.materialBatch.create({
          data: {
            id: uuidv7(),
            plantId,
            materialId: job.productionOrder.productId,
            locationId: job.locationId,
            batchNo,
            heatNo: job.batch?.heatNo,
            grade: job.batch?.grade,
            thickness: job.batch?.thickness,
            width: job.batch?.width,
            weight: submission.goodQty,
            qualityStatus: "pending",
            specs: { jobId: job.id, sourceBatchId: job.batchId },
          },
        });
        outputBatchId = output.id;
        if (toMilli(submission.goodQty.toString()) > 0n) {
          await postMovement(tx, {
            plantId,
            batchId: output.id,
            locationId: job.locationId,
            type: "output",
            qty: submission.goodQty.toString(),
            referenceType: "job",
            referenceId: job.id,
            performedBy: session.userId,
          });
          await tx.batchLink.create({
            data: {
              id: uuidv7(),
              parentBatchId: job.batchId,
              childBatchId: output.id,
              qty: submission.goodQty,
              uom: "KG",
              linkType: "output",
            },
          });
        }
        if (toMilli(submission.scrapQty.toString()) > 0n) {
          await postMovement(tx, {
            plantId,
            batchId: output.id,
            locationId: job.locationId,
            type: "scrap",
            qty: submission.scrapQty.toString(),
            referenceType: "job",
            referenceId: job.id,
            performedBy: session.userId,
          });
        }
        if (toMilli(submission.rejectQty.toString()) > 0n) {
          await postMovement(tx, {
            plantId,
            batchId: output.id,
            locationId: job.locationId,
            type: "reject_output",
            qty: submission.rejectQty.toString(),
            referenceType: "job",
            referenceId: job.id,
            performedBy: session.userId,
          });
        }
        await tx.qcInspection.create({
          data: {
            id: uuidv7(),
            plantId,
            kind: "final",
            batchId: output.id,
            jobId: job.id,
          },
        });
        await addDaily(
          tx,
          plantId,
          "0",
          submission.goodQty.toString(),
          submission.scrapQty.toString(),
        );
      }
      if (job.dieId)
        await tx.die.update({
          where: { id: job.dieId },
          data: { status: "available", lifeUsed: { increment: 1 } },
        });
      await tx.jobCard.update({
        where: { id: job.id },
        data: {
          status: "closed",
          approvalStatus: "approved",
          outputBatchId,
          actualEnd: job.actualEnd ?? new Date(),
          closedAt: new Date(),
          completedBy: session.userId,
        },
      });
      if (job.assignee?.userId) {
        await notifyUsers(tx, {
          userIds: [job.assignee.userId],
          type: "job.approved",
          title: "Job approved",
          body: `${job.number} was approved.`,
          href: `/shop/jobs/${job.id}`,
        });
      }
      await audit(tx, {
        userId: session.userId,
        action: "job.approve",
        resource: "job",
        resourceId: job.id,
      });
      return { id: job.id, status: "closed", outputBatchId };
    },
  });
}

export async function requestCorrection(
  session: SessionUser,
  jobId: string,
  input: { reason: string },
  key: string | null,
) {
  allow(session, "job.approve");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "job.correction",
    key,
    run: async (tx) => {
      const job = await loadJob(tx, jobId, plantId);
      if (job.status !== "submitted")
        throw new AppError(
          409,
          "INVALID_STATE",
          "Only a submitted job can be sent back.",
        );
      await tx.jobCard.update({
        where: { id: job.id },
        data: {
          status: "ready",
          approvalStatus: "rejected",
          qcStatus: "pending",
          instructions: input.reason,
        },
      });
      if (job.assignee?.userId) {
        await notifyUsers(tx, {
          userIds: [job.assignee.userId],
          type: "job.correction",
          title: "Correction requested",
          body: input.reason,
          href: `/shop/jobs/${job.id}/submit`,
        });
      }
      await audit(tx, {
        userId: session.userId,
        action: "job.correction",
        resource: "job",
        resourceId: job.id,
        reason: input.reason,
      });
      return { id: job.id, status: "in_progress" };
    },
  });
}

export async function dispatchGoods(
  session: SessionUser,
  input: { customerId: string; batchId: string; qty: string; salesOrderItemId?: string },
  key: string | null,
) {
  allow(session, "dispatch.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "dispatch.create",
    key,
    run: async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: input.customerId, plantId },
      });
      const batch = await tx.materialBatch.findFirst({
        where: { id: input.batchId, plantId },
      });
      if (!customer || !batch?.locationId)
        throw new AppError(
          404,
          "NOT_FOUND",
          "Customer or batch was not found.",
        );
      if (batch.qualityStatus !== "pass")
        throw new AppError(
          409,
          "QC_PENDING",
          "Only quality-passed finished goods can be dispatched.",
        );

      let orderId: string;
      let salesOrderItemId = input.salesOrderItemId ?? null;

      if (salesOrderItemId) {
        const line = await tx.salesOrderItem.findFirst({
          where: { id: salesOrderItemId },
          include: { order: true },
        });
        if (!line || line.order.plantId !== plantId || line.order.customerId !== customer.id) {
          throw new AppError(404, "NOT_FOUND", "Sales line not found for this customer.");
        }
        const open =
          toMilli(line.qtyOrdered.toString()) - toMilli(line.qtyDispatched.toString());
        if (toMilli(input.qty) > open) {
          throw new AppError(409, "QTY_EXCEEDS_OPEN", "Dispatch quantity exceeds the open sales line.");
        }
        orderId = line.orderId;
        await tx.salesOrderItem.update({
          where: { id: line.id },
          data: { qtyDispatched: { increment: input.qty }, batchId: batch.id },
        });
        const allLines = await tx.salesOrderItem.findMany({ where: { orderId: line.orderId } });
        const complete = allLines.every(
          (row) =>
            toMilli(row.qtyDispatched.toString()) >= toMilli(row.qtyOrdered.toString()),
        );
        await tx.salesOrder.update({
          where: { id: line.orderId },
          data: { status: complete ? "completed" : "partially_dispatched" },
        });
      } else {
        const orderNo = await nextNumber(tx, plantId, "SO");
        const product = await tx.materialMaster.findFirst({ where: { id: batch.materialId, plantId } });
        if (!product) throw new AppError(404, "NOT_FOUND", "Batch material not found.");
        const order = await tx.salesOrder.create({
          data: {
            id: uuidv7(),
            plantId,
            customerId: customer.id,
            number: orderNo,
            status: "dispatched",
            items: {
              create: {
                id: uuidv7(),
                productId: product.id,
                batchId: batch.id,
                qtyOrdered: input.qty,
                qtyDispatched: input.qty,
                uom: product.uom,
              },
            },
          },
        });
        orderId = order.id;
        salesOrderItemId = (await tx.salesOrderItem.findFirst({ where: { orderId: order.id } }))!.id;
      }

      const shipNo = await nextNumber(tx, plantId, "SHP");
      const shipment = await tx.shipment.create({
        data: {
          id: uuidv7(),
          plantId,
          orderId,
          number: shipNo,
          shippedAt: new Date(),
          shippedBy: session.userId,
          items: {
            create: {
              id: uuidv7(),
              batchId: batch.id,
              salesOrderItemId,
              qty: input.qty,
              uom: batch.materialId ? (await tx.materialMaster.findUnique({ where: { id: batch.materialId } }))?.uom ?? "KG" : "KG",
            },
          },
        },
      });
      await postMovement(tx, {
        plantId,
        batchId: batch.id,
        locationId: batch.locationId,
        type: "dispatch",
        qty: input.qty,
        referenceType: "shipment",
        referenceId: shipment.id,
        performedBy: session.userId,
      });
      await audit(tx, {
        userId: session.userId,
        action: "dispatch.create",
        resource: "shipment",
        resourceId: shipment.id,
      });
      return { id: shipment.id, number: shipNo };
    },
  });
}

export async function openMaintenance(
  session: SessionUser,
  input: { machineId: string; issue: string },
  key: string | null,
) {
  allow(session, "machine.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "maintenance.open",
    key,
    run: async (tx) => {
      const machine = await tx.machine.findFirst({
        where: { id: input.machineId, plantId },
      });
      if (!machine)
        throw new AppError(404, "NOT_FOUND", "Machine was not found.");
      const active = await tx.jobSession.findFirst({
        where: {
          machineId: machine.id,
          status: { in: ["in_progress", "paused"] },
        },
      });
      if (active)
        throw new AppError(
          409,
          "MACHINE_BUSY",
          "Pause and finish the active job before opening maintenance.",
        );
      const openTicket = await tx.maintenanceWorkOrder.findFirst({
        where: { machineId: machine.id, status: "open" },
      });
      if (openTicket)
        throw new AppError(
          409,
          "MAINTENANCE_OPEN",
          "This machine already has an open maintenance ticket.",
        );
      const number = await nextNumber(tx, plantId, "MWO");
      const ticket = await tx.maintenanceWorkOrder.create({
        data: {
          id: uuidv7(),
          plantId,
          machineId: machine.id,
          number,
          issue: input.issue,
          reportedBy: session.userId,
        },
      });
      await tx.machine.update({
        where: { id: machine.id },
        data: { status: "down" },
      });
      await tx.machineDowntime.create({
        data: { id: uuidv7(), machineId: machine.id, reason: input.issue },
      });
      await audit(tx, {
        userId: session.userId,
        action: "maintenance.open",
        resource: "machine",
        resourceId: machine.id,
        reason: input.issue,
      });
      return { id: ticket.id, number };
    },
  });
}

export async function releaseMaintenance(
  session: SessionUser,
  ticketId: string,
  key: string | null,
) {
  allow(session, "machine.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "maintenance.release",
    key,
    run: async (tx) => {
      const ticket = await tx.maintenanceWorkOrder.findFirst({
        where: { id: ticketId, plantId },
      });
      if (!ticket || ticket.status !== "open")
        throw new AppError(409, "INVALID_STATE", "This ticket is not open.");
      await tx.maintenanceWorkOrder.update({
        where: { id: ticket.id },
        data: { status: "closed", closedAt: new Date() },
      });
      await tx.machine.update({
        where: { id: ticket.machineId },
        data: { status: "idle" },
      });
      await tx.machineDowntime.updateMany({
        where: { machineId: ticket.machineId, endedAt: null },
        data: { endedAt: new Date() },
      });
      await audit(tx, {
        userId: session.userId,
        action: "maintenance.release",
        resource: "machine",
        resourceId: ticket.machineId,
      });
      return { id: ticket.id, status: "closed" };
    },
  });
}

export async function createEmployee(
  session: SessionUser,
  input: {
    name: string;
    code?: string;
    phone?: string;
    designation?: string;
    skill?: string;
    additionalSkills?: string[];
    skillLevel?: string;
    departmentId?: string;
    shiftId?: string;
    supervisorId?: string;
    assignedMachineId?: string;
    joiningDate?: string;
    employmentType?: string;
    employmentStatus?: string;
    loginEnabled?: boolean;
    email?: string;
    password?: string;
    roleCode?: EmployeeRole;
  },
  key: string | null,
) {
  allow(session, "employee.manage");
  const loginEnabled = input.loginEnabled !== false;
  if (loginEnabled) {
    if (!input.password || input.password.length < 8) {
      throw new AppError(400, "VALIDATION", "Password must be at least 8 characters when login is enabled.");
    }
    if (!input.roleCode) throw new AppError(400, "VALIDATION", "Choose a role when login is enabled.");
    if (input.roleCode === "admin" && !session.permissions.has("plant.manage")) {
      throw new AppError(403, "FORBIDDEN", "Only a plant administrator can assign the admin role.");
    }
  }
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "employee.create",
    key,
    run: async (tx) => {
      const code = input.code?.trim() || (await nextNumber(tx, plantId, "EMP"));
      const duplicateCode = await tx.employee.findFirst({
        where: { plantId, code: { equals: code, mode: "insensitive" } },
      });
      if (duplicateCode) throw new AppError(409, "DUPLICATE", "That employee ID is already used.");

      let userId: string | null = null;
      let loginEmail: string | null = null;
      let roleCode: string | null = null;
      if (loginEnabled) {
        const email = (
          input.email?.trim() || `${code.toLowerCase()}@staff.ssflow.local`
        ).toLowerCase();
        if (input.email?.trim() && !email.includes("@")) {
          throw new AppError(
            400,
            "VALIDATION",
            "Enter a valid login email, or leave it blank to sign in with the employee ID.",
          );
        }
        const duplicateUser = await tx.user.findUnique({ where: { email } });
        if (duplicateUser) throw new AppError(409, "DUPLICATE", "That login email is already used.");
        const role = await tx.role.findUnique({ where: { code: input.roleCode! } });
        if (!role) throw new AppError(400, "VALIDATION", "Choose a role.");
        roleCode = role.code;
        userId = uuidv7();
        loginEmail = email;
        await tx.user.create({
          data: {
            id: userId,
            email,
            name: input.name,
            phone: input.phone?.trim() || null,
            passwordHash: await hashPassword(input.password!),
            plantAccess: { create: { plantId } },
            userRoles: { create: { roleId: role.id } },
          },
        });
      }

      const employmentStatus = input.employmentStatus ?? "active";
      const employee = await tx.employee.create({
        data: {
          id: uuidv7(),
          plantId,
          userId,
          code,
          name: input.name,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          departmentId: input.departmentId || null,
          designation: input.designation,
          skill: input.skill,
          additionalSkills: input.additionalSkills ?? [],
          skillLevel: input.skillLevel || null,
          shiftId: input.shiftId || null,
          supervisorId: input.supervisorId || null,
          assignedMachineId: input.assignedMachineId || null,
          joiningDate: input.joiningDate ? new Date(input.joiningDate) : null,
          employmentType: input.employmentType || null,
          employmentStatus,
          loginEnabled,
          active: employmentStatus === "active",
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "employee.create",
        resource: "employee",
        resourceId: employee.id,
        reason: roleCode ?? "no_login",
      });
      return { id: employee.id, code, email: loginEmail };
    },
  });
}

type EmployeeRole =
  | "admin"
  | "manager"
  | "employee"
  | "customer"
  | "supplier"
  | "sales"
  | "purchase"
  | "supervisor"
  | "operator"
  | "qc";

async function keepLastAdmin(tx: Parameters<Parameters<typeof runCommand>[0]["run"]>[0], userId: string, nextRole?: EmployeeRole) {
  const links = await tx.userRole.findMany({ where: { userId }, include: { role: true } });
  const isAdmin = links.some((link) => link.role.code === "admin");
  if (!isAdmin || nextRole === "admin") return;
  const admins = await tx.user.count({
    where: { disabledAt: null, deletedAt: null, userRoles: { some: { role: { code: "admin" } } } },
  });
  if (admins <= 1) throw new AppError(409, "LAST_ADMIN", "The plant needs at least one plant admin.");
}

export async function updateEmployee(
  session: SessionUser,
  employeeId: string,
  input: { name: string; code: string; designation?: string; skill?: string; shiftId?: string; email?: string; password?: string; roleCode: EmployeeRole },
  key: string | null,
) {
  allowPlantAdmin(session);
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "employee.update",
    key,
    run: async (tx) => {
      const employee = await tx.employee.findFirst({ where: { id: employeeId, plantId }, include: { user: true } });
      if (!employee || !employee.user) throw new AppError(404, "NOT_FOUND", "Employee was not found.");
      const code = input.code.trim();
      const duplicateCode = await tx.employee.findFirst({ where: { plantId, id: { not: employee.id }, code: { equals: code, mode: "insensitive" } } });
      if (duplicateCode) throw new AppError(409, "DUPLICATE", "That employee ID is already used.");
      const email = (input.email?.trim() || employee.user.email).toLowerCase();
      if (input.email?.trim() && !email.includes("@")) throw new AppError(400, "VALIDATION", "Enter a valid login email, or leave it blank.");
      const duplicateUser = await tx.user.findFirst({ where: { email, id: { not: employee.user.id } } });
      if (duplicateUser) throw new AppError(409, "DUPLICATE", "That login email is already used.");
      await keepLastAdmin(tx, employee.user.id, input.roleCode);
      const role = await tx.role.findUnique({ where: { code: input.roleCode } });
      if (!role) throw new AppError(400, "VALIDATION", "Choose a role.");
      await tx.userRole.deleteMany({ where: { userId: employee.user.id } });
      await tx.userRole.create({ data: { userId: employee.user.id, roleId: role.id } });
      await tx.user.update({
        where: { id: employee.user.id },
        data: {
          name: input.name,
          email,
          disabledAt: null,
          ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
        },
      });
      await tx.employee.update({
        where: { id: employee.id },
        data: { code, name: input.name, designation: input.designation || null, skill: input.skill || null, shiftId: input.shiftId || null, active: true },
      });
      await audit(tx, { userId: session.userId, action: "employee.update", resource: "employee", resourceId: employee.id, reason: role.code });
      return { id: employee.id };
    },
  });
}

export async function deleteEmployee(session: SessionUser, employeeId: string, key: string | null) {
  allowPlantAdmin(session);
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "employee.delete",
    key,
    run: async (tx) => {
      const employee = await tx.employee.findFirst({ where: { id: employeeId, plantId }, include: { user: true } });
      if (!employee) throw new AppError(404, "NOT_FOUND", "Employee was not found.");
      if (employee.userId === session.userId) throw new AppError(409, "INVALID_STATE", "You cannot delete your own login.");
      if (employee.user) await keepLastAdmin(tx, employee.user.id);
      await tx.jobCard.updateMany({ where: { assigneeId: employee.id }, data: { assigneeId: null } });
      await tx.jobCard.updateMany({ where: { supervisorId: employee.id }, data: { supervisorId: null } });
      await tx.jobSession.deleteMany({ where: { employeeId: employee.id } });
      await tx.employee.updateMany({ where: { supervisorId: employee.id }, data: { supervisorId: null } });
      const now = new Date();
      const userId = employee.userId;
      await tx.employee.update({
        where: { id: employee.id },
        data: { deletedAt: now, active: false, employmentStatus: "inactive", loginEnabled: false },
      });
      if (userId) {
        await tx.session.deleteMany({ where: { userId } });
        await tx.user.update({ where: { id: userId }, data: { deletedAt: now, disabledAt: now } });
      }
      await audit(tx, { userId: session.userId, action: "employee.delete", resource: "employee", resourceId: employee.id });
      return { id: employee.id, mode: "soft_deleted" };
    },
  });
}

export async function createUser(
  session: SessionUser,
  input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    roleCode: string;
    customerId?: string;
    supplierId?: string;
  },
  key: string | null,
) {
  allow(session, "user.manage");
  if (input.roleCode === "admin" && !session.permissions.has("plant.manage")) {
    throw new AppError(403, "FORBIDDEN", "Only a plant administrator can assign the admin role.");
  }
  const plantId = primaryPlant(session);
  const email = input.email.trim().toLowerCase();
  return runCommand({
    userId: session.userId,
    route: "user.create",
    key,
    run: async (tx) => {
      const duplicate = await tx.user.findFirst({ where: { email, deletedAt: null } });
      if (duplicate) throw new AppError(409, "DUPLICATE", "That email is already registered.");
      const role = await tx.role.findUnique({ where: { code: input.roleCode } });
      if (!role) throw new AppError(400, "VALIDATION", "Choose a valid role.");

      let customerId: string | null = null;
      let supplierId: string | null = null;
      if (input.roleCode === "customer" && input.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: input.customerId, plantId },
        });
        if (!customer) throw new AppError(400, "VALIDATION", "Customer not found for this plant.");
        const linked = await tx.user.findFirst({ where: { customerId: customer.id } });
        if (linked) throw new AppError(409, "DUPLICATE", "That customer already has a login.");
        customerId = customer.id;
      }
      if (input.roleCode === "supplier" && input.supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: input.supplierId, plantId },
        });
        if (!supplier) throw new AppError(400, "VALIDATION", "Supplier not found for this plant.");
        const linked = await tx.user.findFirst({ where: { supplierId: supplier.id } });
        if (linked) throw new AppError(409, "DUPLICATE", "That supplier already has a login.");
        supplierId = supplier.id;
      }

      const user = await tx.user.create({
        data: {
          id: uuidv7(),
          email,
          name: input.name.trim(),
          phone: input.phone?.trim() || null,
          passwordHash: await hashPassword(input.password),
          customerId,
          supplierId,
          plantAccess: { create: { plantId } },
          userRoles: { create: { roleId: role.id } },
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "user.create",
        resource: "user",
        resourceId: user.id,
        payload: { roleCode: role.code, email },
      });
      return { id: user.id, email: user.email };
    },
  });
}

async function softDeleteUserAccount(tx: Parameters<Parameters<typeof runCommand>[0]["run"]>[0], userId: string) {
  const now = new Date();
  await tx.session.deleteMany({ where: { userId } });
  await tx.user.update({ where: { id: userId }, data: { deletedAt: now, disabledAt: now } });
}

export async function updateUser(
  session: SessionUser,
  userId: string,
  input: { name: string; phone?: string; roleCode: string; password?: string },
  key: string | null,
) {
  allow(session, "user.manage");
  if (input.roleCode === "admin" && !session.permissions.has("plant.manage")) {
    throw new AppError(403, "FORBIDDEN", "Only a plant administrator can assign the admin role.");
  }
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "user.update",
    key,
    run: async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          deletedAt: null,
          OR: [
            { plantAccess: { some: { plantId } } },
            { customer: { plantId } },
            { supplier: { plantId } },
          ],
        },
        include: { userRoles: { include: { role: true } } },
      });
      if (!user) throw new AppError(404, "NOT_FOUND", "User was not found.");
      const role = await tx.role.findUnique({ where: { code: input.roleCode } });
      if (!role) throw new AppError(400, "VALIDATION", "Choose a valid role.");
      const currentAdmin = user.userRoles.some((link) => link.role.code === "admin");
      if (currentAdmin && role.code !== "admin") await keepLastAdmin(tx, userId);
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.create({ data: { userId, roleId: role.id } });
      await tx.user.update({
        where: { id: userId },
        data: {
          name: input.name.trim(),
          phone: input.phone?.trim() || null,
          ...(input.password?.trim()
            ? { passwordHash: await hashPassword(input.password.trim()) }
            : {}),
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "user.update",
        resource: "user",
        resourceId: userId,
        payload: { roleCode: role.code },
      });
      return { id: userId };
    },
  });
}

export async function deleteUser(session: SessionUser, userId: string, key: string | null) {
  allow(session, "user.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "user.delete",
    key,
    run: async (tx) => {
      if (userId === session.userId) throw new AppError(409, "INVALID_STATE", "You cannot remove your own account.");
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          deletedAt: null,
          OR: [
            { plantAccess: { some: { plantId } } },
            { customer: { plantId } },
            { supplier: { plantId } },
          ],
        },
        include: { userRoles: { include: { role: true } }, employee: true },
      });
      if (!user) throw new AppError(404, "NOT_FOUND", "User was not found.");
      if (user.userRoles.some((link) => link.role.code === "admin")) await keepLastAdmin(tx, userId);
      if (user.employee) {
        await tx.employee.update({
          where: { id: user.employee.id },
          data: { active: false, employmentStatus: "inactive", loginEnabled: false, deletedAt: new Date() },
        });
      }
      await softDeleteUserAccount(tx, userId);
      await audit(tx, { userId: session.userId, action: "user.delete", resource: "user", resourceId: userId });
      return { id: userId, mode: "soft_deleted" };
    },
  });
}
