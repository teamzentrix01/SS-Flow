import { prisma } from "@/db";
import { notifyUsers } from "@/lib/inventory/post";

export async function runQuotationExpiryJob() {
  const now = new Date();
  const expired = await prisma.quotation.findMany({
    where: {
      status: "SENT",
      validUntil: { lt: now },
    },
    select: {
      id: true,
      plantId: true,
      leadId: true,
      quotationNumber: true,
      version: true,
      lead: {
        select: {
          leadNumber: true,
          assignee: { select: { userId: true } },
        },
      },
    },
  });

  let updated = 0;
  for (const quote of expired) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.quotation.updateMany({
        where: { id: quote.id, status: "SENT" },
        data: { status: "EXPIRED" },
      });
      if (!claimed.count) return;

      const userIds = new Set<string>();
      if (quote.lead.assignee?.userId) userIds.add(quote.lead.assignee.userId);

      if (userIds.size) {
        await notifyUsers(tx, {
          userIds: [...userIds],
          type: "quotation.expired",
          title: `Quotation expired · ${quote.quotationNumber}`,
          body: `Lead ${quote.lead.leadNumber} · v${quote.version} passed validity.`,
          href: `/leads/${quote.leadId}`,
          payload: { quotationId: quote.id, leadId: quote.leadId },
        });
      }
      updated += 1;
    });
  }

  return { scanned: expired.length, expired: updated };
}
