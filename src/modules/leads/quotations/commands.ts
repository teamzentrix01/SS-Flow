import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { SessionUser } from "@/lib/auth/session";
import { plantIdsForSession } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, nextNumber, notifyUsers, runCommand } from "@/lib/inventory/post";
import { allow } from "@/modules/shared/allow";
import { addLeadActivity, recordLeadStatus } from "@/modules/leads/record";
import { canTransitionLead } from "@/modules/leads/status";
import { defaultValidUntil } from "@/modules/leads/quotations/config";
import {
  computeLineAmount,
  computeQuotationTotals,
  lineDiscountPct,
  quotationNeedsDiscountApproval,
} from "@/modules/leads/quotations/pricing";
import {
  quotationCanRevise,
  quotationCanSend,
  quotationIsEditable,
  type QuotationSentVia,
} from "@/modules/leads/quotations/status";
import { quotationDetail, quotationDetailInclude, serializeQuotation } from "@/modules/leads/quotations/queries";
import { renderQuotationHtml } from "@/modules/leads/quotations/pdf-html";
import { saveSentDocumentHtml } from "@/modules/leads/quotations/sent-document-html";
import {
  buildLeadItemGradeColumn,
  buildLeadItemLineDescription,
  buildLeadItemSizeColumn,
} from "@/modules/leads/quotations/line-description";

type Tx = Prisma.TransactionClient;

export type QuotationLineWrite = {
  leadItemId?: string;
  productId?: string;
  description?: string;
  grade?: string;
  size?: string;
  qty: string;
  uom: string;
  listRate?: string;
  rate: string;
  pricingBasis?: string;
  expectedDeliveryDate?: string;
};

function parseOptionalDateOnly(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateOnlyIso(value: Date | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.toISOString().slice(0, 10);
}

export type QuotationHeaderWrite = {
  validUntil?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  deliveryTimeDays?: number;
  freightAmount?: string;
  loadingCharges?: string;
  gstPercent?: string;
  notes?: string;
  includesMtc?: boolean;
  thirdPartyInspection?: boolean;
  items?: QuotationLineWrite[];
};

function parseSpecs(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

async function loadLeadForQuote(tx: Tx, leadId: string, plantIds: string[]) {
  const lead = await tx.lead.findFirst({
    where: { id: leadId, plantId: { in: plantIds }, deletedAt: null },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: {
          product: { select: { name: true, code: true, grade: true, sellingPrice: true } },
          parentProduct: { select: { name: true, sku: true } },
          productVariant: { select: { displayName: true, sku: true } },
        },
      },
    },
  });
  if (!lead) throw new AppError(404, "NOT_FOUND", "Lead not found.");
  if (!lead.items.length) throw new AppError(400, "VALIDATION", "Add requested items before creating a quotation.");
  return lead;
}

async function syncLeadItemPricesFromLines(tx: Tx, lines: QuotationLineWrite[] | undefined) {
  if (!lines?.length) return;
  for (const line of lines) {
    if (!line.leadItemId) continue;
    const market = line.listRate?.trim();
    const offer = line.rate?.trim();
    if (!market && !offer) continue;
    await tx.leadItem.update({
      where: { id: line.leadItemId },
      data: {
        ...(market ? { marketPrice: new Decimal(market) } : {}),
        ...(offer ? { priceOffered: new Decimal(offer) } : {}),
      },
    });
  }
}

async function syncLeadItemPricesFromQuotationItems(
  tx: Tx,
  items: { leadItemId: string | null; listRate: Decimal | null; rate: Decimal }[],
) {
  for (const item of items) {
    if (!item.leadItemId) continue;
    await tx.leadItem.update({
      where: { id: item.leadItemId },
      data: {
        marketPrice: item.listRate,
        priceOffered: item.rate,
      },
    });
  }
}

