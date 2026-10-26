import { prisma } from "@/db";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";
import { plantIdsForSession, primaryPlant } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit } from "@/lib/inventory/post";
import { allow } from "@/modules/shared/allow";

export function normalizeMasterName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export type GradeMasterItem = {
  id: string;
  name: string;
  normalizedName: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  compatibleProducts: { id: string; name: string; sku: string }[];
};

export type FinishMasterItem = {
  id: string;
  name: string;
  normalizedName: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  compatibleProducts: { id: string; name: string; sku: string }[];
};

/**
 * List all active grades compatible with a specific parent product.
 */
export async function listCompatibleGradesForProduct(productId: string, plantIds?: string[]) {
  const compatibilities = await prisma.productGradeCompatibility.findMany({
    where: {
      productId,
      isActive: true,
      ...(plantIds?.length ? { plantId: { in: plantIds } } : {}),
      grade: { isActive: true },
    },
    include: {
      grade: true,
    },
    orderBy: {
      grade: { name: "asc" },
    },
  });

  return compatibilities.map((c) => ({
    id: c.grade.id,
    name: c.grade.name,
    normalizedName: c.grade.normalizedName,
    description: c.grade.description,
    isActive: c.grade.isActive,
  }));
}

/**
 * List all active finishes compatible with a specific parent product.
 */
export async function listCompatibleFinishesForProduct(productId: string, plantIds?: string[]) {
  const compatibilities = await prisma.productFinishCompatibility.findMany({
    where: {
      productId,
      isActive: true,
      ...(plantIds?.length ? { plantId: { in: plantIds } } : {}),
      finish: { isActive: true },
    },
    include: {
      finish: true,
    },
    orderBy: {
      finish: { name: "asc" },
    },
  });

  return compatibilities.map((c) => ({
    id: c.finish.id,
    name: c.finish.name,
    normalizedName: c.finish.normalizedName,
    description: c.finish.description,
    isActive: c.finish.isActive,
  }));
}

/**
 * List all grades for management interface.
 */
