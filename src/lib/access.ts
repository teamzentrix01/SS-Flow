import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new AppError(401, "UNAUTHENTICATED", "Sign in required.");
  return session;
}

export async function requirePermission(code: string) {
  const session = await requireUser();
  if (!session.permissions.has(code)) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this action.");
  }
  return session;
}

export async function requirePage(permission?: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (permission && !session.permissions.has(permission)) redirect("/access-denied");
  return session;
}

export function assertPlant(session: SessionUser, plantId: string) {
  if (!session.plantIds.includes(plantId)) {
    throw new AppError(403, "FORBIDDEN", "This plant is outside your access.");
  }
}

export function primaryPlant(session: SessionUser) {
  const plantId = session.plantIds[0];
  if (!plantId) throw new AppError(403, "FORBIDDEN", "No plant is assigned to this user.");
  return plantId;
}

export function homeFor(session: SessionUser) {
  if (session.permissions.has("dashboard.view")) return "/dashboard";
  if (session.permissions.has("job.execute")) return "/shop";
  if (session.permissions.has("qc.decide")) return "/shop/qc";
  return "/access-denied";
}