function linesFromLeadItems(
  items: Awaited<ReturnType<typeof loadLeadForQuote>>["items"],
): QuotationLineWrite[] {
  return items.map((item) => {
    const specs = parseSpecs(item.specifications);
    const list =
      item.marketPrice?.toString() ??
      item.product?.sellingPrice?.toString() ??
      item.targetPrice?.toString() ??
      "0";
    const rate =
      item.priceOffered?.toString() ??
      item.targetPrice?.toString() ??
      item.product?.sellingPrice?.toString() ??
      "0";
    const lineSource = {
      itemDescription: item.itemDescription,
      specifications: item.specifications,
      sizeOrCapacity: item.sizeOrCapacity,
      mfgGrade: item.mfgGrade,
      gaugeThicknessMm: item.gaugeThicknessMm,
      product: item.product,
      parentProduct: item.parentProduct,
      productVariant: item.productVariant,
    };
    const gradeCol = buildLeadItemGradeColumn(lineSource);
    const sizeCol = buildLeadItemSizeColumn(lineSource);
    return {
      leadItemId: item.id,
      productId: item.productId ?? undefined,
      description: buildLeadItemLineDescription(lineSource),
      grade: gradeCol === "—" ? undefined : gradeCol,
      size: sizeCol === "—" ? undefined : sizeCol,
      qty: item.quantity.toString(),
      uom: item.uom,
      listRate: list,
      rate,
      pricingBasis: item.pricingBasis ?? undefined,
      expectedDeliveryDate: dateOnlyIso(item.expectedDeliveryDate),
    };
  });
}

async function buildItemRows(tx: Tx, plantId: string, lines: QuotationLineWrite[]) {
  const rows: {
    id: string;
    sortOrder: number;
    leadItemId: string | null;
    productId: string | null;
    description: string | null;
    grade: string | null;
    size: string | null;
    qty: Decimal;
    uom: string;
    listRate: Decimal | null;
    rate: Decimal;
    pricingBasis: string | null;
    discountPct: Decimal | null;
    amount: Decimal;
    expectedDeliveryDate: Date | null;
  }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let productId = line.productId ?? null;
    let description = line.description?.trim() || null;
    let grade = line.grade?.trim() || null;
    let size = line.size?.trim() || null;
    let expectedDeliveryDate = parseOptionalDateOnly(line.expectedDeliveryDate);

    if (line.leadItemId) {
      const leadItem = await tx.leadItem.findFirst({
        where: { id: line.leadItemId },
        include: {
          product: { select: { name: true, code: true, grade: true } },
          parentProduct: { select: { name: true, sku: true } },
          productVariant: { select: { displayName: true, sku: true } },
        },
      });
      if (!productId) productId = leadItem?.productId ?? null;
      if (leadItem) {
        const lineSource = {
          itemDescription: leadItem.itemDescription,
          specifications: leadItem.specifications,
          sizeOrCapacity: leadItem.sizeOrCapacity,
          mfgGrade: leadItem.mfgGrade,
          gaugeThicknessMm: leadItem.gaugeThicknessMm,
          product: leadItem.product,
          parentProduct: leadItem.parentProduct,
          productVariant: leadItem.productVariant,
        };
        const gradeCol = buildLeadItemGradeColumn(lineSource);
        const sizeCol = buildLeadItemSizeColumn(lineSource);
        description = buildLeadItemLineDescription(lineSource);
        grade = gradeCol === "—" ? grade : gradeCol;
        size = sizeCol === "—" ? size : sizeCol;
        if (!expectedDeliveryDate && leadItem.expectedDeliveryDate) {
          expectedDeliveryDate = leadItem.expectedDeliveryDate;
        }
      }
    }

    if (productId) {
      const product = await tx.materialMaster.findFirst({
        where: { id: productId, plantId, active: true, salesAllowed: true },
      });
      if (!product) throw new AppError(400, "VALIDATION", "Each line must reference an active sales product.");
    }
    const listNum = line.listRate ? Number(line.listRate) : 0;
    const rateNum = Number(line.rate);
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      throw new AppError(400, "VALIDATION", "Each line needs a valid rate.");
    }
    const amount = computeLineAmount(line.qty, line.rate);
    rows.push({
      id: uuidv7(),
      sortOrder: i,
      leadItemId: line.leadItemId ?? null,
      productId,
      description,
      grade,
      size,
      qty: new Decimal(line.qty),
      uom: line.uom?.trim() || "PCS",
      listRate: line.listRate ? new Decimal(line.listRate) : null,
      rate: new Decimal(line.rate),
      pricingBasis: line.pricingBasis?.trim().toUpperCase() || null,
      discountPct: listNum > 0 ? new Decimal(lineDiscountPct(listNum, rateNum)) : null,
      amount: new Decimal(amount),
      expectedDeliveryDate,
    });
  }
  return rows;
}

