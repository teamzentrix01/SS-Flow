import type { Prisma } from "@prisma/client";
import { isOpenLeadStatus } from "@/modules/leads/follow-up";

type Db = Prisma.TransactionClient | { lead: Prisma.LeadDelegate; customer: Prisma.CustomerDelegate };

export type DuplicateMatch = {
  kind: "lead" | "customer";
  id: string;
  label: string;
  href?: string;
  reason: string;
  status?: string;
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function normalizePhone(raw: string | null | undefined) {
  if (!raw?.trim()) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) digits = digits.slice(-10);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

export function normalizeGstin(raw: string | null | undefined) {
  return raw?.trim().toUpperCase() ?? "";
}

export function isValidGstin(raw: string | null | undefined) {
  const value = normalizeGstin(raw);
  if (!value) return true;
  return value.length === 15 && GSTIN_RE.test(value);
}

export async function findDuplicateMatches(
  db: Db,
  plantId: string,
  input: {
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    excludeLeadId?: string;
  },
): Promise<DuplicateMatch[]> {
  const phoneNormalized = normalizePhone(input.phone);
  const email = input.email?.trim().toLowerCase() || "";
  const gstin = normalizeGstin(input.gstin);
  const matches: DuplicateMatch[] = [];
  const seen = new Set<string>();

  if (!phoneNormalized && !email && !gstin) return [];

  const or: Prisma.LeadWhereInput[] = [
    ...(phoneNormalized ? [{ phoneNormalized }] : []),
    ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
    ...(gstin ? [{ gstin }] : []),
  ];

  const openLeads = await db.lead.findMany({
    where: {
      plantId,
      deletedAt: null,
      status: { notIn: ["CONVERTED", "LOST", "REJECTED"] },
      ...(input.excludeLeadId ? { id: { not: input.excludeLeadId } } : {}),
      OR: or,
    },
    select: {
      id: true,
      leadNumber: true,
      customerName: true,
      companyName: true,
      status: true,
      phone: true,
      email: true,
      gstin: true,
      phoneNormalized: true,
    },
    take: 20,
  });

  const legacyLeads =
    phoneNormalized && openLeads.length < 20
      ? await db.lead.findMany({
          where: {
            plantId,
            deletedAt: null,
            phoneNormalized: null,
            status: { notIn: ["CONVERTED", "LOST", "REJECTED"] },
            ...(input.excludeLeadId ? { id: { not: input.excludeLeadId } } : {}),
          },
          select: {
            id: true,
            leadNumber: true,
            customerName: true,
            companyName: true,
            status: true,
            phone: true,
            email: true,
            gstin: true,
            phoneNormalized: true,
          },
          take: 200,
        })
      : [];

  for (const lead of [...openLeads, ...legacyLeads.filter((row) => !openLeads.some((x) => x.id === row.id))]) {
    const reasons: string[] = [];
    if (
      phoneNormalized &&
      (lead.phoneNormalized === phoneNormalized || normalizePhone(lead.phone) === phoneNormalized)
    ) {
      reasons.push("phone");
    }
    if (email && lead.email?.toLowerCase() === email) reasons.push("email");
    if (gstin && lead.gstin === gstin) reasons.push("GSTIN");
    if (!reasons.length) continue;
    const key = `lead:${lead.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      kind: "lead",
      id: lead.id,
      label: `${lead.leadNumber} · ${lead.companyName || lead.customerName}`,
      href: `/leads/${lead.id}`,
      reason: reasons.join(", "),
      status: lead.status,
    });
  }

  if (phoneNormalized) {
    const customers = await db.customer.findMany({
      where: { plantId, phone: { not: null } },
      select: { id: true, code: true, name: true, phone: true },
      take: 200,
    });
    for (const customer of customers) {
      if (normalizePhone(customer.phone) !== phoneNormalized) continue;
      const key = `customer:${customer.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        kind: "customer",
        id: customer.id,
        label: `${customer.code} · ${customer.name}`,
        reason: "phone",
      });
    }
  }

  return matches;
}

/** First open lead match for public enquiry merge (phone → email → GSTIN). */
export async function findOpenLeadForPublicMerge(
  db: Db,
  plantId: string,
  input: { phone?: string; email?: string | null; gstin?: string | null },
) {
  const matches = await findDuplicateMatches(db, plantId, input);
  return matches.find((row) => row.kind === "lead") ?? null;
}

export function leadIdentityPatch(input: {
  phone: string;
  email?: string | null;
  gstin?: string | null;
  companyName?: string | null;
}) {
  return {
    phone: input.phone.trim(),
    phoneNormalized: normalizePhone(input.phone) || null,
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    ...(normalizeGstin(input.gstin) ? { gstin: normalizeGstin(input.gstin) } : {}),
  };
}

export async function backfillLeadPhoneNormalized(db: { lead: Prisma.LeadDelegate }) {
  const rows = await db.lead.findMany({
    where: { phoneNormalized: null },
    select: { id: true, phone: true },
  });
  let updated = 0;
  for (const row of rows) {
    const phoneNormalized = normalizePhone(row.phone);
    if (!phoneNormalized) continue;
    await db.lead.update({ where: { id: row.id }, data: { phoneNormalized } });
    updated += 1;
  }
  return updated;
}

export function isOpenLead(status: string) {
  return isOpenLeadStatus(status);
}
