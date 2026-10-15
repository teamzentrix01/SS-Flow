import type { Prisma } from "@prisma/client";
import { toMilli } from "@/lib/domain/qty";
import { AppError } from "@/lib/errors";
import { notifyUsers, postMovement } from "@/lib/inventory/post";
import { syncSalesLineWhenProductionCompletes } from "@/modules/sales/production-sync";

type Tx = Prisma.TransactionClient;

/** Feed approved output into the next routed job card (forming, polishing, …). */
export async function releaseOutputToSuccessor(
  tx: Tx,
  input: {
    plantId: string;
    job: {
      id: string;
      productionOrderId: string;
    };
    outputBatchId: string;
    outputQty: string;
    locationId: string;
    performedBy: string;
  },
) {
  const held = input.outputQty;
  if (toMilli(held) <= 0n) return { nextJobId: null as string | null };

  const successors = await tx.jobDependency.findMany({
    where: { predecessorId: input.job.id },
    include: { successor: true },
  });
  if (successors.length > 1) {
    throw new AppError(409, "ROUTING_BRANCH_UNSUPPORTED", "This step has multiple successors.");
  }
  const next = successors[0]?.successor;
  if (!next) {
    const openJobs = await tx.jobCard.count({
      where: {
        productionOrderId: input.job.productionOrderId,
        id: { not: input.job.id },
        status: { notIn: ["closed", "cancelled"] },
      },
    });
    if (openJobs === 0) {
      await syncSalesLineWhenProductionCompletes(
        tx,
        input.job.productionOrderId,
        held,
        input.performedBy,
      );
    }
    return { nextJobId: null };
  }

  await postMovement(tx, {
    plantId: input.plantId,
    batchId: input.outputBatchId,
    locationId: input.locationId,
    type: "qc_release",
    qty: held,
    referenceType: "job",
    referenceId: next.id,
    performedBy: input.performedBy,
  });
  await postMovement(tx, {
    plantId: input.plantId,
    batchId: input.outputBatchId,
    locationId: input.locationId,
    type: "reserve",
    qty: held,
    referenceType: "job",
    referenceId: next.id,
    performedBy: input.performedBy,
  });

  const nextStatus = next.assigneeId ? "ready" : "assigned";
  await tx.jobCard.update({
    where: { id: next.id },
    data: {
      batchId: input.outputBatchId,
      locationId: input.locationId,
      allocatedQty: held,
      status: nextStatus,
    },
  });
  await tx.materialBatch.update({
    where: { id: input.outputBatchId },
    data: { qualityStatus: "pass" },
  });

  if (next.assigneeId) {
    const assignee = await tx.employee.findUnique({ where: { id: next.assigneeId } });
    if (assignee?.userId) {
      await notifyUsers(tx, {
        userIds: [assignee.userId],
        type: "job.ready",
        title: "Next operation ready",
        body: `${next.number} · ${next.name} is ready to start.`,
        href: `/shop/jobs/${next.id}`,
      });
    }
  }

  return { nextJobId: next.id };
}