function headerTotals(input: QuotationHeaderWrite, itemRows: { amount: Decimal }[]) {
  const totals = computeQuotationTotals({
    lines: itemRows.map((row) => ({ amount: row.amount.toString() })),
    freightAmount: input.freightAmount ?? "0",
    loadingCharges: input.loadingCharges ?? "0",
    gstPercent: input.gstPercent ?? "18",
  });
  return totals;
}

async function syncLeadAfterQuoteSend(
  tx: Tx,
  lead: { id: string; status: string; orderType: string | null },
  userId: string,
  quotationNumber: string,
  version: number,
  fromRevision: boolean,
) {
  const target: "QUOTATION_SENT" | "NEGOTIATION" | null = fromRevision || lead.status === "NEGOTIATION"
    ? "NEGOTIATION"
    : "QUOTATION_SENT";

  if (target && lead.status !== target && canTransitionLead(lead.status, target, { orderType: lead.orderType })) {
    await recordLeadStatus(tx, lead.id, userId, lead.status, target, `Quotation ${quotationNumber} v${version} sent`);
  } else if (target === "QUOTATION_SENT" && lead.status === "QUOTATION_SENT") {
    // already on stage — activity only
  }

  await addLeadActivity(tx, {
    leadId: lead.id,
    userId,
    activityType: "quotation",
    description: `Quotation ${quotationNumber} (v${version}) marked sent; a copy was saved on this lead.`,
  });
}

export async function createQuotationDraft(
  session: SessionUser,
  leadId: string,
  input: QuotationHeaderWrite & { fromQuotationId?: string },
  key: string | null,
) {
  allow(session, "lead.manage");
  const plantIds = await plantIdsForSession(session);
  return runCommand({
    userId: session.userId,
    route: "quotation.create",
    key,
    run: async (tx) => {
      const lead = await loadLeadForQuote(tx, leadId, plantIds);
      const plantId = lead.plantId;

      let version = 1;
      let groupId = uuidv7();
      let parentQuotationId: string | null = null;
      let lines = input.items && input.items.length > 0 ? input.items : linesFromLeadItems(lead.items);

      if (input.fromQuotationId) {
        const source = await tx.quotation.findFirst({
          where: { id: input.fromQuotationId, leadId, plantId },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        });
        if (!source) throw new AppError(404, "NOT_FOUND", "Source quotation not found.");
        if (!input.items?.length) {
          lines = source.items.map((item) => ({
            leadItemId: item.leadItemId ?? undefined,
            productId: item.productId ?? undefined,
            description: item.description ?? undefined,
            grade: item.grade ?? undefined,
            size: item.size ?? undefined,
            qty: item.qty.toString(),
            uom: item.uom,
            listRate: item.listRate?.toString(),
            rate: item.rate.toString(),
            pricingBasis: item.pricingBasis ?? undefined,
            expectedDeliveryDate: dateOnlyIso(item.expectedDeliveryDate),
          }));
        }
      }

      const itemRows = await buildItemRows(tx, plantId, lines);
      const totals = headerTotals(input, itemRows);
      const approvalRequired = quotationNeedsDiscountApproval(
        itemRows.map((row) => ({
          listRate: row.listRate?.toString(),
          rate: row.rate.toString(),
        })),
      );

      const quotationNumber = await nextNumber(tx, plantId, "QT");
      const validUntil = input.validUntil ? new Date(input.validUntil) : defaultValidUntil();
      const id = uuidv7();

      await tx.quotation.create({
        data: {
          id,
          plantId,
          leadId,
          quotationNumber,
          version,
          groupId,
          parentQuotationId,
          status: "DRAFT",
          validUntil,
          paymentTerms: input.paymentTerms?.trim() || null,
          deliveryTerms: input.deliveryTerms?.trim() || null,
          deliveryTimeDays: input.deliveryTimeDays ?? null,
          freightAmount: new Decimal(input.freightAmount ?? "0"),
          loadingCharges: new Decimal(input.loadingCharges ?? "0"),
          gstPercent: new Decimal(input.gstPercent ?? "18"),
          taxBreakup: totals.taxBreakup as Prisma.InputJsonObject,
          subtotal: new Decimal(totals.subtotal),
          total: new Decimal(totals.total),
          notes: input.notes?.trim() || null,
          includesMtc: input.includesMtc ?? false,
          thirdPartyInspection: input.thirdPartyInspection ?? false,
          approvalRequired,
          approvedById: null,
          approvedAt: null,
          createdById: session.userId,
          items: {
            create: itemRows.map(({ id: itemId, ...row }) => ({ id: itemId, ...row })),
          },
        },
      });

      await audit(tx, {
        userId: session.userId,
        action: "quotation.create",
        resource: "quotation",
        resourceId: id,
        payload: { leadId, quotationNumber, version },
      });

      return { id, quotationNumber, version };
    },
  });
}

