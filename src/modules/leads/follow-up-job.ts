import { prisma } from "@/db";
import { notifyUsers, usersWithPermission } from "@/lib/inventory/post";
import {
  isFollowUpOverdue,
  isOpenLeadStatus,
  leadStaleLevel,
  LEAD_STALE_WARNING_DAYS,
  staleThresholdDate,
} from "@/modules/leads/follow-up";
import { addLeadActivity } from "@/modules/leads/record";

export async function runLeadFollowUpAlerts() {
  const now = new Date();
  const staleCutoff = staleThresholdDate(LEAD_STALE_WARNING_DAYS, now);
  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      status: { notIn: ["CONVERTED", "LOST", "REJECTED"] },
      OR: [{ nextFollowUpAt: { lt: now } }, { lastActivityAt: { lt: staleCutoff } }],
    },
    select: {
      id: true,
      plantId: true,
      leadNumber: true,
      status: true,
      assigneeId: true,
      nextFollowUpAt: true,
      lastActivityAt: true,
      assignee: { select: { userId: true } },
    },
  });

  let notified = 0;
  for (const lead of leads) {
    if (!isOpenLeadStatus(lead.status)) continue;
    const overdue = isFollowUpOverdue(lead.status, lead.nextFollowUpAt, now);
    const stale = leadStaleLevel(lead.status, lead.lastActivityAt ?? lead.nextFollowUpAt, now);
    if (!overdue && stale === "none") continue;

    await prisma.$transaction(async (tx) => {
      const managerIds = await usersWithPermission(tx, lead.plantId, "lead.manage");
      const userIds = new Set<string>();
      if (lead.assignee?.userId) userIds.add(lead.assignee.userId);
      for (const id of managerIds) userIds.add(id);
      if (!userIds.size) return;

      const parts = [
        overdue ? "follow-up overdue" : null,
        stale !== "none" ? `stale (${stale})` : null,
      ].filter(Boolean);

      await notifyUsers(tx, {
        userIds: [...userIds],
        type: "lead.follow_up",
        title: `Lead ${lead.leadNumber}`,
        body: `${parts.join(" · ")} — action needed.`,
        href: `/leads/${lead.id}`,
        payload: { leadId: lead.id, overdue, stale },
      });
      notified += 1;
    });
  }

  const repeatDue = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      status: "CONVERTED",
      repeatOrderFollowUpAt: { lte: now },
    },
    select: {
      id: true,
      plantId: true,
      leadNumber: true,
      repeatOrderFollowUpAt: true,
      assignee: { select: { userId: true } },
      salesOrder: { select: { number: true } },
    },
  });

  let repeatNotified = 0;
  for (const lead of repeatDue) {
    await prisma.$transaction(async (tx) => {
      const managerIds = await usersWithPermission(tx, lead.plantId, "lead.manage");
      const userIds = new Set<string>();
      if (lead.assignee?.userId) userIds.add(lead.assignee.userId);
      for (const id of managerIds) userIds.add(id);
      if (!userIds.size) return;

      await notifyUsers(tx, {
        userIds: [...userIds],
        type: "lead.repeat_order",
        title: `Repeat order · ${lead.leadNumber}`,
        body: `Check for repeat business${lead.salesOrder?.number ? ` (SO ${lead.salesOrder.number})` : ""}.`,
        href: `/leads/${lead.id}`,
        payload: { leadId: lead.id },
      });

      const systemUserId = [...userIds][0];
      await tx.lead.update({
        where: { id: lead.id },
        data: { repeatOrderFollowUpAt: null },
      });
      await addLeadActivity(tx, {
        leadId: lead.id,
        userId: systemUserId,
        activityType: "repeat_order_follow_up",
        description: "Repeat order follow-up due — assignee notified.",
      });
      repeatNotified += 1;
    });
  }

  return { scanned: leads.length, notified, repeatOrderDue: repeatDue.length, repeatOrderNotified: repeatNotified };
}
