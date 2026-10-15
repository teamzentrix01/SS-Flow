import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import {
  audit,
  nextNumber,
  notifyUsers,
  QUICK_TX_OPTS,
  usersForPlantLeadAlerts,
  usersWithPermission,
} from "@/lib/inventory/post";
import { leadEmailSubject, leadReceivedEmailBody, notifyLeadByEmail } from "@/modules/leads/lead-email";
import { addLeadActivity, recordLeadStatus } from "@/modules/leads/record";
import type { LeadItemInput } from "@/modules/leads/commands";

const MAX_PER_HOUR = 8;
const PHONE_WINDOW_MIN = 15;

type Db = Prisma.TransactionClient;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function resolvePublicLeadPlant(plantCode?: string) {
  const code = plantCode?.trim() || process.env.PUBLIC_LEAD_PLANT_CODE || "PLANT-01";
  const plant = await prisma.plant.findFirst({ where: { code } });
  if (!plant) throw new AppError(503, "UNAVAILABLE", "Enquiries are not available right now.");
  return plant;
}

async function resolveWebsiteLeadActor(db: Db, plantId: string) {
  const salesUsers = await usersWithPermission(db, plantId, "lead.manage");
  if (salesUsers[0]) return salesUsers[0];
  const fallback = await db.user.findFirst({
    where: { plantAccess: { some: { plantId } }, disabledAt: null },
    select: { id: true },
  });
  return fallback?.id ?? null;
}

async function notifyWebsiteLeadCreated(input: {
  plantId: string;
  leadId: string;
  leadNumber: string;
  customerName: string;
  actorId: string;
  customerEmail?: string;
}) {
  const alertUsers = await usersForPlantLeadAlerts(prisma, input.plantId);
  await prisma.$transaction(async (tx) => {
    if (alertUsers.length) {
      await notifyUsers(tx, {
        userIds: alertUsers,
        type: "lead.website",
        title: "New website lead",
        body: `${input.leadNumber} — ${input.customerName}`,
        href: `/leads/${input.leadId}`,
      });
    }
    await audit(tx, {
      userId: input.actorId,
      action: "lead.website",
      resource: "lead",
      resourceId: input.leadId,
    });
  }, QUICK_TX_OPTS);

  const toEmail = input.customerEmail?.trim();
  if (toEmail) {
    await notifyLeadByEmail({
      plantId: input.plantId,
      leadId: input.leadId,
      toEmail,
      subject: leadEmailSubject(input.leadNumber, "received"),
      message: leadReceivedEmailBody(input.customerName, input.leadNumber),
    });
  }
}

export async function createWebsiteLead(input: {
  plantCode?: string;
  customerName: string;
  phone: string;
  email?: string;
  companyName?: string;
  honeypot?: string;
  items: LeadItemInput[];
  idempotencyKey?: string;
  clientIp?: string;
}) {
  if (input.honeypot?.trim()) {
    return { ok: true as const, reference: "received" };
  }

  const plant = await resolvePublicLeadPlant(input.plantCode);
  const ipHash = hash(input.clientIp ?? "unknown");
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000);
  const recentIp = await prisma.leadPublicSubmission.count({
    where: { plantId: plant.id, ipHash, createdAt: { gte: sinceHour } },
  });
  if (recentIp >= MAX_PER_HOUR) {
    throw new AppError(429, "RATE_LIMIT", "Too many enquiries. Please try again later.");
  }

  const phoneNorm = input.phone.replace(/\D/g, "").slice(-10);
  const fingerprint = input.idempotencyKey?.trim() || hash(`${plant.id}:${phoneNorm}:${input.customerName.toLowerCase()}`);
  const existing = await prisma.leadPublicSubmission.findUnique({ where: { fingerprint } });
  if (existing) {
    return { ok: true as const, reference: "received" };
  }

  const dupRecent = await prisma.lead.findFirst({
    where: {
      plantId: plant.id,
      phone: { contains: phoneNorm },
      source: "WEBSITE",
      createdAt: { gte: new Date(Date.now() - PHONE_WINDOW_MIN * 60 * 1000) },
    },
  });
  if (dupRecent) {
    return { ok: true as const, reference: "received" };
  }

  const actorId = await resolveWebsiteLeadActor(prisma, plant.id);
  if (!actorId) throw new AppError(503, "UNAVAILABLE", "Enquiries are not available right now.");

  const customerEmail = input.email?.trim() || undefined;

  const result = await prisma.$transaction(async (tx) => {
    const leadNumber = await nextNumber(tx, plant.id, "LD");
    const id = uuidv7();
    await tx.lead.create({
      data: {
        id,
        plantId: plant.id,
        leadNumber,
        customerName: input.customerName.trim().slice(0, 120),
        email: customerEmail?.slice(0, 120) || null,
        phone: input.phone.trim().slice(0, 20),
        companyName: input.companyName?.trim().slice(0, 120) || null,
        source: "WEBSITE",
        status: "NEW",
        priority: "normal",
      },
    });
    for (const line of input.items.length ? input.items : [{ quantity: "1", itemDescription: "General enquiry" }]) {
      await tx.leadItem.create({
        data: {
          id: uuidv7(),
          leadId: id,
          productId: line.productId ?? null,
          productVariantId: line.productVariantId ?? null,
          itemDescription: line.itemDescription?.slice(0, 500) ?? null,
          quantity: line.quantity,
          uom: line.uom ?? "PCS",
          specifications: (line.specifications ?? {}) as object,
        },
      });
    }
    await recordLeadStatus(tx, id, actorId, null, "NEW", "Website enquiry");
    await addLeadActivity(tx, {
      leadId: id,
      userId: actorId,
      activityType: "website",
      description: "Enquiry submitted from the public website.",
    });
    await tx.leadPublicSubmission.create({
      data: { id: uuidv7(), plantId: plant.id, ipHash, fingerprint, leadId: id },
    });
    return { id, leadNumber };
  }, QUICK_TX_OPTS);

  void notifyWebsiteLeadCreated({
    plantId: plant.id,
    leadId: result.id,
    leadNumber: result.leadNumber,
    customerName: input.customerName,
    actorId,
    customerEmail,
  }).catch((error) => console.error("[lead.website.notify]", error));

  return { ok: true as const, reference: result.leadNumber };
}