export async function updateQuotationDraft(
  session: SessionUser,
  quotationId: string,
  input: QuotationHeaderWrite,
  key: string | null,
) {
  allow(session, "lead.manage");
  const plantIds = await plantIdsForSession(session);
  return runCommand({
    userId: session.userId,
    route: "quotation.update",
    key,
    run: async (tx) => {
      const existing = await tx.quotation.findFirst({
        where: { id: quotationId, plantId: { in: plantIds } },
      });
      if (!existing) throw new AppError(404, "NOT_FOUND", "Quotation not found.");
      if (!quotationIsEditable(existing.status)) {
        throw new AppError(409, "INVALID_STATE", "Only draft quotations can be edited.");
      }

      const lead = await loadLeadForQuote(tx, existing.leadId, [existing.plantId]);
      const incoming = input.items ?? [];
      const coveredLeadItems = new Set(incoming.map((l) => l.leadItemId).filter(Boolean));
      const missingFromLead = lead.items.filter((item) => !coveredLeadItems.has(item.id));
      const mergedLines =
        missingFromLead.length > 0 ? [...incoming, ...linesFromLeadItems(missingFromLead)] : incoming;

      const itemRows = await buildItemRows(tx, existing.plantId, mergedLines);
      const totals = headerTotals(input, itemRows);
      const approvalRequired = quotationNeedsDiscountApproval(
        itemRows.map((row) => ({
          listRate: row.listRate?.toString(),
          rate: row.rate.toString(),
        })),
      );

      await tx.quotationItem.deleteMany({ where: { quotationId } });
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          validUntil: input.validUntil ? new Date(input.validUntil) : existing.validUntil,
          paymentTerms: input.paymentTerms?.trim() || null,
          deliveryTerms: input.deliveryTerms?.trim() || null,
          deliveryTimeDays: input.deliveryTimeDays ?? null,
          freightAmount: new Decimal(input.freightAmount ?? "0"),
          loadingCharges: new Decimal(input.loadingCharges ?? "0"),
          gstPercent: new Decimal(input.gstPercent ?? existing.gstPercent.toString()),
          taxBreakup: totals.taxBreakup as Prisma.InputJsonObject,
          subtotal: new Decimal(totals.subtotal),
          total: new Decimal(totals.total),
          notes: input.notes?.trim() || null,
          includesMtc: input.includesMtc ?? false,
          thirdPartyInspection: input.thirdPartyInspection ?? false,
          approvalRequired,
          approvedById: approvalRequired ? null : existing.approvedById,
          approvedAt: approvalRequired ? null : existing.approvedAt,
          items: {
            create: itemRows.map(({ id: itemId, ...row }) => ({ id: itemId, ...row })),
          },
        },
      });

      await syncLeadItemPricesFromLines(tx, mergedLines);
      await addLeadActivity(tx, {
        leadId: existing.leadId,
        userId: session.userId,
        activityType: "quotation",
        description: "Quotation draft pricing saved on lead items (market & offer rates).",
      });

      return { id: quotationId };
    },
  });
}

