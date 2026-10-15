import type { Prisma } from "@prisma/client";
import { uuidv7 } from "@/lib/ids";
import type { LeadStatus } from "@/modules/leads/status";

type Tx = Prisma.TransactionClient;

export async function recordLeadStatus(
  tx: Tx,
  leadId: string,
  userId: string,
  oldStatus: string | null,
  newStatus: LeadStatus,
  reason?: string,
) {
  await tx.leadStatusHistory.create({
    data: {
      id: uuidv7(),
      leadId,
      oldStatus,
      newStatus,
      changedById: userId,
      reason: reason ?? null,
    },
  });
  await tx.lead.update({ where: { id: leadId }, data: { status: newStatus } });
}

export async function addLeadActivity(
  tx: Tx,
  input: {
    leadId: string;
    userId: string;
    activityType: string;
    description: string;
    nextFollowUpAt?: Date | null;
  },
) {
  await tx.leadActivity.create({
    data: {
      id: uuidv7(),
      leadId: input.leadId,
      activityType: input.activityType,
      description: input.description,
      performedById: input.userId,
      nextFollowUpAt: input.nextFollowUpAt ?? null,
    },
  });
  if (input.nextFollowUpAt) {
    await tx.lead.update({
      where: { id: input.leadId },
      data: { nextFollowUpAt: input.nextFollowUpAt },
    });
  }
}
