import { redirect } from "next/navigation";
import { prisma } from "@/db";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { hasPermission, isAdminSession } from "@/lib/rbac/authz";

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new AppError(401, "UNAUTHENTICATED", "Sign in required.");
  return session;
}

export async function requirePermission(code: string) {
  const session = await requireUser();
  if (!hasPermission(session, code)) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this action.");
  }
  return session;
}

export async function requireAnyPermission(...codes: string[]) {
  const session = await requireUser();
  if (codes.length && !codes.some((code) => hasPermission(session, code))) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this action.");
  }
  return session;
}

export async function requirePage(permission?: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (permission && !hasPermission(session, permission)) redirect("/access-denied");
  return session;
}

export async function requireAnyPage(...permissions: string[]) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (permissions.length && !permissions.some((code) => hasPermission(session, code))) {
    redirect("/access-denied");
  }
  return session;
}

export function assertPlant(session: SessionUser, plantId: string) {
  if (isAdminSession(session)) return;
  if (session.permissions.has("plant.manage")) return;
  if (!session.plantIds.includes(plantId)) {
    throw new AppError(403, "FORBIDDEN", "This plant is outside your access.");
  }
}

/** Plant scope for list/detail queries — admins and plant managers see all factories. */
export async function plantIdsForSession(session: SessionUser) {
  if (isAdminSession(session) || session.permissions.has("plant.manage")) {
    const rows = await prisma.plant.findMany({ select: { id: true } });
    if (rows.length) return rows.map((row) => row.id);
  }
  return session.plantIds;
}

export function primaryPlant(session: SessionUser) {
  const plantId = session.plantIds[0];
  if (!plantId) throw new AppError(403, "FORBIDDEN", "No plant is assigned to this user.");
  return plantId;
}

export function homeFor(session: SessionUser) {
  if (session.permissions.has("job.execute") && !session.permissions.has("job.assign")) return "/shop";
  if (session.permissions.has("dashboard.view")) return "/dashboard";
  if (session.permissions.has("job.execute")) return "/shop";
  if (session.permissions.has("qc.decide")) return "/shop/qc";
  return "/access-denied";
}
