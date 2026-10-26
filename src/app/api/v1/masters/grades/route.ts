import { action } from "@/lib/action";
import { requirePermission } from "@/lib/access";
import { jsonData, jsonError } from "@/lib/api";
import { gradeMasterCreateSchema } from "@/lib/schemas";
import { createOrReuseGrade, listAllGrades } from "@/modules/masters/grades-finishes";

export async function GET(request: Request) {
  try {
    const session = await requirePermission("plant.manage");
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const activeOnly = searchParams.get("active") === "true";

    const grades = await listAllGrades({
      plantIds: session.plantIds,
      q,
      activeOnly,
    });
    return jsonData(grades);
  } catch (error) {
    return jsonError(error);
  }
}

export const POST = action("plant.manage", gradeMasterCreateSchema, (session, body) =>
  createOrReuseGrade(session, body),
);
