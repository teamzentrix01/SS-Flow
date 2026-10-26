import { action } from "@/lib/action";
import { requirePermission } from "@/lib/access";
import { jsonData, jsonError } from "@/lib/api";
import { finishMasterCreateSchema } from "@/lib/schemas";
import { createOrReuseFinish, listAllFinishes } from "@/modules/masters/grades-finishes";

export async function GET(request: Request) {
  try {
    const session = await requirePermission("plant.manage");
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const activeOnly = searchParams.get("active") === "true";

    const finishes = await listAllFinishes({
      plantIds: session.plantIds,
      q,
      activeOnly,
    });
    return jsonData(finishes);
  } catch (error) {
    return jsonError(error);
  }
}

export const POST = action("plant.manage", finishMasterCreateSchema, (session, body) =>
  createOrReuseFinish(session, body),
);
