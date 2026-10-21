import {
  assignJob,
  approveJob,
  decideMaterialSubstitution,
  pauseJob,
  prepareJobMaterial,
  progressJob,
  requestCorrection,
  requestMaterialSubstitution,
  startJob,
  submitJob,
} from "@/lib/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { assignSchema, correctionSchema, jobMaterialAllocationsSchema, pauseSchema, progressSchema, startSchema, submitSchema, substitutionDecisionSchema, substitutionRequestSchema } from "@/lib/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  try {
    assertSameOrigin(request);
    const { id, action } = await context.params;
    const key = idempotencyKey(request);
    if (action === "assign") {
      const session = await requirePermission("job.assign");
      return jsonData(await assignJob(session, id, await readJson(request, assignSchema), key));
    }
    if (action === "start") {
      const session = await requirePermission("job.execute");
      return jsonData(await startJob(session, id, await readJson(request, startSchema), key));
    }
    if (action === "prepare-material") {
      const session = await requirePermission("job.execute");
      return jsonData(await prepareJobMaterial(session, id, key, await readJson(request, jobMaterialAllocationsSchema)));
    }
    if (action === "request-substitution") {
      const session = await requirePermission("job.execute");
      return jsonData(await requestMaterialSubstitution(session, id, await readJson(request, substitutionRequestSchema), key));
    }
    if (action.startsWith("approve-substitution-")) {
      const substitutionId = action.slice("approve-substitution-".length);
      if (!/^[0-9a-f-]{36}$/i.test(substitutionId)) throw new AppError(404, "NOT_FOUND", "Substitution request was not found.");
      const session = await requirePermission("purchase.approve");
      return jsonData(await decideMaterialSubstitution(session, id, substitutionId, await readJson(request, substitutionDecisionSchema), key));
    }
    if (action === "pause") {
      const session = await requirePermission("job.execute");
      return jsonData(await pauseJob(session, id, await readJson(request, pauseSchema), key));
    }
    if (action === "progress") {
      const session = await requirePermission("job.execute");
      return jsonData(await progressJob(session, id, await readJson(request, progressSchema), key));
    }
    if (action === "submit") {
      const session = await requirePermission("job.execute");
      return jsonData(await submitJob(session, id, await readJson(request, submitSchema), key));
    }
    if (action === "approve") {
      const session = await requirePermission("job.approve");
      return jsonData(await approveJob(session, id, key));
    }
    if (action === "request-correction") {
      const session = await requirePermission("job.approve");
      return jsonData(await requestCorrection(session, id, await readJson(request, correctionSchema), key));
    }
    throw new AppError(404, "NOT_FOUND", "Unknown job action.");
  } catch (error) {
    return jsonError(error);
  }
}
