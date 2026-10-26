import { requirePermission } from "@/lib/access";
import { action } from "@/lib/action";
import { jsonData, jsonError } from "@/lib/api";
import { productCompatibilityToggleSchema } from "@/lib/schemas";
import {
  listAllFinishes,
  listAllGrades,
  listCompatibleFinishesForProduct,
  listCompatibleGradesForProduct,
  setProductFinishCompatibility,
  setProductGradeCompatibility,
} from "@/modules/masters/grades-finishes";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("plant.manage");
    const { id } = await context.params;

    const [compatibleGrades, compatibleFinishes, allGrades, allFinishes] = await Promise.all([
      listCompatibleGradesForProduct(id, session.plantIds),
      listCompatibleFinishesForProduct(id, session.plantIds),
      listAllGrades({ plantIds: session.plantIds, activeOnly: true }),
      listAllFinishes({ plantIds: session.plantIds, activeOnly: true }),
    ]);

    return jsonData({
      compatibleGrades,
      compatibleFinishes,
      allGrades,
      allFinishes,
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return action("plant.manage", productCompatibilityToggleSchema, async (session, body) => {
    if (body.type === "grade") {
      return setProductGradeCompatibility(session, {
        productId: id,
        gradeId: body.masterId,
        isActive: body.isActive,
      });
    } else {
      return setProductFinishCompatibility(session, {
        productId: id,
        finishId: body.masterId,
        isActive: body.isActive,
      });
    }
  })(request);
}
