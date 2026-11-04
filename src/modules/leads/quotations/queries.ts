import type { Prisma } from "@prisma/client";
import { prisma } from "@/db";

export const quotationDetailInclude = {
  lead: {
    select: {
      id: true,
      leadNumber: true,
      customerName: true,
      companyName: true,
      contactPerson: true,
      phone: true,
      email: true,
      address: true,
      gstin: true,
      status: true,
      orderType: true,
    },
  },
  plant: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  parentQuotation: { select: { id: true, version: true, quotationNumber: true } },
  items: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      product: { select: { id: true, name: true, code: true, sellingPrice: true } },
      leadItem: {
        select: {
          id: true,
          itemDescription: true,
          specifications: true,
          sizeOrCapacity: true,
          mfgGrade: true,
          gaugeThicknessMm: true,
          uom: true,
          expectedDeliveryDate: true,
          product: { select: { name: true, code: true, grade: true } },
          parentProduct: { select: { name: true, sku: true } },
          productVariant: { select: { displayName: true, sku: true } },
        },
      },
    },
  },
} satisfies Prisma.QuotationInclude;

const SENT_QUOTATION_STATUSES = ["SENT", "ACCEPTED", "EXPIRED", "SUPERSEDED"] as const;

export async function listSentQuotationsForLead(leadId: string, plantIds: string[]) {
  return prisma.quotation.findMany({
    where: {
      leadId,
      plantId: { in: plantIds },
      status: { in: [...SENT_QUOTATION_STATUSES] },
      sentAt: { not: null },
    },
    orderBy: [{ sentAt: "desc" }, { version: "desc" }],
    select: {
      id: true,
      quotationNumber: true,
      version: true,
      status: true,
      sentAt: true,
      sentVia: true,
      total: true,
    },
  });
}

export async function listLeadQuotations(leadId: string, plantIds: string[]) {
  return prisma.quotation.findMany({
    where: { leadId, plantId: { in: plantIds } },
    orderBy: [{ groupId: "desc" }, { version: "desc" }],
    include: {
      createdBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
      items: { orderBy: { sortOrder: "asc" }, include: { product: { select: { id: true, name: true, code: true } } } },
    },
  });
}

export async function quotationDetail(id: string, plantIds: string[]) {
  return prisma.quotation.findFirst({
    where: { id, plantId: { in: plantIds } },
    include: quotationDetailInclude,
  });
}

export function serializeQuotationSummary(
  row: Awaited<ReturnType<typeof listLeadQuotations>>[number],
) {
  return {
    id: row.id,
    leadId: row.leadId,
    quotationNumber: row.quotationNumber,
    version: row.version,
    groupId: row.groupId,
    parentQuotationId: row.parentQuotationId,
    status: row.status,
    validUntil: row.validUntil.toISOString(),
    subtotal: row.subtotal.toString(),
    total: row.total.toString(),
    approvalRequired: row.approvalRequired,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    createdBy: row.createdBy,
    sentAt: row.sentAt?.toISOString() ?? null,
    sentVia: row.sentVia,
    hasSentCopy: "sentDocumentHtml" in row && Boolean((row as { sentDocumentHtml?: string | null }).sentDocumentHtml),
    createdAt: row.createdAt.toISOString(),
    itemCount: row.items.length,
  };
}

export function serializeQuotation(row: Awaited<ReturnType<typeof quotationDetail>>) {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.leadId,
    quotationNumber: row.quotationNumber,
    version: row.version,
    groupId: row.groupId,
    parentQuotationId: row.parentQuotationId,
    status: row.status,
    validUntil: row.validUntil.toISOString(),
    paymentTerms: row.paymentTerms,
    deliveryTerms: row.deliveryTerms,
    deliveryTimeDays: row.deliveryTimeDays,
    freightAmount: row.freightAmount.toString(),
    loadingCharges: row.loadingCharges.toString(),
    gstPercent: row.gstPercent.toString(),
    taxBreakup: row.taxBreakup,
    subtotal: row.subtotal.toString(),
    total: row.total.toString(),
    notes: row.notes,
    includesMtc: row.includesMtc,
    thirdPartyInspection: row.thirdPartyInspection,
    approvalRequired: row.approvalRequired,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    createdBy: row.createdBy,
    sentAt: row.sentAt?.toISOString() ?? null,
    sentVia: row.sentVia,
    hasSentCopy: "sentDocumentHtml" in row && Boolean((row as { sentDocumentHtml?: string | null }).sentDocumentHtml),
    createdAt: row.createdAt.toISOString(),
    lead: row.lead,
    plant: row.plant,
    parentQuotation: row.parentQuotation,
    items: row.items.map((item) => ({
      id: item.id,
      sortOrder: item.sortOrder,
      leadItemId: item.leadItemId,
      productId: item.productId,
      description: item.description,
      grade: item.grade,
      size: item.size,
      qty: item.qty.toString(),
      uom: item.uom,
      listRate: item.listRate?.toString() ?? null,
      rate: item.rate.toString(),
      pricingBasis: item.pricingBasis,
      discountPct: item.discountPct?.toString() ?? null,
      amount: item.amount.toString(),
      expectedDeliveryDate: item.expectedDeliveryDate?.toISOString().slice(0, 10) ?? null,
      product: item.product,
      leadItem: item.leadItem
        ? {
            ...item.leadItem,
            expectedDeliveryDate: item.leadItem.expectedDeliveryDate?.toISOString().slice(0, 10) ?? null,
            gaugeThicknessMm: item.leadItem.gaugeThicknessMm?.toString() ?? null,
          }
        : null,
    })),
  };
}
