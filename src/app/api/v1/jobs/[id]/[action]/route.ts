import {
  assignJob,
  approveJob,
  pauseJob,
  prepareJobMaterial,
  progressJob,
  requestCorrection,
  startJob,
  submitJob,
} from "@/lib/commands";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { assignSchema, correctionSchema, pauseSchema, progressSchema, startSchema, submitSchema } from "@/lib/schemas";

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
      return jsonData(await prepareJobMaterial(session, id, key));
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
