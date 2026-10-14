import type { SessionUser } from "@/lib/auth/session";
import { primaryPlant } from "@/lib/access";
import { prisma } from "@/db";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, runCommand } from "@/lib/inventory/post";
import { assertPlantAccess, requirePermission } from "@/lib/rbac/authz";
import { notDeleted } from "@/lib/soft-delete";

function slugCode(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export async function listActiveDesignations(plantIds: string[]) {
  return prisma.designation.findMany({
    where: { plantId: { in: plantIds }, isActive: true },
    include: { department: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listDesignations(
  session: SessionUser,
  plantIds: string[],
  options?: { q?: string; page?: number; pageSize?: number; activeOnly?: boolean },
) {
  if (!session.permissions.has("designation.manage") && !session.permissions.has("employee.manage")) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to designations.");
  }
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, options?.pageSize ?? 20));
  const q = options?.q?.trim();
  const where = {
    plantId: { in: plantIds },
    ...(options?.activeOnly ? { isActive: true } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { code: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.designation.findMany({
      where,
      include: {
        department: { select: { name: true } },
        _count: { select: { employees: { where: notDeleted } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.designation.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

export async function getDesignation(id: string, plantIds: string[]) {
  return prisma.designation.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: { department: true, _count: { select: { employees: { where: notDeleted } } } },
  });
}

export async function createDesignation(
  session: SessionUser,
  input: { name: string; code?: string; description?: string; departmentId?: string; plantId?: string },
  key: string | null,
) {
  if (!session.permissions.has("designation.manage") && !session.permissions.has("employee.manage")) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to designations.");
  }
  const plantId = input.plantId ?? primaryPlant(session);
  assertPlantAccess(session, plantId);
  const code = slugCode(input.code?.trim() || input.name);
  if (!code) throw new AppError(400, "VALIDATION", "Enter a valid designation name.");
  return runCommand({
    userId: session.userId,
    route: "designation.create",
    key,
    run: async (tx) => {
      const dup = await tx.designation.findFirst({ where: { plantId, code } });
      if (dup) throw new AppError(409, "DUPLICATE", "That designation code already exists.");
      if (input.departmentId) {
        const dept = await tx.department.findFirst({ where: { id: input.departmentId, plantId } });
        if (!dept) throw new AppError(400, "VALIDATION", "Department not found for this plant.");
      }
      const row = await tx.designation.create({
        data: {
          id: uuidv7(),
          plantId,
          code,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          departmentId: input.departmentId || null,
        },
      });
      await audit(tx, { userId: session.userId, action: "designation.create", resource: "designation", resourceId: row.id });
      return { id: row.id };
    },
  });
}

export async function updateDesignation(
  session: SessionUser,
  id: string,
  input: { name: string; code?: string; description?: string; departmentId?: string; isActive?: boolean },
  key: string | null,
) {
  if (!session.permissions.has("designation.manage") && !session.permissions.has("employee.manage")) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to designations.");
  }
  return runCommand({
    userId: session.userId,
    route: "designation.update",
    key,
    run: async (tx) => {
      const existing = await tx.designation.findFirst({ where: { id, plantId: { in: session.plantIds } } });
      if (!existing) throw new AppError(404, "NOT_FOUND", "Designation was not found.");
      assertPlantAccess(session, existing.plantId);
      const code = input.code ? slugCode(input.code) : existing.code;
      const dup = await tx.designation.findFirst({ where: { plantId: existing.plantId, code, id: { not: id } } });
      if (dup) throw new AppError(409, "DUPLICATE", "That designation code already exists.");
      const row = await tx.designation.update({
        where: { id },
        data: {
          name: input.name.trim(),
          code,
          description: input.description?.trim() || null,
          departmentId: input.departmentId || null,
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
      await audit(tx, { userId: session.userId, action: "designation.update", resource: "designation", resourceId: row.id });
      return { id: row.id };
    },
  });
}