export async function listAllGrades(options?: {
  plantIds?: string[];
  q?: string;
  activeOnly?: boolean;
}): Promise<GradeMasterItem[]> {
  const { plantIds, q, activeOnly = false } = options ?? {};
  const query = q?.trim().toLowerCase();

  const grades = await prisma.gradeMaster.findMany({
    where: {
      ...(plantIds?.length ? { plantId: { in: plantIds } } : {}),
      ...(activeOnly ? { isActive: true } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { normalizedName: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      compatibilities: {
        where: { isActive: true },
        include: {
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      },
    },
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
  });

  return grades.map((g) => ({
    id: g.id,
    name: g.name,
    normalizedName: g.normalizedName,
    description: g.description,
    isActive: g.isActive,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
    compatibleProducts: g.compatibilities.map((c) => c.product),
  }));
}

/**
 * List all finishes for management interface.
 */
export async function listAllFinishes(options?: {
  plantIds?: string[];
  q?: string;
  activeOnly?: boolean;
}): Promise<FinishMasterItem[]> {
  const { plantIds, q, activeOnly = false } = options ?? {};
  const query = q?.trim().toLowerCase();

  const finishes = await prisma.finishMaster.findMany({
    where: {
      ...(plantIds?.length ? { plantId: { in: plantIds } } : {}),
      ...(activeOnly ? { isActive: true } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { normalizedName: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      compatibilities: {
        where: { isActive: true },
        include: {
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      },
    },
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
  });

  return finishes.map((f) => ({
    id: f.id,
    name: f.name,
    normalizedName: f.normalizedName,
    description: f.description,
    isActive: f.isActive,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    compatibleProducts: f.compatibilities.map((c) => c.product),
  }));
}

/**
 * Create or reuse a Grade Master record and associate compatibility with the product.
 */
export async function createOrReuseGrade(
  session: SessionUser,
  input: {
    plantId?: string;
    productId?: string;
    name: string;
    description?: string;
  },
) {
  allow(session, "plant.manage");
  const rawName = input.name?.trim();
  if (!rawName || rawName.length < 1 || rawName.length > 80) {
    throw new AppError(400, "VALIDATION", "Grade name is required (1-80 characters).");
  }

  const plantId = input.plantId || primaryPlant(session);
  const normalized = normalizeMasterName(rawName);

  return prisma.$transaction(async (tx) => {
    // 1. Check if normalized grade exists in plant
    let grade = await tx.gradeMaster.findUnique({
      where: { plantId_normalizedName: { plantId, normalizedName: normalized } },
    });

    let reused = false;
    if (grade) {
      reused = true;
      if (!grade.isActive) {
        throw new AppError(400, "INACTIVE_GRADE", `Grade "${grade.name}" is currently inactive. Please activate it in Grade Master before using.`);
      }
    } else {
      grade = await tx.gradeMaster.create({
        data: {
          id: uuidv7(),
          plantId,
          name: rawName,
          normalizedName: normalized,
          description: input.description?.trim() || null,
          isActive: true,
          createdById: session.userId,
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "grade.create",
        resource: "grade_master",
        resourceId: grade.id,
        payload: { name: rawName, normalizedName: normalized },
      });
    }

    // 2. Associate compatibility with product if productId provided
    let createdCompatibility = false;
    if (input.productId) {
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!product) throw new AppError(404, "NOT_FOUND", "Parent product not found.");

      const existingCompat = await tx.productGradeCompatibility.findUnique({
        where: { productId_gradeId: { productId: input.productId, gradeId: grade.id } },
      });

      if (!existingCompat) {
        await tx.productGradeCompatibility.create({
          data: {
            id: uuidv7(),
            plantId: product.plantId,
            productId: input.productId,
            gradeId: grade.id,
            isActive: true,
          },
        });
        createdCompatibility = true;
      } else if (!existingCompat.isActive) {
        await tx.productGradeCompatibility.update({
          where: { id: existingCompat.id },
          data: { isActive: true },
        });
        createdCompatibility = true;
      }
    }

    return {
      grade: {
        id: grade.id,
        name: grade.name,
        normalizedName: grade.normalizedName,
        description: grade.description,
        isActive: grade.isActive,
      },
      reused,
      createdCompatibility,
    };
  });
}

/**
 * Create or reuse a Finish Master record and associate compatibility with the product.
 */
export async function createOrReuseFinish(
  session: SessionUser,
  input: {
    plantId?: string;
    productId?: string;
    name: string;
    description?: string;
  },
) {
  allow(session, "plant.manage");
  const rawName = input.name?.trim();
  if (!rawName || rawName.length < 1 || rawName.length > 80) {
    throw new AppError(400, "VALIDATION", "Finish name is required (1-80 characters).");
  }

  const plantId = input.plantId || primaryPlant(session);
  const normalized = normalizeMasterName(rawName);

  return prisma.$transaction(async (tx) => {
    // 1. Check if normalized finish exists in plant
    let finish = await tx.finishMaster.findUnique({
      where: { plantId_normalizedName: { plantId, normalizedName: normalized } },
    });

    let reused = false;
    if (finish) {
      reused = true;
      if (!finish.isActive) {
        throw new AppError(400, "INACTIVE_FINISH", `Finish "${finish.name}" is currently inactive. Please activate it in Finish Master before using.`);
      }
    } else {
      finish = await tx.finishMaster.create({
        data: {
          id: uuidv7(),
          plantId,
          name: rawName,
          normalizedName: normalized,
          description: input.description?.trim() || null,
          isActive: true,
          createdById: session.userId,
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "finish.create",
        resource: "finish_master",
        resourceId: finish.id,
        payload: { name: rawName, normalizedName: normalized },
      });
    }

    // 2. Associate compatibility with product if productId provided
    let createdCompatibility = false;
    if (input.productId) {
      const product = await tx.product.findUnique({ where: { id: input.productId } });
      if (!product) throw new AppError(404, "NOT_FOUND", "Parent product not found.");

      const existingCompat = await tx.productFinishCompatibility.findUnique({
        where: { productId_finishId: { productId: input.productId, finishId: finish.id } },
      });

      if (!existingCompat) {
        await tx.productFinishCompatibility.create({
          data: {
            id: uuidv7(),
            plantId: product.plantId,
            productId: input.productId,
            finishId: finish.id,
            isActive: true,
          },
        });
        createdCompatibility = true;
      } else if (!existingCompat.isActive) {
        await tx.productFinishCompatibility.update({
          where: { id: existingCompat.id },
          data: { isActive: true },
        });
        createdCompatibility = true;
      }
    }

    return {
      finish: {
        id: finish.id,
        name: finish.name,
        normalizedName: finish.normalizedName,
        description: finish.description,
        isActive: finish.isActive,
      },
      reused,
      createdCompatibility,
    };
  });
}

/**
 * Update an existing Grade Master record.
 */
export async function updateGrade(
  session: SessionUser,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
  },
) {
  allow(session, "plant.manage");
  const plantIds = await plantIdsForSession(session);

  const existing = await prisma.gradeMaster.findFirst({
    where: { id, plantId: { in: plantIds } },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Grade master record not found.");

  const data: Prisma.GradeMasterUpdateInput = {};

  if (input.name !== undefined) {
    const rawName = input.name.trim();
    if (!rawName || rawName.length > 80) throw new AppError(400, "VALIDATION", "Valid grade name is required.");
    const normalized = normalizeMasterName(rawName);
    if (normalized !== existing.normalizedName) {
      const collision = await prisma.gradeMaster.findFirst({
        where: { plantId: existing.plantId, normalizedName: normalized, id: { not: id } },
      });
      if (collision) throw new AppError(409, "DUPLICATE", `A grade with name "${collision.name}" already exists.`);
      data.name = rawName;
      data.normalizedName = normalized;
    } else {
      data.name = rawName;
    }
  }

  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  const updated = await prisma.gradeMaster.update({
    where: { id },
    data,
  });

  await audit(prisma, {
    userId: session.userId,
    action: "grade.update",
    resource: "grade_master",
    resourceId: id,
    payload: { updates: input },
  });

  return updated;
}

/**
 * Update an existing Finish Master record.
 */
export async function updateFinish(
  session: SessionUser,
  id: string,
  input: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
  },
) {
  allow(session, "plant.manage");
  const plantIds = await plantIdsForSession(session);

  const existing = await prisma.finishMaster.findFirst({
    where: { id, plantId: { in: plantIds } },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Finish master record not found.");

  const data: Prisma.FinishMasterUpdateInput = {};

  if (input.name !== undefined) {
    const rawName = input.name.trim();
    if (!rawName || rawName.length > 80) throw new AppError(400, "VALIDATION", "Valid finish name is required.");
    const normalized = normalizeMasterName(rawName);
    if (normalized !== existing.normalizedName) {
      const collision = await prisma.finishMaster.findFirst({
        where: { plantId: existing.plantId, normalizedName: normalized, id: { not: id } },
      });
      if (collision) throw new AppError(409, "DUPLICATE", `A finish with name "${collision.name}" already exists.`);
      data.name = rawName;
      data.normalizedName = normalized;
    } else {
      data.name = rawName;
    }
  }

  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  const updated = await prisma.finishMaster.update({
    where: { id },
    data,
  });

  await audit(prisma, {
    userId: session.userId,
    action: "finish.update",
    resource: "finish_master",
    resourceId: id,
    payload: { updates: input },
  });

  return updated;
}

/**
 * Set product-grade compatibility mapping (associate or remove).
 */
export async function setProductGradeCompatibility(
  session: SessionUser,
  input: {
    productId: string;
    gradeId: string;
    isActive: boolean;
  },
) {
  allow(session, "plant.manage");
  const plantIds = await plantIdsForSession(session);

  const product = await prisma.product.findFirst({
    where: { id: input.productId, plantId: { in: plantIds } },
  });
  if (!product) throw new AppError(404, "NOT_FOUND", "Product not found.");

  const grade = await prisma.gradeMaster.findFirst({
    where: { id: input.gradeId, plantId: { in: plantIds } },
  });
  if (!grade) throw new AppError(404, "NOT_FOUND", "Grade not found.");

  const existing = await prisma.productGradeCompatibility.findUnique({
    where: { productId_gradeId: { productId: input.productId, gradeId: input.gradeId } },
  });

  if (existing) {
    const updated = await prisma.productGradeCompatibility.update({
      where: { id: existing.id },
      data: { isActive: input.isActive },
    });
    return updated;
  }

  const created = await prisma.productGradeCompatibility.create({
    data: {
      id: uuidv7(),
      plantId: product.plantId,
      productId: input.productId,
      gradeId: input.gradeId,
      isActive: input.isActive,
    },
  });
  return created;
}

/**
 * Set product-finish compatibility mapping (associate or remove).
 */
export async function setProductFinishCompatibility(
  session: SessionUser,
  input: {
    productId: string;
    finishId: string;
    isActive: boolean;
  },
) {
  allow(session, "plant.manage");
  const plantIds = await plantIdsForSession(session);

  const product = await prisma.product.findFirst({
    where: { id: input.productId, plantId: { in: plantIds } },
  });
  if (!product) throw new AppError(404, "NOT_FOUND", "Product not found.");

  const finish = await prisma.finishMaster.findFirst({
    where: { id: input.finishId, plantId: { in: plantIds } },
  });
  if (!finish) throw new AppError(404, "NOT_FOUND", "Finish not found.");

  const existing = await prisma.productFinishCompatibility.findUnique({
    where: { productId_finishId: { productId: input.productId, finishId: input.finishId } },
  });

  if (existing) {
    const updated = await prisma.productFinishCompatibility.update({
      where: { id: existing.id },
      data: { isActive: input.isActive },
    });
    return updated;
  }

  const created = await prisma.productFinishCompatibility.create({
    data: {
      id: uuidv7(),
      plantId: product.plantId,
      productId: input.productId,
      finishId: input.finishId,
      isActive: input.isActive,
    },
  });
  return created;
}

/**
 * Server-side validation of grade and finish compatibility for a specification/variant.
 * Throws AppError(400, "VALIDATION", ...) if incompatible.
 * Returns resolved gradeId and finishId.
 */
export async function validateSpecificationCompatibility(
  db: Prisma.TransactionClient | typeof prisma,
  input: {
    productId: string;
    grade?: string | null;
    finish?: string | null;
  },
): Promise<{ gradeId: string | null; finishId: string | null; gradeName: string | null; finishName: string | null }> {
  let gradeId: string | null = null;
  let gradeName: string | null = null;
  let finishId: string | null = null;
  let finishName: string | null = null;

  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true, plantId: true },
  });
  if (!product) throw new AppError(404, "NOT_FOUND", "Product not found.");

  if (input.grade?.trim()) {
    const norm = normalizeMasterName(input.grade);
    // Find active compatibility for this product and grade
    const compat = await db.productGradeCompatibility.findFirst({
      where: {
        productId: input.productId,
        isActive: true,
        grade: {
          normalizedName: norm,
          isActive: true,
        },
      },
      include: { grade: true },
    });

    if (!compat) {
      throw new AppError(
        400,
        "VALIDATION",
        `Grade "${input.grade}" is not configured as a compatible active grade for "${product.name}".`,
      );
    }
    gradeId = compat.grade.id;
    gradeName = compat.grade.name;
  }

  if (input.finish?.trim()) {
    const norm = normalizeMasterName(input.finish);
    // Find active compatibility for this product and finish
    const compat = await db.productFinishCompatibility.findFirst({
      where: {
        productId: input.productId,
        isActive: true,
        finish: {
          normalizedName: norm,
          isActive: true,
        },
      },
      include: { finish: true },
    });

    if (!compat) {
      throw new AppError(
        400,
        "VALIDATION",
        `Finish "${input.finish}" is not configured as a compatible active finish for "${product.name}".`,
      );
    }
    finishId = compat.finish.id;
    finishName = compat.finish.name;
  }

  return { gradeId, finishId, gradeName, finishName };
}
