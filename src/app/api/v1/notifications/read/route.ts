import { prisma } from "@/db";
import { requireUser } from "@/lib/access";
import { assertSameOrigin, jsonData, jsonError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireUser();
    const result = await prisma.notification.updateMany({
      where: { userId: session.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return jsonData({ updated: result.count });
  } catch (error) {
    return jsonError(error);
  }
}
