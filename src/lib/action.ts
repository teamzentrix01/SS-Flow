import type { ZodType } from "zod";
import { assertSameOrigin, idempotencyKey, jsonData, jsonError, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/access";
import type { SessionUser } from "@/lib/auth/session";

export function action<T>(
  permission: string,
  schema: ZodType<T>,
  run: (session: SessionUser, body: T, key: string | null) => Promise<unknown>,
) {
  return async function POST(request: Request) {
    try {
      assertSameOrigin(request);
      const session = await requirePermission(permission);
      const body = await readJson(request, schema);
      return jsonData(await run(session, body, idempotencyKey(request)));
    } catch (error) {
      return jsonError(error);
    }
  };
}
