import type { SessionUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { assertPlant, primaryPlant } from "@/lib/access";
import {
  canStartJob,
  predecessorsClosed,
  quantitiesReconcile,
  thicknessWithinTolerance,
} from "@/lib/domain/jobs";
import { fromMilli, toMilli } from "@/lib/domain/qty";
import { convertQuantity, normalizeUom } from "@/lib/domain/uom";
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
import {
  ensureFirstJobMaterialLinked,
  ensureReservedForIssue,
} from "@/modules/planning/link-job-material";
import { releaseOutputToSuccessor } from "@/modules/production/advance-routing";
import { assertCompatibleBatch, requiredMaterialsForJob } from "@/modules/production/job-material";
import { splitConsumption, validateMaterialAllocationPlan } from "@/modules/production/material-allocation";
import { validateSubstitutionDecision } from "@/modules/production/material-substitution";
import { recordJobStatus } from "@/modules/production/job-events";
import {
  advanceSalesOrderWhenJobsAssigned,
  syncSalesLineWhenProductionCompletes,
} from "@/modules/sales/production-sync";
import { assertCanAssignRoles } from "@/lib/rbac/authz";
import { createCustomerInTx, createSupplierInTx } from "@/lib/masters";

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

export {
  createPurchaseOrder,
  updatePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  sendPurchaseOrder,
  cancelPurchaseOrder,
} from "@/modules/procurement/purchase-orders";
export {
  createGoodsReceipt,
  postGoodsReceipt,
  receiveAndPostGoods as receiveGoods,
} from "@/modules/procurement/goods-receipts";
export {
  createInterFactoryTransfer,
  approveInterFactoryTransfer,
  receiveInterFactoryTransfer,
  cancelInterFactoryTransfer,
} from "@/modules/inventory/inter-factory-transfers";

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
  if (input.fromLocationId === input.toLocationId)
    throw new AppError(400, "VALIDATION", "Choose two different locations.");
  return runCommand({
    userId: session.userId,
    route: "inventory.transfer",
    key,
    run: async (tx) => {
      const batch = await tx.materialBatch.findFirst({
        where: { id: input.batchId },
      });
      if (!batch) throw new AppError(404, "NOT_FOUND", "Batch was not found.");
      assertPlant(session, batch.plantId);
      const plantId = batch.plantId;
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
          uom: source.uom,
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
  return runCommand({
    userId: session.userId,
    route: "inventory.adjust",
    key,
    run: async (tx) => {
      const batch = await tx.materialBatch.findFirst({
        where: { id: input.batchId },
      });
      if (!batch) throw new AppError(404, "NOT_FOUND", "Batch was not found.");
      assertPlant(session, batch.plantId);
      const plantId = batch.plantId;
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
        const held = await tx.stockBalance.findFirst({
          where: { batchId: inspection.batch.id, locationId: inspection.batch.locationId },
          select: { qcHoldQty: true, uom: true },
        });
        const heldQty = held?.qcHoldQty.toString() ?? "0";
        if (toMilli(heldQty) <= 0n) {
          throw new AppError(409, "NO_QC_HOLD", "This batch has no quantity in QC hold at its recorded location.");
        }
        if (input.decision === "pass") {
          await postMovement(tx, {
            plantId,
            batchId: inspection.batch.id,
            locationId: inspection.batch.locationId,
            type: "qc_release",
            qty: heldQty,
            uom: held!.uom,
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
            qty: heldQty,
            uom: held!.uom,
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
              await syncSalesLineWhenProductionCompletes(
                tx,
                inspection.job.productionOrderId,
                held,
                session.userId,
              );
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
      die: true,
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
    viaSalesOrder?: true;
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
      if (job.salesOrderId && !input.viaSalesOrder) {
        throw new AppError(
          409,
          "ASSIGN_FROM_SALES_ORDER",
          "Assign this job from the sales order detail page.",
        );
      }
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
      const linkedJob = await tx.jobCard.findFirst({
        where: { id: job.id },
        include: { productionOrder: true },
      });
      if (linkedJob) {
        await ensureFirstJobMaterialLinked(tx, {
          plantId,
          job: linkedJob,
          performedBy: session.userId,
        });
      }
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
      if (job.salesOrderId) {
        await advanceSalesOrderWhenJobsAssigned(tx, job.salesOrderId, session.userId);
      }
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
      let job = await loadJob(tx, jobId, plantId);
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
      await ensureFirstJobMaterialLinked(tx, {
        plantId,
        job,
        performedBy: session.userId,
      });
      job = await loadJob(tx, jobId, plantId);
      if (!job.machineId || !job.batchId)
        throw new AppError(
          409,
          "NOT_READY",
          "Machine and material batch are required.",
        );
      if (job.machine?.readingRequired && !input.openingReading?.trim())
        throw new AppError(
          400,
          "READING_REQUIRED",
          "Opening counter is required.",
        );
      if (!session.employeeId) {
        throw new AppError(
          403,
          "NO_EMPLOYEE",
          "Your login is not linked to an employee profile.",
        );
      }
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
      let allocations = await tx.productionMaterialIssue.findMany({
        where: { jobId: job.id, quantityPlanned: { gt: 0 } },
        include: {
          batch: { include: { material: true } },
          requestedMaterial: { include: { productCategory: true } },
          substitutionRequest: true,
        },
        orderBy: { issuedAt: "asc" },
      });
      if (!allocations.length && job.batchId && job.approvalStatus !== "rejected" && toMilli(job.allocatedQty.toString()) > 0n) {
        const batch = await tx.materialBatch.findFirst({
          where: { id: job.batchId, plantId }, include: { material: { include: { productCategory: true } } },
        });
        if (!batch) throw new AppError(404, "NOT_FOUND", "The assigned material batch was not found at this plant.");
        allocations = [await tx.productionMaterialIssue.upsert({
          where: { jobId_batchId: { jobId: job.id, batchId: batch.id } },
          create: {
            id: uuidv7(), plantId, productionOrderId: job.productionOrderId,
            jobId: job.id, batchId: batch.id, requestedMaterialId: batch.materialId,
            materialMasterId: batch.materialId, locationId: job.locationId,
            quantityPlanned: job.allocatedQty, quantityIssued: 0,
            uom: job.uom,
          },
          update: { quantityPlanned: job.allocatedQty },
          include: {
            batch: { include: { material: true } },
            requestedMaterial: { include: { productCategory: true } },
            substitutionRequest: true,
          },
        })];
      }
      if (job.approvalStatus !== "rejected") {
        if (!allocations.length) throw new AppError(409, "MATERIAL_REQUIRED", "Reserve compatible material batches before starting this job.");
        const requiredIds = await requiredMaterialsForJob(tx, job);
        for (const allocation of allocations) {
          if (!allocation.batch || !allocation.batchId || !allocation.locationId || !allocation.requestedMaterial || !allocation.requestedMaterialId) throw new AppError(409, "MATERIAL_ALLOCATION_INVALID", "A material allocation is missing its batch, location or requirement.");
          if (!requiredIds.includes(allocation.requestedMaterialId ?? "")) throw new AppError(409, "MATERIAL_REQUIREMENT_MISMATCH", "This allocation is not for a material required by the job.");
          const substitutionApproved = allocation.substitutionRequest?.status === "approved" &&
            allocation.substitutionRequest.jobId === job.id &&
            allocation.substitutionRequest.batchId === allocation.batchId &&
            allocation.substitutionRequest.requestedMaterialId === allocation.requestedMaterialId &&
            allocation.substitutionRequest.actualMaterialId === allocation.batch.materialId;
          if (allocation.batch.materialId !== allocation.requestedMaterialId && !substitutionApproved) {
            throw new AppError(409, "SUBSTITUTION_NOT_APPROVED", "Only a substitution request approved for this exact job and batch can be issued.");
          }
          assertCompatibleBatch({ requested: allocation.requestedMaterial, batch: allocation.batch, stockUom: allocation.uom, substitutionApproved });
          if (allocation.batch.plantId !== plantId || allocation.batch.qualityStatus !== "pass") throw new AppError(409, "BATCH_NOT_ISSUABLE", "Only QC-passed batches from this plant can be issued.");
          await ensureReservedForIssue(tx, {
            plantId, batchId: allocation.batchId!, locationId: allocation.locationId,
            qty: allocation.quantityPlanned.toString(), performedBy: session.userId,
            salesOrderId: job.salesOrderId,
          });
          await postMovement(tx, {
            plantId, batchId: allocation.batchId!, locationId: allocation.locationId,
            type: "issue", qty: allocation.quantityPlanned.toString(), uom: allocation.uom,
            referenceType: "job", referenceId: job.id, performedBy: session.userId,
          });
          await tx.productionMaterialIssue.update({
            where: { id: allocation.id }, data: { quantityIssued: allocation.quantityPlanned },
          });
          await tx.stockReservation.updateMany({
            where: { plantId, batchId: allocation.batchId!, locationId: allocation.locationId, referenceType: "job_plan", referenceId: job.id, status: "active" },
            data: { status: "issued" },
          });
        }
      }
      const openingReading =
        input.openingReading?.trim() ?
          input.openingReading.trim()
        : null;
      if (openingReading !== null && !/^-?\d+(\.\d+)?$/.test(openingReading)) {
        throw new AppError(
          400,
          "VALIDATION",
          "Opening counter must be a number.",
        );
      }
      await tx.jobSession.create({
        data: {
          id: uuidv7(),
          jobId: job.id,
          machineId: job.machineId,
          employeeId: session.employeeId,
          status: "in_progress",
          openingReading,
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

export async function prepareJobMaterial(
  session: SessionUser,
  jobId: string,
  key: string | null,
  input?: {
    allocations?: { requestedMaterialId: string; batchId: string; locationId: string; qty: string; uom: string; substitutionRequestId?: string }[];
  },
) {
  if (
    !session.permissions.has("job.execute") &&
    !session.permissions.has("job.assign")
  ) {
    throw new AppError(403, "FORBIDDEN", "You cannot prepare material for this job.");
  }
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "job.prepare_material",
    key,
    run: async (tx) => {
      const job = await loadJob(tx, jobId, plantId);
      if (input?.allocations?.length) {
        if (!["draft", "assigned", "ready"].includes(job.status)) {
          throw new AppError(409, "INVALID_STATE", "Material allocations can only be prepared before the job starts.");
        }
        const alreadyPlanned = await tx.productionMaterialIssue.findFirst({ where: { jobId: job.id, quantityPlanned: { gt: 0 } } });
        if (alreadyPlanned) throw new AppError(409, "ALLOCATION_EXISTS", "Material is already allocated to this job.");
        const requiredIds = await requiredMaterialsForJob(tx, job);
        if (!requiredIds.length) throw new AppError(409, "MATERIAL_REQUIREMENT_UNKNOWN", "The job has no source batch, BOM material, or sales material requirement.");
        const checked = [] as {
          requestedMaterial: NonNullable<Awaited<ReturnType<typeof tx.materialMaster.findFirst>>>;
          batch: NonNullable<Awaited<ReturnType<typeof tx.materialBatch.findFirst>>>;
          locationId: string; qty: string; uom: string; substitutionRequestId?: string;
          allocatableQty: string; qcPassed: boolean; compatible: boolean;
        }[];
        let allocationUom: string | null = null;
        for (const line of input.allocations) {
          const requestedMaterial = await tx.materialMaster.findFirst({
            where: { id: line.requestedMaterialId, plantId, active: true }, include: { productCategory: true },
          });
          if (!requestedMaterial || !requiredIds.includes(requestedMaterial.id)) throw new AppError(409, "MATERIAL_REQUIREMENT_MISMATCH", "The requested material is not part of this job's requirements.");
          const batch = await tx.materialBatch.findFirst({
            where: { id: line.batchId, plantId }, include: { material: { include: { productCategory: true } } },
          });
          if (!batch || batch.qualityStatus !== "pass") throw new AppError(409, "BATCH_NOT_ISSUABLE", "Only QC-passed batches from this plant can be allocated.");
          const location = await tx.storageLocation.findFirst({ where: { id: line.locationId, warehouse: { plantId } } });
          if (!location) throw new AppError(404, "LOCATION_NOT_FOUND", "The selected batch location is not in this plant.");
          const balance = await tx.stockBalance.findUnique({ where: { batchId_locationId: { batchId: batch.id, locationId: location.id } } });
          if (!balance) throw new AppError(409, "NO_STOCK", `Batch ${batch.batchNo} has no balance at the selected location.`);
          if (normalizeUom(balance.uom) !== normalizeUom(line.uom) || convertQuantity("1", requestedMaterial.uom, balance.uom) === null) {
            throw new AppError(409, "UOM_MISMATCH", `Batch stock must use the requested material UOM (${requestedMaterial.uom}).`);
          }
          const substitution = line.substitutionRequestId ? await tx.materialSubstitutionRequest.findFirst({
            where: {
              id: line.substitutionRequestId, plantId, jobId: job.id,
              requestedMaterialId: requestedMaterial.id, actualMaterialId: batch.materialId,
              batchId: batch.id, status: "approved",
            },
          }) : null;
          if (line.substitutionRequestId && !substitution) throw new AppError(409, "SUBSTITUTION_NOT_APPROVED", "This batch has no approved substitution request for this job.");
          assertCompatibleBatch({ requested: requestedMaterial, batch, stockUom: balance.uom, substitutionApproved: Boolean(substitution) });
          if (allocationUom && normalizeUom(allocationUom) !== normalizeUom(line.uom)) throw new AppError(409, "UOM_MISMATCH", "All material allocations on one job must use the same stock UOM.");
          allocationUom = line.uom;
          const isJobSource = batch.id === job.batchId || batch.id === job.productionOrder.sourceBatchId;
          const allocatableQty = toMilli(balance.availableQty.toString()) + (isJobSource ? toMilli(balance.reservedQty.toString()) : 0n);
          checked.push({ requestedMaterial, batch, locationId: location.id, qty: line.qty, uom: balance.uom, substitutionRequestId: substitution?.id, allocatableQty: fromMilli(allocatableQty), qcPassed: batch.qualityStatus === "pass", compatible: true });
        }
        const requiredQty = toMilli(job.allocatedQty.toString()) > 0n
          ? job.allocatedQty.toString()
          : toMilli(job.productionOrder.inputQty.toString()) > 0n
            ? job.productionOrder.inputQty.toString()
            : job.targetQty.toString();
        const plan = validateMaterialAllocationPlan(requiredQty, checked.map((line) => ({ batchId: line.batch.id, qty: line.qty, allocatableQty: line.allocatableQty, qcPassed: line.qcPassed, compatible: line.compatible })));
        if (plan.error) throw new AppError(409, plan.error, plan.error === "OVER_ALLOCATION" ? `Material allocation exceeds the job requirement of ${requiredQty} ${allocationUom}.` : `Material allocation is invalid (${plan.error}).`);
        const total = toMilli(plan.total);
        const created = [];
        for (const allocation of checked) {
          const balance = await tx.stockBalance.findUniqueOrThrow({
            where: { batchId_locationId: { batchId: allocation.batch.id, locationId: allocation.locationId } },
          });
          const isSourceReserve = allocation.batch.id === job.batchId || allocation.batch.id === job.productionOrder.sourceBatchId;
          const reserved = toMilli(balance.reservedQty.toString());
          const qty = toMilli(allocation.qty);
          if (isSourceReserve && reserved >= qty) {
            // The existing production order already owns this reservation.
          } else {
            const reserveQty = isSourceReserve ? qty - reserved : qty;
            if (reserveQty > 0n) await postMovement(tx, {
              plantId, batchId: allocation.batch.id, locationId: allocation.locationId,
              type: "reserve", qty: fromMilli(reserveQty), uom: allocation.uom,
              referenceType: "job_plan", referenceId: job.id, performedBy: session.userId,
            });
          }
          await tx.stockReservation.create({
            data: {
              id: uuidv7(), plantId, batchId: allocation.batch.id, locationId: allocation.locationId,
              qty: allocation.qty, uom: allocation.uom, referenceType: "job_plan", referenceId: job.id,
              status: "active",
            },
          });
          created.push(await tx.productionMaterialIssue.create({
            data: {
              id: uuidv7(), plantId, productionOrderId: job.productionOrderId, jobId: job.id,
              batchId: allocation.batch.id, requestedMaterialId: allocation.requestedMaterial.id,
              materialMasterId: allocation.batch.materialId,
              locationId: allocation.locationId, quantityPlanned: allocation.qty, quantityIssued: 0,
              quantityConsumed: 0, quantityReturned: 0, uom: allocation.uom,
              substitutionRequestId: allocation.substitutionRequestId,
            },
          }));
        }
        await tx.jobCard.update({
          where: { id: job.id },
          data: { batchId: checked[0].batch.id, allocatedQty: fromMilli(total), uom: allocationUom ?? job.uom },
        });
        await audit(tx, {
          userId: session.userId, action: "job.material.allocate", resource: "job", resourceId: job.id,
          payload: { allocations: created.map((row) => ({ batchId: row.batchId, qty: row.quantityPlanned.toString(), uom: row.uom })) },
        });
        return { id: job.id, allocatedQty: fromMilli(total), allocations: created.length };
      }
      const result = await ensureFirstJobMaterialLinked(tx, {
        plantId,
        job,
        performedBy: session.userId,
      });
      if (!result.linked) {
        throw new AppError(
          409,
          "NO_STOCK",
          "No QC-pass stock is available to reserve. Seed or receive raw material first.",
        );
      }
      const fresh = await loadJob(tx, jobId, plantId);
      if (fresh.batchId && toMilli(fresh.allocatedQty.toString()) > 0n) {
        await ensureReservedForIssue(tx, {
          plantId,
          batchId: fresh.batchId,
          locationId: fresh.locationId,
          qty: fresh.allocatedQty.toString(),
          performedBy: session.userId,
          salesOrderId: fresh.salesOrderId,
        });
      }
      return { id: job.id, ...result };
    },
  });
}

export async function requestMaterialSubstitution(
  session: SessionUser,
  jobId: string,
  input: { requestedMaterialId: string; batchId: string; locationId: string; requestedQty: string; uom: string; reason: string },
  key: string | null,
) {
  if (!session.permissions.has("job.assign") && !session.permissions.has("job.execute")) {
    throw new AppError(403, "FORBIDDEN", "You cannot request a material substitution.");
  }
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId, route: "job.material-substitution.request", key,
    run: async (tx) => {
      const job = await loadJob(tx, jobId, plantId);
      if (!["draft", "assigned", "ready"].includes(job.status)) throw new AppError(409, "INVALID_STATE", "Substitutions must be approved before the job starts.");
      const requiredIds = await requiredMaterialsForJob(tx, job);
      if (!requiredIds.includes(input.requestedMaterialId)) throw new AppError(409, "MATERIAL_REQUIREMENT_MISMATCH", "The requested material is not required by this job.");
      const batch = await tx.materialBatch.findFirst({ where: { id: input.batchId, plantId }, include: { material: true } });
      if (!batch) throw new AppError(404, "NOT_FOUND", "Substitute batch was not found in this plant.");
      if (batch.materialId === input.requestedMaterialId) throw new AppError(400, "VALIDATION", "This batch already matches the requested material; no substitution is needed.");
      if (batch.qualityStatus !== "pass") throw new AppError(409, "BATCH_NOT_ISSUABLE", "Substitute batches must pass QC before approval.");
      const location = await tx.storageLocation.findFirst({ where: { id: input.locationId, warehouse: { plantId } } });
      if (!location) throw new AppError(404, "LOCATION_NOT_FOUND", "The substitute batch location is not in this plant.");
      const balance = await tx.stockBalance.findUnique({ where: { batchId_locationId: { batchId: batch.id, locationId: location.id } } });
      if (!balance || toMilli(balance.availableQty.toString()) < toMilli(input.requestedQty)) throw new AppError(409, "INSUFFICIENT_STOCK", "The substitute batch does not have enough available stock for this request.");
      if (normalizeUom(balance.uom) !== normalizeUom(input.uom)) throw new AppError(409, "UOM_MISMATCH", "Substitution request UOM must match the batch stock UOM.");
      const requested = await tx.materialMaster.findFirst({ where: { id: input.requestedMaterialId, plantId, active: true } });
      if (!requested || convertQuantity("1", requested.uom, balance.uom) === null) throw new AppError(409, "UOM_MISMATCH", "Requested material and substitute stock units are incompatible.");
      const substitution = await tx.materialSubstitutionRequest.create({
        data: {
          id: uuidv7(), plantId, jobId: job.id, requestedMaterialId: requested.id,
          actualMaterialId: batch.materialId, batchId: batch.id,
          locationId: location.id,
          requestedQty: input.requestedQty, uom: balance.uom,
          reason: input.reason.trim(), status: "pending", requestedBy: session.userId,
        },
      });
      await audit(tx, { userId: session.userId, action: "job.material-substitution.request", resource: "job", resourceId: job.id, payload: { substitutionId: substitution.id, batchId: batch.id, requestedMaterialId: requested.id, actualMaterialId: batch.materialId, requestedQty: input.requestedQty, uom: balance.uom, reason: input.reason.trim() } });
      return { id: substitution.id, status: substitution.status };
    },
  });
}

export async function decideMaterialSubstitution(
  session: SessionUser,
  jobId: string,
  substitutionId: string,
  input: { decision: "approve" | "reject"; reason?: string },
  key: string | null,
) {
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId, route: "job.material-substitution.decide", key,
    run: async (tx) => {
      const substitution = await tx.materialSubstitutionRequest.findFirst({ where: { id: substitutionId, jobId, plantId } });
      if (!substitution) throw new AppError(404, "NOT_FOUND", "Substitution request was not found.");
      const decisionError = validateSubstitutionDecision({
        status: substitution.status, requestedBy: substitution.requestedBy,
        actorId: session.userId, canApprove: session.permissions.has("purchase.approve"),
        decision: input.decision, reason: input.reason,
      });
      if (decisionError) throw new AppError(decisionError === "FORBIDDEN" ? 403 : 409, decisionError, decisionError === "SEPARATION_OF_DUTIES" ? "The requester cannot approve their own substitution." : decisionError === "REJECTION_REASON_REQUIRED" ? "Add a reason when rejecting a substitution." : "This substitution decision is not allowed.");
      if (input.decision === "approve") {
        const [job, requested, batch, balance] = await Promise.all([
          tx.jobCard.findFirst({ where: { id: jobId, plantId } }),
          tx.materialMaster.findFirst({ where: { id: substitution.requestedMaterialId, plantId, active: true } }),
          tx.materialBatch.findFirst({ where: { id: substitution.batchId, plantId }, include: { material: true } }),
          tx.stockBalance.findUnique({ where: { batchId_locationId: { batchId: substitution.batchId, locationId: substitution.locationId } } }),
        ]);
        if (!job || !requested || !batch || !balance || batch.materialId !== substitution.actualMaterialId || batch.qualityStatus !== "pass") {
          throw new AppError(409, "SUBSTITUTION_INVALID", "Substitution material, batch, job, or QC status is no longer valid.");
        }
        if (!balance || toMilli(balance.availableQty.toString()) < toMilli(substitution.requestedQty.toString()) || normalizeUom(balance.uom) !== normalizeUom(substitution.uom)) throw new AppError(409, "INSUFFICIENT_STOCK", "The requested substitute quantity is no longer available in the requested UOM.");
        if (convertQuantity("1", requested.uom, balance.uom) === null) throw new AppError(409, "UOM_MISMATCH", "Requested material and substitute UOMs are incompatible.");
      }
      const updated = await tx.materialSubstitutionRequest.update({
        where: { id: substitution.id },
        data: { status: input.decision === "approve" ? "approved" : "rejected", approvedBy: session.userId, decidedAt: new Date(), decisionReason: input.reason?.trim() || null },
      });
      await audit(tx, { userId: session.userId, action: `job.material-substitution.${input.decision}`, resource: "job", resourceId: jobId, payload: { substitutionId, batchId: substitution.batchId, requestedMaterialId: substitution.requestedMaterialId, actualMaterialId: substitution.actualMaterialId, reason: input.reason?.trim() || substitution.reason } });
      return { id: updated.id, status: updated.status };
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
      const issuedAllocations = await tx.productionMaterialIssue.findMany({
        where: { jobId: job.id }, select: { quantityIssued: true },
      });
      const totalIssued = issuedAllocations.reduce((sum, row) => sum + toMilli(row.quantityIssued.toString()), 0n);
      if (toMilli(input.consumedQty) > totalIssued) {
        throw new AppError(409, "CONSUMPTION_EXCEEDS_ISSUE", "Consumed quantity cannot exceed material issued to this job.");
      }
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
      const autoQcPass = Boolean(job.salesOrderId);
      await tx.jobCard.update({
        where: { id: job.id },
        data: {
          status: "submitted",
          qcStatus: autoQcPass ? "pass" : "pending",
          approvalStatus: "pending",
          goodQty: input.goodQty,
          rejectQty: input.rejectQty,
          scrapQty: input.scrapQty,
          actualEnd: new Date(),
        },
      });
      const inProcessInspectionId = uuidv7();
      await tx.qcInspection.create({
        data: {
          id: inProcessInspectionId,
          plantId,
          kind: "in_process",
          jobId: job.id,
          batchId: job.batchId,
          status: autoQcPass ? "pass" : "pending",
          inspectorId: autoQcPass ? session.userId : null,
          decidedAt: autoQcPass ? new Date() : null,
          measurements: { thickness: input.thickness ?? null, outOfTolerance },
        },
      });
      await recordJobStatus(
        tx,
        job.id,
        session.userId,
        job.status,
        "submitted",
        "Operator marked this step complete.",
      );
      const reviewers = await usersWithPermission(tx, plantId, "job.approve");
      const operator = job.assignee?.name ?? "Operator";
      const orderRef = job.salesOrderId ? "sales order line" : "production";
      await notifyUsers(tx, {
        userIds: reviewers,
        type: "job.step_approval",
        title: `Approve ${job.name} step`,
        body: `${operator} finished ${job.name} on ${job.number} (${orderRef}). Approve to unlock the next routing step.`,
        href: `/job-approvals`,
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
        const issuedLines = await tx.productionMaterialIssue.findMany({
          where: { jobId: job.id, quantityIssued: { gt: 0 } }, orderBy: { issuedAt: "asc" },
        });
        if (!issuedLines.length) throw new AppError(409, "ISSUE_HISTORY_MISSING", "Issued source batches are missing from production history.");
        const consumption = splitConsumption(issuedLines.map((issue) => ({
          id: issue.id, batchId: issue.batchId ?? "", issuedQty: issue.quantityIssued.toString(),
        })), submission.consumedQty.toString());
        if (consumption.error) throw new AppError(409, consumption.error, "Consumed quantity cannot exceed material issued to this job.");
        const consumedByBatch: { batchId: string; qty: string; uom: string }[] = [];
        for (const [index, issue] of issuedLines.entries()) {
          if (!issue.batchId || !issue.locationId) throw new AppError(409, "ISSUE_HISTORY_INVALID", "A production issue is missing its source batch or location.");
          const split = consumption.rows[index];
          const consumed = toMilli(split.consumedQty);
          const returned = toMilli(split.returnedQty);
          if (consumed > 0n) {
            const qty = fromMilli(consumed);
            await postMovement(tx, {
              plantId, batchId: issue.batchId, locationId: issue.locationId,
              type: "consume", qty, uom: issue.uom, referenceType: "job",
              referenceId: job.id, performedBy: session.userId,
            });
            consumedByBatch.push({ batchId: issue.batchId, qty, uom: issue.uom });
          }
          if (returned > 0n) {
            await postMovement(tx, {
              plantId, batchId: issue.batchId, locationId: issue.locationId,
              type: "return", qty: fromMilli(returned), uom: issue.uom,
              referenceType: "job", referenceId: job.id, performedBy: session.userId,
            });
          }
          await tx.productionMaterialIssue.update({
            where: { id: issue.id },
            data: { quantityConsumed: fromMilli(consumed), quantityReturned: fromMilli(returned) },
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
        }
        if (toMilli(submission.goodQty.toString()) > 0n) await tx.batchLink.createMany({
          data: consumedByBatch.map((source) => ({
            id: uuidv7(), parentBatchId: source.batchId, childBatchId: output.id,
            qty: source.qty, uom: source.uom, linkType: "output",
          })),
        });
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
      await recordJobStatus(
        tx,
        job.id,
        session.userId,
        "submitted",
        "closed",
        `${job.name} approved and closed.`,
      );

      let nextJobId: string | null = null;
      if (outputBatchId && toMilli(submission.goodQty.toString()) > 0n) {
        const advanced = await releaseOutputToSuccessor(tx, {
          plantId,
          job: { id: job.id, productionOrderId: job.productionOrderId },
          outputBatchId,
          outputQty: submission.goodQty.toString(),
          locationId: job.locationId,
          performedBy: session.userId,
        });
        nextJobId = advanced.nextJobId;
        await tx.qcInspection.updateMany({
          where: { jobId: job.id, kind: "final", status: "pending" },
          data: {
            status: "pass",
            inspectorId: session.userId,
            decidedAt: new Date(),
            remarks: "Auto-closed with supervisor approval.",
          },
        });
      }

      if (job.assignee?.userId) {
        await notifyUsers(tx, {
          userIds: [job.assignee.userId],
          type: "job.approved",
          title: "Step approved",
          body: nextJobId
            ? `${job.number} (${job.name}) is complete. The next operation is ready in Shop.`
            : `${job.number} (${job.name}) was approved.`,
          href: nextJobId ? `/shop/jobs/${nextJobId}` : `/shop/jobs/${job.id}`,
        });
      }
      await audit(tx, {
        userId: session.userId,
        action: "job.approve",
        resource: "job",
        resourceId: job.id,
      });
      return { id: job.id, status: "closed", outputBatchId, nextJobId };
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
          "Only quality-passed stock can be dispatched.",
        );

      let orderId: string;
      let salesOrderItemId = input.salesOrderItemId ?? null;
      let dispatchType: "dispatch" | "dispatch_reserved" = "dispatch";

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
        if (line.productId === batch.materialId) {
          const balance = await tx.stockBalance.findFirst({
            where: { batchId: batch.id, locationId: batch.locationId },
          });
          const finished = toMilli(balance?.finishedQty.toString() ?? "0");
          const reserved = toMilli(balance?.reservedQty.toString() ?? "0");
          const need = toMilli(input.qty);
          if (finished < need && reserved >= need) {
            dispatchType = "dispatch_reserved";
          }
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
        type: dispatchType,
        qty: input.qty,
        referenceType: "shipment",
        referenceId: shipment.id,
        performedBy: session.userId,
      });
      if (dispatchType === "dispatch_reserved" && salesOrderItemId) {
        const reservation = await tx.stockReservation.findFirst({
          where: { salesOrderItemId, batchId: batch.id, status: "active" },
          orderBy: { createdAt: "asc" },
        });
        if (reservation) {
          const remaining = toMilli(reservation.qty.toString()) - toMilli(input.qty);
          await tx.stockReservation.update({
            where: { id: reservation.id },
            data:
              remaining <= 0n
                ? { status: "consumed", qty: "0" }
                : { qty: fromMilli(remaining) },
          });
        }
      }
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
    designationId?: string;
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
    roleIds?: string[];
    plantIds?: string[];
  },
  key: string | null,
) {
  allow(session, "employee.manage");
  const loginEnabled = input.loginEnabled !== false;
  if (loginEnabled) {
    if (!input.password || input.password.length < 8) {
      throw new AppError(400, "VALIDATION", "Password must be at least 8 characters when login is enabled.");
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
      let roleCodes: string[] = [];
      const designationFields = await resolveDesignationFields(
        tx,
        plantId,
        input.designationId,
        input.designation,
      );
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
        const roles = await resolveLoginRoles(tx, session, {
          roleIds: input.roleIds,
          roleCode: input.roleCode,
        });
        roleCodes = roles.map((r) => r.code);
        userId = uuidv7();
        loginEmail = email;
        const accessPlants = input.plantIds?.length ? input.plantIds : [plantId];
        await tx.user.create({
          data: {
            id: userId,
            email,
            name: input.name,
            phone: input.phone?.trim() || null,
            passwordHash: await hashPassword(input.password!),
          },
        });
        await syncUserPlants(tx, session, userId, accessPlants);
        for (const role of roles) {
          await tx.userRole.create({ data: { userId, roleId: role.id } });
        }
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
          designationId: designationFields.designationId,
          designation: designationFields.designation,
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
        reason: roleCodes.length ? roleCodes.join(",") : "no_login",
        payload: designationFields.designationId ? { designationId: designationFields.designationId } : undefined,
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

type CommandTx = Parameters<Parameters<typeof runCommand>[0]["run"]>[0];

async function resolveLoginRoles(
  tx: CommandTx,
  session: SessionUser,
  input: { roleIds?: string[]; roleCode?: EmployeeRole },
) {
  let roles =
    input.roleIds && input.roleIds.length > 0
      ? await tx.role.findMany({
          where: { id: { in: input.roleIds }, isActive: true },
          include: { permissions: { include: { permission: true } } },
        })
      : [];
  if (roles.length === 0 && input.roleCode) {
    const role = await tx.role.findUnique({
      where: { code: input.roleCode },
      include: { permissions: { include: { permission: true } } },
    });
    if (role) roles = [role];
  }
  if (roles.length === 0) throw new AppError(400, "VALIDATION", "Choose at least one system role.");
  if (input.roleIds && roles.length !== input.roleIds.length) {
    throw new AppError(400, "VALIDATION", "One or more roles are invalid.");
  }
  assertCanAssignRoles(
    session,
    roles.map((r) => r.permissions.map((p) => p.permission.code)),
  );
  if (roles.some((r) => r.code === "admin") && !session.permissions.has("plant.manage")) {
    throw new AppError(403, "FORBIDDEN", "Only a plant administrator can assign the admin role.");
  }
  return roles;
}

async function syncUserPlants(tx: CommandTx, session: SessionUser, userId: string, plantIds: string[]) {
  const allowed = plantIds.filter((id) => session.plantIds.includes(id));
  if (allowed.length === 0) {
    throw new AppError(400, "VALIDATION", "Select at least one factory the user may access.");
  }
  await tx.userPlantAccess.deleteMany({ where: { userId } });
  for (const plantId of allowed) {
    await tx.userPlantAccess.create({ data: { userId, plantId } });
  }
}

function slugDesignationCode(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

async function resolveDesignationFields(
  tx: CommandTx,
  plantId: string,
  designationId?: string,
  designationText?: string,
) {
  if (!designationId) {
    return { designationId: null as string | null, designation: designationText?.trim() || null };
  }
  const record = await tx.designation.findFirst({ where: { id: designationId, plantId } });
  if (!record) throw new AppError(400, "VALIDATION", "Designation not found for this plant.");
  return { designationId: record.id, designation: record.name };
}

async function resolveDesignationForUser(
  tx: CommandTx,
  plantId: string,
  designationId?: string,
  newDesignation?: string,
) {
  if (designationId) return resolveDesignationFields(tx, plantId, designationId);
  const name = newDesignation?.trim();
  if (!name) return { designationId: null as string | null, designation: null };
  const code = slugDesignationCode(name);
  if (!code) throw new AppError(400, "VALIDATION", "Enter a valid designation name.");
  const existing = await tx.designation.findFirst({ where: { plantId, code } });
  if (existing) return { designationId: existing.id, designation: existing.name };
  const row = await tx.designation.create({
    data: { id: uuidv7(), plantId, code, name, isActive: true },
  });
  return { designationId: row.id, designation: row.name };
}

async function keepLastAdmin(tx: CommandTx, userId: string, nextRole?: EmployeeRole) {
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
  input: {
    name: string;
    code: string;
    designation?: string;
    designationId?: string;
    skill?: string;
    shiftId?: string;
    departmentId?: string;
    email?: string;
    password?: string;
    roleCode?: EmployeeRole;
    roleIds?: string[];
    permissionCodes?: string[];
    plantIds?: string[];
  },
  key: string | null,
) {
  allow(session, "employee.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "employee.update",
    key,
    run: async (tx) => {
      const employee = await tx.employee.findFirst({
        where: { id: employeeId, plantId },
        include: { user: { include: { userRoles: { include: { role: true } } } } },
      });
      if (!employee) throw new AppError(404, "NOT_FOUND", "Employee was not found.");
      const code = input.code.trim();
      const duplicateCode = await tx.employee.findFirst({
        where: { plantId, id: { not: employee.id }, code: { equals: code, mode: "insensitive" } },
      });
      if (duplicateCode) throw new AppError(409, "DUPLICATE", "That employee ID is already used.");
      const designationFields = await resolveDesignationFields(
        tx,
        plantId,
        input.designationId,
        input.designation,
      );
      let roleSummary = "no_login_change";
      if (employee.user) {
        const email = (input.email?.trim() || employee.user.email).toLowerCase();
        if (input.email?.trim() && !email.includes("@")) {
          throw new AppError(400, "VALIDATION", "Enter a valid login email, or leave it blank.");
        }
        const duplicateUser = await tx.user.findFirst({ where: { email, id: { not: employee.user.id } } });
        if (duplicateUser) throw new AppError(409, "DUPLICATE", "That login email is already used.");
        const roleChangeRequested = Boolean(input.roleIds?.length || input.roleCode);
        if (roleChangeRequested) {
          const roles = await resolveLoginRoles(tx, session, {
            roleIds: input.roleIds,
            roleCode: input.roleCode,
          });
          const nextAdmin = roles.some((r) => r.code === "admin");
          const hadAdmin = employee.user.userRoles.some((link) => link.role.code === "admin");
          if (hadAdmin && !nextAdmin) {
            const admins = await tx.user.count({
              where: { disabledAt: null, deletedAt: null, userRoles: { some: { role: { code: "admin" } } } },
            });
            if (admins <= 1) throw new AppError(409, "LAST_ADMIN", "The plant needs at least one plant admin.");
          }
          await tx.userRole.deleteMany({ where: { userId: employee.user.id } });
          for (const role of roles) {
            await tx.userRole.create({ data: { userId: employee.user.id, roleId: role.id } });
          }
          roleSummary = roles.map((r) => r.code).join(",");
        } else {
          roleSummary = employee.user.userRoles.map((link) => link.role.code).join(",") || "login";
        }
        if (input.plantIds?.length) {
          await syncUserPlants(tx, session, employee.user.id, input.plantIds);
        }
        if (input.permissionCodes) {
          const perms = await tx.permission.findMany({ where: { code: { in: input.permissionCodes } } });
          assertCanAssignRoles(session, [perms.map((row) => row.code)]);
          await tx.userPermission.deleteMany({ where: { userId: employee.user.id } });
          for (const perm of perms) {
            await tx.userPermission.create({ data: { userId: employee.user.id, permissionId: perm.id } });
          }
        }
        await tx.user.update({
          where: { id: employee.user.id },
          data: {
            name: input.name,
            email,
            disabledAt: null,
            ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
          },
        });
      }
      await tx.employee.update({
        where: { id: employee.id },
        data: {
          code,
          name: input.name,
          designationId: designationFields.designationId,
          designation: designationFields.designation,
          skill: input.skill || null,
          shiftId: input.shiftId || null,
          departmentId: input.departmentId || null,
          active: true,
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "employee.update",
        resource: "employee",
        resourceId: employee.id,
        reason: roleSummary,
        payload: designationFields.designationId ? { designationId: designationFields.designationId } : undefined,
      });
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
    staffRoleCode?: string;
    employeeCode?: string;
    designationId?: string;
    newDesignation?: string;
    departmentId?: string;
    shiftId?: string;
    plantIds?: string[];
    customerId?: string;
    supplierId?: string;
    addressLine?: string;
  },
  key: string | null,
) {
  allow(session, "user.manage");
  const plantId = primaryPlant(session);
  const email = input.email.trim().toLowerCase();
  const loginRoleCode = input.roleCode === "employee" ? "employee" : input.roleCode;
  if (loginRoleCode === "admin" && !session.permissions.has("plant.manage")) {
    throw new AppError(403, "FORBIDDEN", "Only a plant administrator can assign the admin role.");
  }
  return runCommand({
    userId: session.userId,
    route: "user.create",
    key,
    run: async (tx) => {
      const duplicate = await tx.user.findFirst({ where: { email, deletedAt: null } });
      if (duplicate) throw new AppError(409, "DUPLICATE", "That email is already registered.");
      const role = await tx.role.findUnique({ where: { code: loginRoleCode } });
      if (!role) throw new AppError(400, "VALIDATION", "Choose a valid role.");

      let customerId: string | null = null;
      let supplierId: string | null = null;
      if (input.roleCode === "customer") {
        if (input.customerId) {
          const customer = await tx.customer.findFirst({
            where: { id: input.customerId, plantId },
          });
          if (!customer) throw new AppError(400, "VALIDATION", "Customer not found for this plant.");
          const linked = await tx.user.findFirst({ where: { customerId: customer.id } });
          if (linked) throw new AppError(409, "DUPLICATE", "That customer already has a login.");
          customerId = customer.id;
        } else {
          const customer = await createCustomerInTx(
            tx,
            plantId,
            { name: input.name, phone: input.phone },
            session.userId,
          );
          customerId = customer.id;
        }
      }
      if (input.roleCode === "supplier") {
        if (input.supplierId) {
          const supplier = await tx.supplier.findFirst({
            where: { id: input.supplierId, plantId },
          });
          if (!supplier) throw new AppError(400, "VALIDATION", "Supplier not found for this plant.");
          const linked = await tx.user.findFirst({ where: { supplierId: supplier.id } });
          if (linked) throw new AppError(409, "DUPLICATE", "That supplier already has a login.");
          supplierId = supplier.id;
        } else {
          const supplier = await createSupplierInTx(
            tx,
            plantId,
            {
              name: input.name,
              contact: input.addressLine,
              phone: input.phone,
              email,
            },
            session.userId,
          );
          supplierId = supplier.id;
        }
      }

      const userId = uuidv7();
      const accessPlants = input.plantIds?.length ? input.plantIds : [plantId];
      await tx.user.create({
        data: {
          id: userId,
          email,
          name: input.name.trim(),
          phone: input.phone?.trim() || null,
          passwordHash: await hashPassword(input.password),
          customerId,
          supplierId,
        },
      });
      await syncUserPlants(tx, session, userId, accessPlants);
      await tx.userRole.create({ data: { userId, roleId: role.id } });

      if (input.roleCode === "employee") {
        const designationFields = await resolveDesignationForUser(
          tx,
          plantId,
          input.designationId,
          input.newDesignation,
        );
        const code = input.employeeCode?.trim() || (await nextNumber(tx, plantId, "EMP"));
        const duplicateCode = await tx.employee.findFirst({
          where: { plantId, code: { equals: code, mode: "insensitive" } },
        });
        if (duplicateCode) throw new AppError(409, "DUPLICATE", "That employee ID is already used.");
        const employee = await tx.employee.create({
          data: {
            id: uuidv7(),
            plantId,
            userId,
            code,
            name: input.name.trim(),
            phone: input.phone?.trim() || null,
            email: email,
            departmentId: input.departmentId || null,
            designationId: designationFields.designationId,
            designation: designationFields.designation,
            shiftId: input.shiftId || null,
            loginEnabled: true,
            employmentStatus: "active",
            active: true,
          },
        });
        await audit(tx, {
          userId: session.userId,
          action: "employee.create",
          resource: "employee",
          resourceId: employee.id,
          reason: role.code,
        });
      }

      await audit(tx, {
        userId: session.userId,
        action: "user.create",
        resource: "user",
        resourceId: userId,
        payload: { roleCode: role.code, accountType: input.roleCode, email },
      });
      return { id: userId, email };
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
  input: {
    name: string;
    phone?: string;
    roleCode: string;
    staffRoleCode?: string;
    employeeCode?: string;
    designationId?: string;
    newDesignation?: string;
    departmentId?: string;
    shiftId?: string;
    plantIds?: string[];
    customerId?: string;
    supplierId?: string;
    addressLine?: string;
    password?: string;
  },
  key: string | null,
) {
  allow(session, "user.manage");
  const plantId = primaryPlant(session);
  const loginRoleCode = input.roleCode === "employee" ? "employee" : input.roleCode;
  if (loginRoleCode === "admin" && !session.permissions.has("plant.manage")) {
    throw new AppError(403, "FORBIDDEN", "Only a plant administrator can assign the admin role.");
  }
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
        include: { userRoles: { include: { role: true } }, employee: true },
      });
      if (!user) throw new AppError(404, "NOT_FOUND", "User was not found.");
      const role = await tx.role.findUnique({ where: { code: loginRoleCode } });
      if (!role) throw new AppError(400, "VALIDATION", "Choose a valid role.");
      const currentAdmin = user.userRoles.some((link) => link.role.code === "admin");
      if (currentAdmin && role.code !== "admin") await keepLastAdmin(tx, userId);
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.create({ data: { userId, roleId: role.id } });

      let customerId: string | null = null;
      let supplierId: string | null = null;
      if (input.roleCode === "customer") {
        if (input.customerId) {
          const customer = await tx.customer.findFirst({ where: { id: input.customerId, plantId } });
          if (!customer) throw new AppError(400, "VALIDATION", "Customer not found for this plant.");
          const linked = await tx.user.findFirst({
            where: { customerId: customer.id, id: { not: userId } },
          });
          if (linked) throw new AppError(409, "DUPLICATE", "That customer already has a login.");
          customerId = customer.id;
        } else if (user.customerId) {
          customerId = user.customerId;
        } else {
          const customer = await createCustomerInTx(
            tx,
            plantId,
            { name: input.name, phone: input.phone },
            session.userId,
          );
          customerId = customer.id;
        }
      }
      if (input.roleCode === "supplier") {
        if (input.supplierId) {
          const supplier = await tx.supplier.findFirst({ where: { id: input.supplierId, plantId } });
          if (!supplier) throw new AppError(400, "VALIDATION", "Supplier not found for this plant.");
          const linked = await tx.user.findFirst({
            where: { supplierId: supplier.id, id: { not: userId } },
          });
          if (linked) throw new AppError(409, "DUPLICATE", "That supplier already has a login.");
          supplierId = supplier.id;
        } else if (user.supplierId) {
          supplierId = user.supplierId;
        } else {
          const supplier = await createSupplierInTx(
            tx,
            plantId,
            {
              name: input.name,
              contact: input.addressLine,
              phone: input.phone,
              email: user.email,
            },
            session.userId,
          );
          supplierId = supplier.id;
        }
        if (supplierId && input.addressLine?.trim()) {
          await tx.supplier.update({
            where: { id: supplierId },
            data: { contact: input.addressLine.trim() },
          });
        }
      }

      if (input.plantIds?.length) await syncUserPlants(tx, session, userId, input.plantIds);

      await tx.user.update({
        where: { id: userId },
        data: {
          name: input.name.trim(),
          phone: input.phone?.trim() || null,
          customerId: input.roleCode === "customer" ? customerId : null,
          supplierId: input.roleCode === "supplier" ? supplierId : null,
          ...(input.password?.trim()
            ? { passwordHash: await hashPassword(input.password.trim()) }
            : {}),
        },
      });

      if (input.roleCode === "employee") {
        const designationFields = await resolveDesignationForUser(
          tx,
          plantId,
          input.designationId,
          input.newDesignation,
        );
        if (user.employee) {
          const code = input.employeeCode?.trim() || user.employee.code;
          await tx.employee.update({
            where: { id: user.employee.id },
            data: {
              code,
              name: input.name.trim(),
              phone: input.phone?.trim() || null,
              departmentId: input.departmentId || null,
              designationId: designationFields.designationId,
              designation: designationFields.designation,
              shiftId: input.shiftId || null,
              loginEnabled: true,
              active: true,
              employmentStatus: "active",
            },
          });
        } else {
          const code = input.employeeCode?.trim() || (await nextNumber(tx, plantId, "EMP"));
          await tx.employee.create({
            data: {
              id: uuidv7(),
              plantId,
              userId,
              code,
              name: input.name.trim(),
              phone: input.phone?.trim() || null,
              email: user.email,
              departmentId: input.departmentId || null,
              designationId: designationFields.designationId,
              designation: designationFields.designation,
              shiftId: input.shiftId || null,
              loginEnabled: true,
              employmentStatus: "active",
              active: true,
            },
          });
        }
      }

      await audit(tx, {
        userId: session.userId,
        action: "user.update",
        resource: "user",
        resourceId: userId,
        payload: { roleCode: role.code, accountType: input.roleCode },
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
