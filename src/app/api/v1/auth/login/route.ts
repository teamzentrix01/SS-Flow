import { prisma } from "@/db";
import { homeFor } from "@/lib/access";
import { assertSameOrigin, jsonData, jsonError, readJson } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { cookieName } from "@/lib/auth/session";
import { permissionsForSession } from "@/lib/rbac/authz";
import { AppError } from "@/lib/errors";
import { hashSecret, newSecret, uuidv7 } from "@/lib/ids";
import { loginSchema } from "@/lib/schemas";

const attempts = new Map<string, { count: number; at: number }>();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    const current = attempts.get(ip);
    if (current && Date.now() - current.at < 60_000 && current.count > 8) {
      throw new AppError(429, "RATE_LIMIT", "Too many sign-in attempts.");
    }
    const body = await readJson(request, loginSchema);
    const loginId = body.email.trim();
    const account = {
      employee: true,
      plantAccess: true,
      userPermissions: { include: { permission: true } },
      userRoles: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    } as const;
    const byEmail = await prisma.user.findUnique({
      where: { email: loginId.toLowerCase() },
      include: account,
    });
    const byCode = byEmail
      ? null
      : await prisma.employee.findFirst({
          where: {
            code: { equals: loginId, mode: "insensitive" },
            userId: { not: null },
          },
          include: { user: { include: account } },
        });
    const user = byEmail ?? byCode?.user ?? null;
    if (
      !user ||
      user.disabledAt ||
      !(await verifyPassword(user.passwordHash, body.password))
    ) {
      attempts.set(ip, { count: (current?.count ?? 0) + 1, at: Date.now() });
      throw new AppError(
        401,
        "INVALID_LOGIN",
        "Employee ID or password is incorrect.",
      );
    }
    attempts.delete(ip);
    const token = newSecret();
    await prisma.session.create({
      data: {
        id: uuidv7(),
        userId: user.id,
        tokenHash: hashSecret(token),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12),
        lastSeenAt: new Date(),
      },
    });
    const roles = new Set(user.userRoles.map((link) => link.role.code));
    const fromRoles: string[] = [];
    for (const link of user.userRoles)
      for (const item of link.role.permissions) fromRoles.push(item.permission.code);
    const fromUser = user.userPermissions.map((item) => item.permission.code);
    const permissions = permissionsForSession(roles, fromUser.length ? fromUser : fromRoles);
    const response = jsonData({
      redirect: homeFor({
        userId: user.id,
        email: user.email,
        name: user.name,
        employeeId: user.employee?.id ?? null,
        plantIds: user.plantAccess.map((row) => row.plantId),
        permissions,
        roles,
      }),
    });
    response.cookies.set(cookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
