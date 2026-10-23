import type { SessionUser } from "@/lib/auth/session";
import { primaryPlant } from "@/lib/access";
import { isBusinessRootCode } from "@/lib/domain/business-categories";
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
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { CATEGORY_DELETED_STATUS } from "@/lib/soft-delete";
import type { MaterialSpecKey } from "@/lib/domain/material-specifications";

const categoryParentInclude = {
  parent: {
    select: {
      id: true,
      name: true,
      code: true,
      parentId: true,
      parent: { select: { id: true, name: true, code: true } },
    },
  },
  _count: { select: { products: true, children: true, catalogProducts: true } },
} as const;

async function assertParentAllowed(
  tx: Prisma.TransactionClient,
  plantId: string,
  parentId: string | undefined,
  code: string,
) {
  if (isBusinessRootCode(code)) {
    throw new AppError(400, "VALIDATION", "Trading Products and Manufactured Products already exist and cannot be created again.");
  }
  if (!parentId) {
    throw new AppError(
      400,
      "VALIDATION",
      "Choose Trading Products or Manufactured Products (or a subcategory under them) as the parent.",
    );
  }
  const parent = await tx.productCategory.findFirst({
    where: { id: parentId, plantId },
    include: { parent: { select: { id: true, code: true, parentId: true, parent: { select: { code: true } } } } },
  });
  if (!parent) throw new AppError(404, "NOT_FOUND", "Parent category was not found.");
  const underBusinessRoot =
    isBusinessRootCode(parent.code) ||
    (parent.parent && isBusinessRootCode(parent.parent.code)) ||
    (parent.parent?.parent && isBusinessRootCode(parent.parent.parent.code));
  if (!underBusinessRoot) {
    throw new AppError(
      400,
      "VALIDATION",
      "New categories must sit under Trading Products or Manufactured Products.",
    );
  }
  return parent;
}

export async function listProductCategories(plantIds: string[], options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly ?? true;
  return prisma.productCategory.findMany({
    where: {
      plantId: { in: plantIds },
      ...(activeOnly ? { status: "active" } : { status: { not: CATEGORY_DELETED_STATUS } }),
    },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: categoryParentInclude,
  });
}

/** Categories for the whole company (shared across factories). */
export async function listAllProductCategories(options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly ?? true;
  return prisma.productCategory.findMany({
    where: {
      ...(activeOnly ? { status: "active" } : { status: { not: CATEGORY_DELETED_STATUS } }),
    },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: {
      ...categoryParentInclude,
      plant: { select: { id: true, name: true } },
    },
  });
}

export async function getProductCategory(id: string, plantIds: string[]) {
  return prisma.productCategory.findFirst({
    where: { id, plantId: { in: plantIds }, status: { not: CATEGORY_DELETED_STATUS } },
    include: categoryParentInclude,
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
      await assertParentAllowed(tx, plantId, input.parentId, code);
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
      const isRoot = isBusinessRootCode(existing.code);
      const code = isRoot ? existing.code : input.code.trim().toUpperCase();
      if (!isRoot && isBusinessRootCode(code)) {
        throw new AppError(400, "VALIDATION", "That code is reserved for the two business categories.");
      }
      const duplicate = await tx.productCategory.findFirst({
        where: { plantId, id: { not: id }, code: { equals: code, mode: "insensitive" } },
      });
      if (duplicate) throw new AppError(409, "DUPLICATE", "Category code already exists.");
      let parentId = existing.parentId;
      if (isRoot) {
        parentId = null;
      } else {
        if (input.parentId === id) throw new AppError(400, "VALIDATION", "A category cannot be its own parent.");
        await assertParentAllowed(tx, plantId, input.parentId, code);
        parentId = input.parentId || null;
      }
      const row = await tx.productCategory.update({
        where: { id },
        data: {
          code,
          name: isRoot ? existing.name : input.name.trim(),
          parentId,
          categoryType: isRoot ? existing.categoryType : input.categoryType,
          productForm: isRoot ? existing.productForm : input.productForm || null,
          requiredSpecs: input.requiredSpecs ?? existing.requiredSpecs,
          description: isRoot ? existing.description : input.description?.trim() || null,
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
        include: { _count: { select: { products: true, children: true, catalogProducts: true } } },
      });
      if (!existing) throw new AppError(404, "NOT_FOUND", "Category was not found.");
      if (isBusinessRootCode(existing.code)) {
        throw new AppError(400, "VALIDATION", "Trading Products and Manufactured Products cannot be deleted.");
      }
      if (existing._count.products > 0 || existing._count.children > 0 || existing._count.catalogProducts > 0) {
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
