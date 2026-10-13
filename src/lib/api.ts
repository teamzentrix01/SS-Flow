import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError } from "@/lib/errors";

export async function readJson<T>(request: Request, schema: ZodType<T>) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error instanceof ZodError ? parsed.error.issues[0] : undefined;
    throw new AppError(400, "VALIDATION", issue?.message ?? "Invalid input.");
  }
  return parsed.data;
}

export function idempotencyKey(request: Request) {
  return request.headers.get("idempotency-key");
}

export function jsonData(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}

function prismaClientMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  const code = String((error as { code: string }).code);
  if (code === "P2028") {
    return {
      status: 503,
      code: "TRANSACTION_TIMEOUT",
      message: "The operation took too long. Please try again.",
    };
  }
  if (code === "P2021" || code === "P2022") {
    return {
      status: 503,
      code: "DATABASE_SCHEMA",
      message: "The database schema is out of date. Run pending migrations.",
    };
  }
  return null;
}

export function jsonError(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    );
  }
  const prismaError = prismaClientMessage(error);
  if (prismaError) {
    console.error(error);
    return NextResponse.json(
      { error: { code: prismaError.code, message: prismaError.message } },
      { status: prismaError.status },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong." } },
    { status: 500 },
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return;
  if (new URL(origin).host !== host) {
    throw new AppError(403, "FORBIDDEN", "Cross-origin request blocked.");
  }
}
