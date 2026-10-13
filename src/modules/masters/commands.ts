import type { SessionUser } from "@/lib/auth/session";
import { primaryPlant } from "@/lib/access";
import { MATERIAL_CATEGORIES, defaultUomForCategory } from "@/lib/domain/material-conventions";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, nextNumber, runCommand } from "@/lib/inventory/post";
import { allow } from "@/modules/shared/allow";

export async function createMaterial(
  session: SessionUser,
  input: {
    code?: string;
    name: string;
    category: string;
    shape: string;
    grade?: string;
    thickness?: string;
    width?: string;
    uom?: string;
    specs?: Record<string, unknown>;
  },
  key: string | null,
) {
  allow(session, "plant.manage");
  const plantId = primaryPlant(session);
  if (!MATERIAL_CATEGORIES.includes(input.category as (typeof MATERIAL_CATEGORIES)[number])) {
    throw new AppError(400, "VALIDATION", "Invalid material category.");
  }
  return runCommand({
    userId: session.userId,
    route: "material.create",
    key,
    run: async (tx) => {
      const code = input.code?.trim() || (await nextNumber(tx, plantId, "MAT"));
      const duplicate = await tx.materialMaster.findFirst({ where: { plantId, code: { equals: code, mode: "insensitive" } } });
      if (duplicate) throw new AppError(409, "DUPLICATE", "Material code already exists.");
      const material = await tx.materialMaster.create({
        data: {
          id: uuidv7(),
          plantId,
          code,
          name: input.name.trim(),
          category: input.category,
          shape: input.shape.trim(),
          grade: input.grade?.trim() || null,
          thickness: input.thickness || null,
          width: input.width || null,
          uom: input.uom?.trim() || defaultUomForCategory(input.category),
          specs: (input.specs ?? {}) as object,
        },
      });
      await audit(tx, { userId: session.userId, action: "material.create", resource: "material", resourceId: material.id });
      return { id: material.id, code: material.code };
    },
  });
}
