import type { SessionUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

export function allow(session: SessionUser, code: string) {
  if (!session.permissions.has(code)) {
    throw new AppError(403, "FORBIDDEN", "You do not have access to this action.");
  }
}
