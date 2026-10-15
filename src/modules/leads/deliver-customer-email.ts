import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { isSmtpConfigured, sendEmail } from "@/lib/mail/send-email";

type NotificationRow = Prisma.CustomerNotificationGetPayload<{
  include: { lead: { select: { email: true; customerName: true; leadNumber: true } } };
}>;

function recipientFor(row: NotificationRow, payload: Record<string, unknown>) {
  const fromPayload = typeof payload.toEmail === "string" ? payload.toEmail.trim() : "";
  if (fromPayload) return fromPayload;
  return row.lead?.email?.trim() ?? "";
}

function subjectFor(row: NotificationRow, payload: Record<string, unknown>) {
  if (typeof payload.subject === "string" && payload.subject.trim()) return payload.subject.trim();
  const ref = row.lead?.leadNumber ?? "enquiry";
  return `SS Metals — update on ${ref}`;
}

async function outboxPayloadFor(notificationId: string) {
  const rows = await prisma.outbox.findMany({
    where: { type: "customer.notification" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  for (const row of rows) {
    const payload = row.payload as Record<string, unknown>;
    if (payload.notificationId === notificationId) {
      return { payload, outboxId: row.id };
    }
  }
  return { payload: {} as Record<string, unknown>, outboxId: null as string | null };
}

async function markOutboxDelivered(outboxId: string | null) {
  if (!outboxId) return;
  await prisma.outbox.update({
    where: { id: outboxId },
    data: { deliveredAt: new Date() },
  });
}

export async function deliverCustomerNotificationById(notificationId: string) {
  const row = await prisma.customerNotification.findUnique({
    where: { id: notificationId },
    include: { lead: { select: { email: true, customerName: true, leadNumber: true } } },
  });
  if (!row || row.channel !== "email") return;
  if (row.status === "sent") return;

  if (!isSmtpConfigured()) {
    await prisma.customerNotification.update({
      where: { id: notificationId },
      data: {
        status: "skipped",
        errorDetail: "SMTP not configured (set SMTP_HOST and SMTP_FROM, or SMTP_LOG_ONLY=1 for dev).",
      },
    });
    return;
  }

  const { payload, outboxId } = await outboxPayloadFor(notificationId);

  const to = recipientFor(row, payload);
  if (!to) {
    await prisma.customerNotification.update({
      where: { id: notificationId },
      data: { status: "skipped", errorDetail: "No email address on this lead." },
    });
    return;
  }

  try {
    const result = await sendEmail({
      to,
      subject: subjectFor(row, payload),
      text: row.message,
    });
    await prisma.customerNotification.update({
      where: { id: notificationId },
      data: {
        status: "sent",
        sentAt: new Date(),
        providerRef: result.messageId || null,
        errorDetail: null,
      },
    });
    await markOutboxDelivered(outboxId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Send failed.";
    await prisma.customerNotification.update({
      where: { id: notificationId },
      data: { status: "failed", errorDetail: detail.slice(0, 500) },
    });
    throw error;
  }
}

export async function deliverPendingCustomerEmails(limit = 25) {
  const pending = await prisma.customerNotification.findMany({
    where: { status: "pending", channel: "email" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let sent = 0;
  for (const row of pending) {
    try {
      await deliverCustomerNotificationById(row.id);
      sent += 1;
    } catch {
      /* status updated on row */
    }
  }
  return { processed: pending.length, sent };
}
