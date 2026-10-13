import { cookies } from "next/headers";
import { prisma } from "@/db";
import { hashSecret } from "../ids";

const COOKIE = "ss_session";
const IDLE_MS = 1000 * 60 * 60 * 2;

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
          plantAccess: true,
          userRoles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
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
  const permissions = new Set<string>();
  for (const link of session.user.userRoles) {
    for (const item of link.role.permissions) permissions.add(item.permission.code);
  }
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    employeeId: session.user.employee?.id ?? null,
    plantIds: session.user.plantAccess.map((row) => row.plantId),
    permissions,
    roles: new Set(session.user.userRoles.map((link) => link.role.code)),
  };
}

export function cookieName() {
  return COOKIE;
}
