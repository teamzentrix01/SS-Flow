import { NextResponse } from "next/server";
import { AppError } from "./errors";
import { getSession, type SessionUser } from "./auth/session";

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

export function assertPlant(session: SessionUser, plantId: string) {
  if (!session.plantIds.includes(plantId)) {
    throw new AppError(403, "FORBIDDEN", "This plant is outside your access.");
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function routeError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "The request could not be completed." } },
    { status: 500 },
  );
}

export function idempotencyKey(request: Request) {
  return request.headers.get("idempotency-key");
}

export async function readBody<T>(request: Request, parse: (value: unknown) => T) {
  const body = await request.json().catch(() => null);
  try {
    return parse(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid input.";
    throw new AppError(400, "VALIDATION", message);
  }
}
