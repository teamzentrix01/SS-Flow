import { jsonData, jsonError } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError(new AppError(401, "UNAUTHENTICATED", "Sign in required."));
  return jsonData({ name: session.name, email: session.email, permissions: [...session.permissions] });
}
