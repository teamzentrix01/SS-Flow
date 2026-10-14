import type { SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

export function hasPermission(session: SessionUser, code: string) {
  return session.permissions.has(code);
}

export function requirePermission(session: SessionUser, code: string) {
  if (!hasPermission(session, code)) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this action.");
  }
}

/** User may assign only roles whose permissions are a subset of their own (unless plant admin). */
export function assertCanAssignRoles(session: SessionUser, targetRolePermissionCodes: string[][]) {
  if (session.permissions.has("plant.manage") || session.roles.has("admin")) return;
  if (!session.permissions.has("user.manage") && !session.permissions.has("role.manage")) {
    throw new AppError(403, "FORBIDDEN", "You cannot assign roles.");
  }
  for (const codes of targetRolePermissionCodes) {
    for (const code of codes) {
      if (!session.permissions.has(code)) {
        throw new AppError(403, "FORBIDDEN", "You cannot grant permissions you do not hold.");
      }
    }
  }
}

export function assertPlantAccess(session: SessionUser, plantId: string) {
  if (!session.plantIds.includes(plantId)) {
    throw new AppError(403, "FORBIDDEN", "This plant is outside your access.");
  }
}
