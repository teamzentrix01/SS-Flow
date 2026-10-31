import { action } from "@/lib/action";
import { requirePermission } from "@/lib/access";
import { jsonData, jsonError } from "@/lib/api";
import { specOptionCreateSchema } from "@/lib/schemas";
import {
  listSpecOptions,
  createOrReuseSpecOption,
} from "@/modules/masters/spec-options";
import {
  createOrReuseGrade,
  createOrReuseFinish,
  listAllGrades,
  listAllFinishes,
  listCompatibleGradesForProduct,
  listCompatibleFinishesForProduct,
} from "@/modules/masters/grades-finishes";

export async function GET(request: Request) {
  try {
    const session = await requirePermission("plant.manage");
    const { searchParams } = new URL(request.url);
    const fieldName = searchParams.get("fieldName") ?? "";
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const productId = searchParams.get("productId") ?? undefined;
    const q = searchParams.get("q") ?? undefined;
    const activeOnly = searchParams.get("active") !== "false";

    if (!fieldName) {
      return jsonData({ options: [] });
    }

    if (fieldName === "grade") {
      let grades;
      if (productId) {
        grades = await listCompatibleGradesForProduct(productId, session.plantIds);
      } else {
        grades = await listAllGrades({ plantIds: session.plantIds, q, activeOnly });
      }
      return jsonData({
        options: grades.map((g) => ({
          id: g.id,
          value: g.name,
          label: g.name,
        })),
      });
    }

    if (fieldName === "finish") {
      let finishes;
      if (productId) {
        finishes = await listCompatibleFinishesForProduct(productId, session.plantIds);
      } else {
        finishes = await listAllFinishes({ plantIds: session.plantIds, q, activeOnly });
      }
      return jsonData({
        options: finishes.map((f) => ({
          id: f.id,
          value: f.name,
          label: f.name,
        })),
      });
    }

    const items = await listSpecOptions({
      plantIds: session.plantIds,
      fieldName,
      categoryId,
      productId,
      activeOnly,
      q,
    });

    return jsonData({
      options: items.map((item) => ({
        id: item.id,
        value: item.value,
        label: item.unit ? `${item.value} ${item.unit}` : item.value,
        unit: item.unit,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export const POST = action("plant.manage", specOptionCreateSchema, async (session, body) => {
  if (body.fieldName === "grade") {
    const res = await createOrReuseGrade(session, {
      name: body.value,
      description: body.description,
      productId: body.productId,
      plantId: body.plantId,
    });
    return {
      option: {
        id: res.grade.id,
        value: res.grade.name,
        label: res.grade.name,
      },
      reused: res.reused,
    };
  }

  if (body.fieldName === "finish") {
    const res = await createOrReuseFinish(session, {
      name: body.value,
      description: body.description,
      productId: body.productId,
      plantId: body.plantId,
    });
    return {
      option: {
        id: res.finish.id,
        value: res.finish.name,
        label: res.finish.name,
      },
      reused: res.reused,
    };
  }

  const res = await createOrReuseSpecOption(session, body);
  return {
    option: {
      id: res.option.id,
      value: res.option.value,
      label: res.option.unit ? `${res.option.value} ${res.option.unit}` : res.option.value,
      unit: res.option.unit,
    },
    reused: res.reused,
  };
});

