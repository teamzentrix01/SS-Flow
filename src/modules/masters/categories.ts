import type { SessionUser } from "@/lib/auth/session";
import { primaryPlant } from "@/lib/access";
import {
  CATEGORY_TYPES,
  PRODUCT_FORMS,
  type CategoryType,
  type ProductForm,
} from "@/lib/domain/master-entities";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, runCommand } from "@/lib/inventory/post";
import { allow } from "@/modules/shared/allow";
import { prisma } from "@/db";
import { CATEGORY_DELETED_STATUS } from "@/lib/soft-delete";
import type { MaterialSpecKey } from "@/lib/domain/material-specifications";

export async function listProductCategories(plantIds: string[], options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly ?? true;
  return prisma.productCategory.findMany({
    where: {
      plantId: { in: plantIds },
      ...(activeOnly ? { status: "active" } : { status: { not: CATEGORY_DELETED_STATUS } }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      parent: { select: { id: true, name: true, code: true } },
      _count: { select: { products: true, children: true } },
    },
  });
}

/** Categories for the whole company (shared across factories). */
export async function listAllProductCategories(options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly ?? true;
  return prisma.productCategory.findMany({
    where: {
      ...(activeOnly ? { status: "active" } : { status: { not: CATEGORY_DELETED_STATUS } }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      parent: { select: { id: true, name: true, code: true } },
      plant: { select: { id: true, name: true } },
      _count: { select: { products: true, children: true } },
    },
  });
}

export async function getProductCategory(id: string, plantIds: string[]) {
  return prisma.productCategory.findFirst({
    where: { id, plantId: { in: plantIds }, status: { not: CATEGORY_DELETED_STATUS } },
    include: {
      parent: { select: { id: true, name: true, code: true } },
      _count: { select: { products: true, children: true } },
    },
  });
}

export async function createProductCategory(
  session: SessionUser,
  input: {
    code: string;
    name: string;
    parentId?: string;
    categoryType: CategoryType;
    productForm?: ProductForm;
    requiredSpecs?: MaterialSpecKey[];
    description?: string;
    status?: "active" | "inactive";
  },
  key: string | null,
) {
  allow(session, "plant.manage");
  const plantId = primaryPlant(session);
  if (!CATEGORY_TYPES.includes(input.categoryType)) {
    throw new AppError(400, "VALIDATION", "Invalid category type.");
  }
  if (input.productForm && !PRODUCT_FORMS.includes(input.productForm)) {
    throw new AppError(400, "VALIDATION", "Invalid product form.");
  }
  return runCommand({
    userId: session.userId,
    route: "category.create",
    key,
    run: async (tx) => {
      const code = input.code.trim().toUpperCase();
      const duplicate = await tx.productCategory.findFirst({
        where: { plantId, code: { equals: code, mode: "insensitive" } },
      });
      if (duplicate) throw new AppError(409, "DUPLICATE", "Category code already exists.");
      if (input.parentId) {
        const parent = await tx.productCategory.findFirst({
          where: { id: input.parentId, plantId },
        });
        if (!parent) throw new AppError(404, "NOT_FOUND", "Parent category was not found.");
      }
      const row = await tx.productCategory.create({
        data: {
          id: uuidv7(),
          plantId,
          code,
          name: input.name.trim(),
          parentId: input.parentId || null,
          categoryType: input.categoryType,
          productForm: input.productForm || null,
          requiredSpecs: input.requiredSpecs ?? [],
          description: input.description?.trim() || null,
          status: input.status ?? "active",
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "category.create",
        resource: "product_category",
        resourceId: row.id,
      });
      return { id: row.id, code: row.code };
    },
  });
}

export async function updateProductCategory(
  session: SessionUser,
  id: string,
  input: {
    code: string;
    name: string;
    parentId?: string;
    categoryType: CategoryType;
    productForm?: ProductForm;
    requiredSpecs?: MaterialSpecKey[];
    description?: string;
    status?: "active" | "inactive";
  },
  key: string | null,
) {
  allow(session, "plant.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "category.update",
    key,
    run: async (tx) => {
      const existing = await tx.productCategory.findFirst({ where: { id, plantId } });
      if (!existing) throw new AppError(404, "NOT_FOUND", "Category was not found.");
      const code = input.code.trim().toUpperCase();
      const duplicate = await tx.productCategory.findFirst({
        where: { plantId, id: { not: id }, code: { equals: code, mode: "insensitive" } },
      });
      if (duplicate) throw new AppError(409, "DUPLICATE", "Category code already exists.");
      if (input.parentId) {
        if (input.parentId === id) throw new AppError(400, "VALIDATION", "A category cannot be its own parent.");
        const parent = await tx.productCategory.findFirst({ where: { id: input.parentId, plantId } });
        if (!parent) throw new AppError(404, "NOT_FOUND", "Parent category was not found.");
      }
      const row = await tx.productCategory.update({
        where: { id },
        data: {
          code,
          name: input.name.trim(),
          parentId: input.parentId || null,
          categoryType: input.categoryType,
          productForm: input.productForm || null,
          requiredSpecs: input.requiredSpecs ?? existing.requiredSpecs,
          description: input.description?.trim() || null,
          status: input.status ?? existing.status,
        },
      });
      await audit(tx, {
        userId: session.userId,
        action: "category.update",
        resource: "product_category",
        resourceId: row.id,
      });
      return { id: row.id };
    },
  });
}

export async function deleteProductCategory(session: SessionUser, id: string, key: string | null) {
  allow(session, "plant.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "category.delete",
    key,
    run: async (tx) => {
      const existing = await tx.productCategory.findFirst({
        where: { id, plantId },
        include: { _count: { select: { products: true, children: true } } },
      });
      if (!existing) throw new AppError(404, "NOT_FOUND", "Category was not found.");
      if (existing._count.products > 0 || existing._count.children > 0) {
        throw new AppError(409, "IN_USE", "Remove child categories and reassign products before deleting.");
      }
      await tx.productCategory.update({ where: { id }, data: { status: CATEGORY_DELETED_STATUS } });
      await audit(tx, {
        userId: session.userId,
        action: "category.delete",
        resource: "product_category",
        resourceId: id,
      });
      return { id };
    },
  });
}
