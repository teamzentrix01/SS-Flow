import type { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/db";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, runCommand } from "@/lib/inventory/post";
import { assertCanAssignRoles, requirePermission } from "@/lib/rbac/authz";

function slugCode(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function listPermissionCatalog(session: SessionUser) {
  requirePermission(session, "role.manage");
  return prisma.permission.findMany({ orderBy: [{ module: "asc" }, { name: "asc" }] });
}

export async function listAssignableRoles(session: SessionUser) {
  if (
    !session.permissions.has("user.manage") &&
    !session.permissions.has("employee.manage") &&
    !session.permissions.has("role.manage")
  ) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to roles.");
  }
  return prisma.role.findMany({
    where: { isActive: true },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, isSystem: true },
  });
}

export async function listRoles(session: SessionUser, options?: { q?: string; page?: number; pageSize?: number }) {
  requirePermission(session, "role.manage");
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, options?.pageSize ?? 20));
  const q = options?.q?.trim();
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { code: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    prisma.role.findMany({
      where,
      include: {
        _count: { select: { users: true, permissions: true } },
      },
      orderBy: [{ isSystem: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.role.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

export async function getRoleDetail(id: string) {
  return prisma.role.findUnique({
    where: { id },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });
}

async function permissionCodesForRoleIds(roleIds: string[]) {
  const links = await prisma.rolePermission.findMany({
    where: { roleId: { in: roleIds } },
    include: { permission: true },
  });
  const byRole = new Map<string, string[]>();
  for (const link of links) {
    const list = byRole.get(link.roleId) ?? [];
    list.push(link.permission.code);
    byRole.set(link.roleId, list);
  }
  return [...byRole.values()];
}

export async function createRole(
  session: SessionUser,
  input: { name: string; code?: string; description?: string; permissionCodes: string[] },
  key: string | null,
) {
  requirePermission(session, "role.manage");
  const code = slugCode(input.code?.trim() || input.name);
  if (!code) throw new AppError(400, "VALIDATION", "Enter a valid role name.");
  const perms = await prisma.permission.findMany({ where: { code: { in: input.permissionCodes } } });
  assertCanAssignRoles(session, [perms.map((p) => p.code)]);
  return runCommand({
    userId: session.userId,
    route: "role.create",
    key,
    run: async (tx) => {
      const dup = await tx.role.findUnique({ where: { code } });
      if (dup) throw new AppError(409, "DUPLICATE", "That role code already exists.");
      const role = await tx.role.create({
        data: {
          id: uuidv7(),
          code,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          isSystem: false,
          isActive: true,
        },
      });
      for (const perm of perms) {
        await tx.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
      }
      await audit(tx, {
        userId: session.userId,
        action: "role.create",
        resource: "role",
        resourceId: role.id,
        payload: { permissionCodes: perms.map((p) => p.code) },
      });
      return { id: role.id };
    },
  });
}

export async function updateRole(
  session: SessionUser,
  id: string,
  input: { name: string; code?: string; description?: string; isActive?: boolean; permissionCodes: string[] },
  key: string | null,
) {
  requirePermission(session, "role.manage");
  const perms = await prisma.permission.findMany({ where: { code: { in: input.permissionCodes } } });
  assertCanAssignRoles(session, [perms.map((p) => p.code)]);
  return runCommand({
    userId: session.userId,
    route: "role.update",
    key,
    run: async (tx) => {
      const existing = await tx.role.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "NOT_FOUND", "Role was not found.");
      if (existing.code === "admin" && input.isActive === false) {
        throw new AppError(409, "LAST_ADMIN", "The admin role cannot be deactivated.");
      }
      if (existing.isSystem && existing.code === "admin" && input.permissionCodes.length === 0) {
        throw new AppError(409, "INVALID_STATE", "Admin role must keep permissions.");
      }
      const code = input.code ? slugCode(input.code) : existing.code;
      const dup = await tx.role.findFirst({ where: { code, id: { not: id } } });
      if (dup) throw new AppError(409, "DUPLICATE", "That role code already exists.");
      if (existing.code === "admin") {
        const adminUsers = await tx.userRole.count({ where: { role: { code: "admin" } } });
        if (adminUsers <= 1 && input.isActive === false) {
          throw new AppError(409, "LAST_ADMIN", "At least one admin user is required.");
        }
      }
      await tx.role.update({
        where: { id },
        data: {
          name: input.name.trim(),
          code: existing.isSystem ? existing.code : code,
          description: input.description?.trim() || null,
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      for (const perm of perms) {
        await tx.rolePermission.create({ data: { roleId: id, permissionId: perm.id } });
      }
      await audit(tx, {
        userId: session.userId,
        action: "role.update",
        resource: "role",
        resourceId: id,
        payload: { permissionCodes: perms.map((p) => p.code) },
      });
      return { id };
    },
  });
}

export async function deleteRole(session: SessionUser, id: string, key: string | null) {
  requirePermission(session, "role.manage");
  return runCommand({
    userId: session.userId,
    route: "role.delete",
    key,
    run: async (tx) => {
      const role = await tx.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
      if (!role) throw new AppError(404, "NOT_FOUND", "Role was not found.");
      if (role.isSystem) throw new AppError(409, "SYSTEM_ROLE", "System roles cannot be deleted.");
      if (role._count.users > 0) throw new AppError(409, "IN_USE", "Remove users from this role before deleting.");
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
      await audit(tx, { userId: session.userId, action: "role.delete", resource: "role", resourceId: id });
      return { id };
    },
  });
}

export async function setUserRoles(
  session: SessionUser,
  userId: string,
  roleIds: string[],
  key: string | null,
) {
  requirePermission(session, "user.manage");
  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds }, isActive: true },
    include: { permissions: { include: { permission: true } } },
  });
  if (roles.length !== roleIds.length) throw new AppError(400, "VALIDATION", "One or more roles are invalid.");
  assertCanAssignRoles(
    session,
    roles.map((r) => r.permissions.map((p) => p.permission.code)),
  );
  if (roles.some((r) => r.code === "admin") && !session.permissions.has("plant.manage")) {
    throw new AppError(403, "FORBIDDEN", "Only a plant administrator can assign the admin role.");
  }
  return runCommand({
    userId: session.userId,
    route: "user.roles.update",
    key,
    run: async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, deletedAt: null, plantAccess: { some: { plantId: { in: session.plantIds } } } },
      });
      if (!user) throw new AppError(404, "NOT_FOUND", "User was not found.");
      const hadAdmin = await tx.userRole.findFirst({ where: { userId, role: { code: "admin" } } });
      const willAdmin = roles.some((r) => r.code === "admin");
      if (hadAdmin && !willAdmin) {
        const admins = await tx.user.count({
          where: { deletedAt: null, userRoles: { some: { role: { code: "admin" } } } },
        });
        if (admins <= 1) throw new AppError(409, "LAST_ADMIN", "The plant needs at least one admin.");
      }
      await tx.userRole.deleteMany({ where: { userId } });
      for (const role of roles) {
        await tx.userRole.create({ data: { userId, roleId: role.id } });
      }
      await audit(tx, {
        userId: session.userId,
        action: "user.roles.update",
        resource: "user",
        resourceId: userId,
        payload: { roleCodes: roles.map((r) => r.code) },
      });
      return { id: userId };
    },
  });
}