export async function approveQuotation(session: SessionUser, quotationId: string, key: string | null) {
  allow(session, "quotation.approve");
  const plantIds = await plantIdsForSession(session);
  return runCommand({
    userId: session.userId,
    route: "quotation.approve",
    key,
    run: async (tx) => {
      const quote = await tx.quotation.findFirst({ where: { id: quotationId, plantId: { in: plantIds } } });
      if (!quote) throw new AppError(404, "NOT_FOUND", "Quotation not found.");
      if (quote.status !== "DRAFT") throw new AppError(409, "INVALID_STATE", "Only draft quotations can be approved.");
      if (!quote.approvalRequired) {
        throw new AppError(400, "VALIDATION", "This quotation does not require manager approval.");
      }
      await tx.quotation.update({
        where: { id: quotationId },
        data: { approvedById: session.userId, approvedAt: new Date() },
      });
      await audit(tx, {
        userId: session.userId,
        action: "quotation.approve",
        resource: "quotation",
        resourceId: quotationId,
      });
      return { id: quotationId };
    },
  });
}

export async function sendQuotation(
  session: SessionUser,
  quotationId: string,
  input: { sentVia: QuotationSentVia },
  key: string | null,
) {
  allow(session, "lead.manage");
  const plantIds = await plantIdsForSession(session);
  return runCommand({
    userId: session.userId,
    route: "quotation.send",
    key,
    run: async (tx) => {
      const quote = await tx.quotation.findFirst({
        where: { id: quotationId, plantId: { in: plantIds } },
        include: quotationDetailInclude,
      });
      if (!quote) throw new AppError(404, "NOT_FOUND", "Quotation not found.");
      if (!quotationCanSend(quote.status)) {
        throw new AppError(409, "INVALID_STATE", "Only draft quotations can be sent.");
      }
      if (quote.approvalRequired && !quote.approvedAt) {
        throw new AppError(
          409,
          "APPROVAL_REQUIRED",
          "Discount exceeds the allowed limit. A manager must approve before sending.",
        );
      }
      if (quote.validUntil.getTime() < Date.now()) {
        throw new AppError(409, "EXPIRED", "Valid-until date is in the past. Update validity before sending.");
      }

      const fromRevision = Boolean(quote.parentQuotationId);
      const sentAt = new Date();
      const sentDocumentHtml = renderQuotationHtml(quote, {
        archived: true,
        sentAt,
        sentVia: input.sentVia,
      });
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: "SENT",
          sentAt,
          sentVia: input.sentVia,
        },
      });
      await saveSentDocumentHtml(tx, quotationId, sentDocumentHtml);

      await syncLeadItemPricesFromQuotationItems(tx, quote.items);
      await syncLeadAfterQuoteSend(
        tx,
        quote.lead,
        session.userId,
        quote.quotationNumber,
        quote.version,
        fromRevision,
      );

      return { id: quotationId, status: "SENT" as const };
    },
  });
}

