import type { Prisma } from "@prisma/client";
import { checkMaterialCompatibility } from "@/lib/domain/material-compatibility";
import { AppError } from "@/lib/errors";

type Tx = Prisma.TransactionClient;

export async function requiredMaterialsForJob(
  tx: Tx,
  job: { id: string; batchId: string | null; productionOrderId: string; bomHeaderId: string | null; salesOrderItemId: string | null },
) {
  const allocatedRequirements = await tx.productionMaterialIssue.findMany({
    where: { jobId: job.id },
    select: { requestedMaterialId: true },
  });
  const allocatedIds = [...new Set(allocatedRequirements.map((row) => row.requestedMaterialId).filter((id): id is string => Boolean(id)))];
  if (allocatedIds.length) return allocatedIds;
  const order = await tx.productionOrder.findUnique({
    where: { id: job.productionOrderId }, select: { sourceBatchId: true },
  });
  const sourceBatchId = order?.sourceBatchId ?? job.batchId;
  if (sourceBatchId) {
    const batch = await tx.materialBatch.findUnique({ where: { id: sourceBatchId }, select: { materialId: true } });
    if (batch) return [batch.materialId];
  }
  if (job.bomHeaderId) {
    const items = await tx.bomItem.findMany({ where: { bomId: job.bomHeaderId }, select: { materialId: true } });
    if (items.length) return [...new Set(items.map((item) => item.materialId))];
  }
  if (job.salesOrderItemId) {
    const requirements = await tx.materialRequirement.findMany({ where: { salesOrderItemId: job.salesOrderItemId }, select: { materialId: true }, orderBy: { createdAt: "asc" } });
    if (requirements.length) return [...new Set(requirements.map((item) => item.materialId))];
  }
  return [];
}

export function assertCompatibleBatch(input: {
  requested: {
    id: string; grade: string | null; thickness: { toString(): string } | null;
    width: { toString(): string } | null; length: { toString(): string } | null;
    diameter: { toString(): string } | null; shape: string;
    uom: string; productCategory: { requiredSpecs: string[] } | null;
  };
  batch: {
    materialId: string; grade: string | null; thickness: { toString(): string } | null;
    width: { toString(): string } | null; length: { toString(): string } | null;
    diameter: { toString(): string } | null; finish: string | null;
    material: { shape: string; uom: string };
  };
  stockUom: string;
  substitutionApproved?: boolean;
}) {
  const status = checkMaterialCompatibility({
    requestedMaterialId: input.requested.id,
    actualMaterialId: input.batch.materialId,
    requestedSpecs: {
      grade: input.requested.grade,
      thickness: input.requested.thickness?.toString(),
      width: input.requested.width?.toString(),
      length: input.requested.length?.toString(),
      diameter: input.requested.diameter?.toString(),
      productForm: input.requested.shape,
    },
    actualSpecs: {
      grade: input.batch.grade,
      thickness: input.batch.thickness?.toString(),
      width: input.batch.width?.toString(),
      length: input.batch.length?.toString(),
      diameter: input.batch.diameter?.toString(),
      finish: input.batch.finish,
      productForm: input.batch.material.shape,
    },
    requiredSpecs: input.requested.productCategory?.requiredSpecs ?? [],
    requestedUom: input.requested.uom,
    actualUom: input.stockUom,
    substitutionApproved: input.substitutionApproved,
  });
  if (status) throw new AppError(409, status, `Batch is not compatible with the requested material (${status}).`);
}
