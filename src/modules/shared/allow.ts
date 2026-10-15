import type { SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { hasPermission } from "@/lib/rbac/authz";

export function allow(session: SessionUser, code: string) {
  if (!hasPermission(session, code)) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this action.");
  }
}