export async function reviseQuotation(session: SessionUser, quotationId: string, key: string | null) {
  allow(session, "lead.manage");
  const plantIds = await plantIdsForSession(session);
  return runCommand({
    userId: session.userId,
    route: "quotation.revise",
    key,
    run: async (tx) => {
      const source = await tx.quotation.findFirst({
        where: { id: quotationId, plantId: { in: plantIds } },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          lead: { select: { id: true, status: true, orderType: true } },
        },
      });
      if (!source) throw new AppError(404, "NOT_FOUND", "Quotation not found.");
      if (!quotationCanRevise(source.status)) {
        throw new AppError(409, "INVALID_STATE", "Only sent or expired quotations can be revised.");
      }

      await tx.quotation.update({
        where: { id: source.id },
        data: { status: "SUPERSEDED" },
      });

      const nextVersion =
        (
          await tx.quotation.aggregate({
            where: { groupId: source.groupId },
            _max: { version: true },
          })
        )._max.version ?? source.version;

      const lines: QuotationLineWrite[] = source.items.map((item) => ({
        leadItemId: item.leadItemId ?? undefined,
        productId: item.productId ?? undefined,
        description: item.description ?? undefined,
        grade: item.grade ?? undefined,
        size: item.size ?? undefined,
        qty: item.qty.toString(),
        uom: item.uom,
        listRate: item.listRate?.toString(),
        rate: item.rate.toString(),
        pricingBasis: item.pricingBasis ?? undefined,
        expectedDeliveryDate: dateOnlyIso(item.expectedDeliveryDate),
      }));

      const itemRows = await buildItemRows(tx, source.plantId, lines);
      const totals = computeQuotationTotals({
        lines: itemRows.map((row) => ({ amount: row.amount.toString() })),
        freightAmount: source.freightAmount.toString(),
        loadingCharges: source.loadingCharges.toString(),
        gstPercent: source.gstPercent.toString(),
      });
      const approvalRequired = quotationNeedsDiscountApproval(
        itemRows.map((row) => ({
          listRate: row.listRate?.toString(),
          rate: row.rate.toString(),
        })),
      );

      const id = uuidv7();
      const validUntil = defaultValidUntil();

      await tx.quotation.create({
        data: {
          id,
          plantId: source.plantId,
          leadId: source.leadId,
          quotationNumber: source.quotationNumber,
          version: nextVersion + 1,
          groupId: source.groupId,
          parentQuotationId: source.id,
          status: "DRAFT",
          validUntil,
          paymentTerms: source.paymentTerms,
          deliveryTerms: source.deliveryTerms,
          deliveryTimeDays: source.deliveryTimeDays,
          freightAmount: source.freightAmount,
          loadingCharges: source.loadingCharges,
          gstPercent: source.gstPercent,
          taxBreakup: totals.taxBreakup as Prisma.InputJsonObject,
          subtotal: new Decimal(totals.subtotal),
          total: new Decimal(totals.total),
          notes: source.notes,
          includesMtc: source.includesMtc,
          thirdPartyInspection: source.thirdPartyInspection,
          approvalRequired,
          createdById: session.userId,
          items: {
            create: itemRows.map(({ id: itemId, ...row }) => ({ id: itemId, ...row })),
          },
        },
      });

      if (
        source.lead.status !== "NEGOTIATION" &&
        canTransitionLead(source.lead.status, "NEGOTIATION", { orderType: source.lead.orderType })
      ) {
        await recordLeadStatus(
          tx,
          source.lead.id,
          session.userId,
          source.lead.status,
          "NEGOTIATION",
          `Revision draft for ${source.quotationNumber} v${nextVersion + 1}`,
        );
      }

      await addLeadActivity(tx, {
        leadId: source.leadId,
        userId: session.userId,
        activityType: "quotation",
        description: `Started revision v${nextVersion + 1} from ${source.quotationNumber} v${source.version}.`,
      });

      return { id, version: nextVersion + 1 };
    },
  });
}

export async function markQuotationAccepted(tx: Tx, quotationId: string, userId: string) {
  const quote = await tx.quotation.findUnique({ where: { id: quotationId } });
  if (!quote) return;
  if (quote.status === "ACCEPTED") return;
  if (quote.status !== "SENT" && quote.status !== "DRAFT") return;
  await tx.quotation.update({
    where: { id: quotationId },
    data: { status: "ACCEPTED" },
  });
  await addLeadActivity(tx, {
    leadId: quote.leadId,
    userId,
    activityType: "quotation",
    description: `Quotation ${quote.quotationNumber} v${quote.version} accepted on conversion.`,
  });
}

export async function getQuotationForSession(session: SessionUser, id: string) {
  allow(session, "lead.view");
  const plantIds = await plantIdsForSession(session);
  const row = await quotationDetail(id, plantIds);
  if (!row) throw new AppError(404, "NOT_FOUND", "Quotation not found.");
  return serializeQuotation(row);
}
