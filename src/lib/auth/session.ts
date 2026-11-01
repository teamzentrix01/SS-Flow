import { cookies } from "next/headers";
import { prisma } from "@/db";
import { permissionsForSession } from "@/lib/rbac/authz";
import { hashSecret } from "../ids";

const COOKIE = "ss_session";
const IDLE_MS = 1000 * 60 * 60 * 2;
const ACTIVE_ENTITY_PLANT_CODE = process.env.ACTIVE_ENTITY_PLANT_CODE?.trim() || "PLANT-01";

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  employeeId: string | null;
  plantIds: string[];
  permissions: Set<string>;
  roles: Set<string>;
};

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSecret(token) },
    include: {
      user: {
        include: {
          employee: true,
          plantAccess: { include: { plant: { select: { code: true } } } },
          userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
          userPermissions: { include: { permission: true } },
        },
      },
    },
  });
  if (!session || session.user.disabledAt || session.user.deletedAt) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() < now || now - session.lastSeenAt.getTime() > IDLE_MS) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastSeenAt.getTime() > 1000 * 60 * 5) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  const roles = new Set(session.user.userRoles.map((link) => link.role.code));
  const fromRoles: string[] = [];
  for (const link of session.user.userRoles) {
    for (const item of link.role.permissions) fromRoles.push(item.permission.code);
  }
  const fromUser = session.user.userPermissions.map((item) => item.permission.code);
  const permissions = permissionsForSession(roles, fromUser.length ? fromUser : fromRoles);
  const activeEntityPlant = session.user.plantAccess.find(
    (row) => row.plant.code === ACTIVE_ENTITY_PLANT_CODE,
  );
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    employeeId: session.user.employee?.id ?? null,
    // One active entity is used for app data. Plant IDs remain in the schema
    // for existing records and future expansion, but other plants are not
    // included in the current user's operational scope.
    plantIds: activeEntityPlant ? [activeEntityPlant.plantId] : [],
    permissions,
    roles,
  };
}

export function cookieName() {
  return COOKIE;
}
