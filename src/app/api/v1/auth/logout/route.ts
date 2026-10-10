import { cookies } from "next/headers";
import { prisma } from "@/db";
import { jsonData } from "@/lib/api";
import { cookieName } from "@/lib/auth/session";
import { hashSecret } from "@/lib/ids";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(cookieName())?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashSecret(token) } });
  const response = jsonData({ ok: true });
  response.cookies.set(cookieName(), "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
