import type { SessionUser } from "@/lib/auth/session";
import { primaryPlant } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, nextNumber, runCommand } from "@/lib/inventory/post";
import { allow } from "@/modules/shared/allow";

async function mrEvent(
  tx: Parameters<Parameters<typeof runCommand>[0]["run"]>[0],
  requestId: string,
  userId: string,
  from: string | null,
  to: string,
  remarks?: string,
) {
  await tx.materialRequestEvent.create({
    data: { id: uuidv7(), requestId, fromStatus: from, toStatus: to, remarks, userId },
  });
  await tx.materialRequest.update({ where: { id: requestId }, data: { status: to } });
}

export async function createMaterialRequest(
  session: SessionUser,
  input: {
    materialId: string;
    qtyRequired: string;
    reason: string;
    jobId?: string;
    salesOrderId?: string;
    priority?: string;
    requiredBy?: string;
    notes?: string;
  },
  key: string | null,
) {
  allow(session, "material.request");
  const plantId = primaryPlant(session);
  if (!session.employeeId) throw new AppError(403, "FORBIDDEN", "Employee profile required.");
  return runCommand({
    userId: session.userId,
    route: "material_request.create",
    key,
    run: async (tx) => {
      const material = await tx.materialMaster.findFirst({ where: { id: input.materialId, plantId } });
      if (!material) throw new AppError(404, "NOT_FOUND", "Material not found.");
      const number = await nextNumber(tx, plantId, "MR");
      const request = await tx.materialRequest.create({
        data: {
          id: uuidv7(),
          plantId,
          number,
          employeeId: session.employeeId!,
          jobId: input.jobId || null,
          salesOrderId: input.salesOrderId || null,
          materialId: material.id,
          qtyRequired: input.qtyRequired,
          reason: input.reason,
          priority: input.priority ?? "normal",
          requiredBy: input.requiredBy ? new Date(input.requiredBy) : null,
          notes: input.notes,
          status: "submitted",
        },
      });
      await mrEvent(tx, request.id, session.userId, null, "submitted");
      await audit(tx, { userId: session.userId, action: "material_request.create", resource: "material_request", resourceId: request.id });
      return { id: request.id, number };
    },
  });
}

export async function decideMaterialRequest(
  session: SessionUser,
  requestId: string,
  input: { decision: "approved" | "rejected" | "fulfilled"; remarks?: string; qtyFulfilled?: string },
  key: string | null,
) {
  allow(session, "material.request.review");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "material_request.decide",
    key,
    run: async (tx) => {
      const request = await tx.materialRequest.findFirst({ where: { id: requestId, plantId } });
      if (!request) throw new AppError(404, "NOT_FOUND", "Request not found.");
      if (input.decision === "rejected") {
        await mrEvent(tx, request.id, session.userId, request.status, "rejected", input.remarks);
      } else if (input.decision === "approved") {
        await mrEvent(tx, request.id, session.userId, request.status, "approved", input.remarks);
      } else {
        await tx.materialRequest.update({
          where: { id: request.id },
          data: { qtyFulfilled: input.qtyFulfilled ?? request.qtyRequired.toString() },
        });
        await mrEvent(tx, request.id, session.userId, request.status, "fulfilled", input.remarks);
        await mrEvent(tx, request.id, session.userId, "fulfilled", "closed", input.remarks);
      }
      await audit(tx, { userId: session.userId, action: "material_request.decide", resource: "material_request", resourceId: request.id });
      return { id: request.id, status: input.decision === "fulfilled" ? "closed" : input.decision };
    },
  });
}
