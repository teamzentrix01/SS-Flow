import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type { SessionUser } from "@/lib/auth/session";
import { plantIdsForSession, primaryPlant } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit, nextNumber, notifyUsers, runCommand } from "@/lib/inventory/post";
import { createCustomerInTx } from "@/lib/masters";
import { allow } from "@/modules/shared/allow";
import { leadEmailSubject, notifyLeadByEmail, notifyLeadStatusEmail } from "@/modules/leads/lead-email";
import { addLeadActivity, recordLeadStatus } from "@/modules/leads/record";
import {
  assertLeadTransition,
  leadCanConvert,
  leadCanVerify,
  leadRequiresLostReason,
  type LeadSource,
  type LeadStatus,
} from "@/modules/leads/status";

type Tx = Prisma.TransactionClient;

async function leadForSession(tx: Tx, leadId: string, session: SessionUser) {
  const plantIds = await plantIdsForSession(session);
  if (!plantIds.length) throw new AppError(404, "NOT_FOUND", "Lead not found.");
  const lead = await tx.lead.findFirst({ where: { id: leadId, plantId: { in: plantIds }, deletedAt: null } });
  if (!lead) throw new AppError(404, "NOT_FOUND", "Lead not found.");
  return lead;
}

export async function softDeleteLead(session: SessionUser, leadId: string, key: string | null) {
  allow(session, "lead.manage");
  return runCommand({
    userId: session.userId,
    route: "lead.delete",
    key,
    run: async (tx) => {
      const lead = await leadForSession(tx, leadId, session);
      const deletedAt = new Date();
      const changed = await tx.lead.updateMany({
        where: { id: leadId, plantId: lead.plantId, deletedAt: null },
        data: { deletedAt },
      });
      if (changed.count !== 1) throw new AppError(404, "NOT_FOUND", "Lead not found.");
      await audit(tx, { userId: session.userId, action: "lead.soft_delete", resource: "lead", resourceId: leadId });
      return { id: leadId, mode: "soft_deleted" as const };
    },
  });
}

export type LeadItemInput = {
  categoryId?: string;
  productId?: string;
  parentProductId?: string;
  productVariantId?: string;
  itemDescription?: string;
  quantity: string;
  unitId?: string;
  uom?: string;
  targetPrice?: string;
  thickness?: string;
  grade?: string;
  size?: string;
  estimatedWeight?: string;
  priceOffered?: string;
  priceFinalised?: string;
  specifications?: Record<string, unknown>;
  notes?: string;
};

async function notifyAssignee(tx: Tx, plantId: string, assigneeId: string | null, leadId: string, leadNumber: string) {
  if (!assigneeId) return;
  const employee = await tx.employee.findUnique({ where: { id: assigneeId }, select: { userId: true } });
  if (!employee?.userId) return;
  await notifyUsers(tx, {
    userIds: [employee.userId],
    type: "lead.assigned",
    title: "Lead assigned to you",
    body: `${leadNumber} needs follow-up.`,
    href: `/leads/${leadId}`,
  });
}

async function createLeadItems(tx: Tx, leadId: string, items: LeadItemInput[]) {
  const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId }, select: { plantId: true } });
  for (const line of items) {
    if (!line.productId && !line.itemDescription?.trim() && !line.thickness && !line.grade && !line.size) {
      throw new AppError(400, "VALIDATION", "Each line needs a product, description, or specification.");
    }
    let parentProductId = line.parentProductId;
    if (line.productVariantId) {
      const variant = await tx.productVariant.findFirst({
        where: { id: line.productVariantId, plantId: lead.plantId, isActive: true, product: { isActive: true } },
        select: { id: true, productId: true, materialMasterId: true, displayName: true, attributes: true, grade: true, finish: true, thicknessMm: true, widthMm: true, lengthMm: true, diameterMm: true, product: { select: { categoryId: true } } },
      });
      if (!variant || !line.productId || variant.materialMasterId !== line.productId || (parentProductId && parentProductId !== variant.productId) || (line.categoryId && line.categoryId !== variant.product.categoryId)) {
        throw new AppError(400, "VALIDATION", "Choose an active variant that belongs to the selected parent product.");
      }
      parentProductId = variant.productId;
      const variantSpecs = variant.attributes && typeof variant.attributes === "object" && !Array.isArray(variant.attributes) ? variant.attributes as Record<string, unknown> : {};
      line.specifications = {
        ...variantSpecs,
        grade: line.grade ?? variant.grade ?? variantSpecs.grade,
        finish: variant.finish ?? variantSpecs.finish,
        thickness: line.thickness ?? variant.thicknessMm?.toString() ?? variantSpecs.thickness,
        width: variant.widthMm?.toString() ?? variantSpecs.width,
        length: variant.lengthMm?.toString() ?? variantSpecs.length,
        diameter: variant.diameterMm?.toString() ?? variantSpecs.diameter,
        variantDisplayName: variant.displayName ?? undefined,
      };
    } else if (parentProductId) {
      throw new AppError(400, "VALIDATION", "Choose a valid active specification for the selected product.");
    }
    const specs = {
      ...(line.specifications ?? {}),
      ...(line.categoryId ? { categoryId: line.categoryId } : {}),
      ...(line.thickness ? { thickness: line.thickness } : {}),
      ...(line.grade ? { grade: line.grade } : {}),
      ...(line.size ? { size: line.size } : {}),
    };
    await tx.leadItem.create({
      data: {
        id: uuidv7(),
        leadId,
        productId: line.productId ?? null,
        parentProductId: parentProductId ?? null,
        productVariantId: line.productVariantId ?? null,
        itemDescription: line.itemDescription?.trim() || (line.productId ? null : "Requested material"),
        quantity: line.quantity,
        unitId: line.unitId ?? null,
        uom: line.uom ?? "PCS",
        targetPrice: line.targetPrice ?? null,
        priceOffered: line.priceOffered ? new Decimal(line.priceOffered) : null,
        priceFinalised: line.priceFinalised ? new Decimal(line.priceFinalised) : null,
        estimatedWeight: line.estimatedWeight ? new Decimal(line.estimatedWeight) : null,
        specifications: specs as object,
        notes: line.notes ?? null,
      },
    });
  }
}

export async function createLeadManual(
  session: SessionUser,
  input: {
    queryDate?: string;
    queryTime?: string;
    contactPerson?: string;
    contactDesignation?: string;
    address?: string;
    customerName: string;
    email?: string;
    phone: string;
    companyName?: string;
    customerId?: string;
    source: LeadSource;
    priority?: string;
    assigneeId?: string;
    nextFollowUpAt?: string;
    notes?: string;
    requiredDeliveryDate?: string;
    attendedById?: string;
    result?: string;
    resultReason?: string;
    officeRemarks?: string;
    items: LeadItemInput[];
  },
  key: string | null,
) {
  allow(session, "lead.manage");
  const plantId = primaryPlant(session);
  return runCommand({
    userId: session.userId,
    route: "lead.create",
    key,
    run: async (tx) => {
      if (input.customerId) {
        const customer = await tx.customer.findFirst({ where: { id: input.customerId, plantId } });
        if (!customer) throw new AppError(400, "VALIDATION", "Customer not found.");
      }
      if (input.assigneeId) {
        const emp = await tx.employee.findFirst({ where: { id: input.assigneeId, plantId } });
        if (!emp) throw new AppError(400, "VALIDATION", "Assignee not found.");
      }
      if (input.attendedById) {
        const emp = await tx.employee.findFirst({ where: { id: input.attendedById, plantId } });
        if (!emp) throw new AppError(400, "VALIDATION", "Attended by employee not found.");
      }
      if (input.result === "FAILURE" && !input.resultReason?.trim()) {
        throw new AppError(400, "VALIDATION", "Provide a reason for unsuccessful query.");
      }
      const leadNumber = await nextNumber(tx, plantId, "LD");
      const id = uuidv7();
      await tx.lead.create({
        data: {
          id,
          plantId,
          leadNumber,
          customerName: input.contactPerson?.trim() || input.customerName.trim(),
          email: input.email?.trim() || null,
          phone: input.phone.trim(),
          companyName: input.companyName?.trim() || null,
          customerId: input.customerId ?? null,
          source: input.source,
          status: "NEW",
          priority: input.priority ?? "normal",
          assigneeId: input.assigneeId ?? null,
          nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null,
          notes: input.notes ?? null,
          queryDate: input.queryDate ? new Date(input.queryDate) : null,
          queryTime: (() => {
            if (!input.queryTime) return null;
            const parsed = new Date(
              input.queryTime.includes("T") ? input.queryTime : `${input.queryDate ?? ""}T${input.queryTime}`,
            );
            return Number.isNaN(parsed.getTime()) ? null : parsed;
          })(),
          contactPerson: input.contactPerson?.trim() || null,
          contactDesignation: input.contactDesignation?.trim() || null,
          address: input.address?.trim() || null,
          attendedById: input.attendedById ?? null,
          officeRemarks: input.officeRemarks ?? null,
          requiredDeliveryDate: input.requiredDeliveryDate ? new Date(input.requiredDeliveryDate) : null,
          result: input.result ?? "PENDING",
          resultReason: input.resultReason?.trim() || null,
          createdById: session.userId,
        },
      });
      await createLeadItems(tx, id, input.items);
      await recordLeadStatus(tx, id, session.userId, null, "NEW", "Lead created");
      await addLeadActivity(tx, {
        leadId: id,
        userId: session.userId,
        activityType: "created",
        description: `Lead created (${input.source}).`,
        nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null,
      });
      await notifyAssignee(tx, plantId, input.assigneeId ?? null, id, leadNumber);
      await audit(tx, { userId: session.userId, action: "lead.create", resource: "lead", resourceId: id });
      return { id, leadNumber };
    },
  });
}

export async function changeLeadStatus(
  session: SessionUser,
  leadId: string,
  input: { status: LeadStatus; reason?: string },
  key: string | null,
) {
  allow(session, "lead.manage");
  return runCommand({
    userId: session.userId,
    route: "lead.status",
    key,
    run: async (tx) => {
      const lead = await leadForSession(tx, leadId, session);
      if (lead.status === "CONVERTED") throw new AppError(409, "INVALID_STATE", "Converted leads cannot change status.");
      if (input.status === "VERIFIED" || input.status === "CONVERTED") {
        throw new AppError(409, "INVALID_STATE", "Use the dedicated verification or conversion action for this status.");
      }
      if (leadRequiresLostReason(input.status) && !input.reason?.trim()) {
        throw new AppError(400, "VALIDATION", "Provide a reason for lost/rejected leads.");
      }
      if (lead.status === input.status) return { id: leadId, status: input.status };
      try {
        assertLeadTransition(lead.status, input.status);
      } catch {
        throw new AppError(409, "INVALID_TRANSITION", `Cannot move from ${lead.status} to ${input.status}.`);
      }
      const changed = await tx.lead.updateMany({
        where: { id: leadId, status: lead.status, salesOrderId: null },
        data: {
          status: input.status,
          ...(leadRequiresLostReason(input.status) ? { lostReason: input.reason!.trim() } : {}),
        },
      });
      if (changed.count !== 1) {
        throw new AppError(409, "INVALID_STATE", "The lead changed while you were updating it. Refresh and try again.");
      }
      await recordLeadStatus(tx, leadId, session.userId, lead.status, input.status, input.reason);
      await addLeadActivity(tx, {
        leadId,
        userId: session.userId,
        activityType: "status",
        description: `Status → ${input.status}${input.reason ? `: ${input.reason}` : ""}`,
      });
      const updated = await tx.lead.findUnique({
        where: { id: leadId },
        select: { id: true, plantId: true, leadNumber: true, customerName: true, email: true },
      });
      return { id: leadId, status: input.status, emailLead: updated };
    },
  }).then(async (result) => {
    if (result.emailLead?.email) {
      await notifyLeadStatusEmail(result.emailLead, result.status as LeadStatus);
    }
    return { id: result.id, status: result.status };
  });
}

export async function assignLead(
  session: SessionUser,
  leadId: string,
  input: { assigneeId: string | null },
  key: string | null,
) {
  allow(session, "lead.manage");
  return runCommand({
    userId: session.userId,
    route: "lead.assign",
    key,
    run: async (tx) => {
      const lead = await leadForSession(tx, leadId, session);
      const plantId = lead.plantId;
      if (lead.status === "CONVERTED") throw new AppError(409, "INVALID_STATE", "Lead already converted.");
      if (input.assigneeId) {
        const emp = await tx.employee.findFirst({ where: { id: input.assigneeId, plantId } });
        if (!emp) throw new AppError(400, "VALIDATION", "Employee not found.");
      }
      await tx.lead.update({ where: { id: leadId }, data: { assigneeId: input.assigneeId } });
      await addLeadActivity(tx, {
        leadId,
        userId: session.userId,
        activityType: "assignment",
        description: input.assigneeId ? "Lead reassigned." : "Lead unassigned.",
      });
      await notifyAssignee(tx, plantId, input.assigneeId, leadId, lead.leadNumber);
      return { id: leadId };
    },
  });
}

export async function verifyLead(
  session: SessionUser,
  leadId: string,
  input: {
    checks: {
      customerConfirmed: true;
      itemsConfirmed: true;
      quantityConfirmed: true;
      genuineRequirementConfirmed: true;
    };
    verificationNotes?: string;
  },
  key: string | null,
) {
  allow(session, "lead.verify");
  return runCommand({
    userId: session.userId,
    route: "lead.verify",
    key,
    run: async (tx) => {
      const lead = await leadForSession(tx, leadId, session);
      if (!leadCanVerify(lead.status)) {
        throw new AppError(409, "INVALID_STATE", "Lead is not ready for verification.");
      }
      const metadata = await tx.lead.updateMany({
        where: { id: leadId, status: lead.status, salesOrderId: null },
        data: {
          status: "VERIFIED",
          verificationNotes: input.verificationNotes?.trim() || null,
          verifiedById: session.userId,
          verifiedAt: new Date(),
        },
      });
      if (metadata.count !== 1) {
        throw new AppError(409, "INVALID_STATE", "The lead changed while you were verifying it. Refresh and try again.");
      }
      await recordLeadStatus(tx, leadId, session.userId, lead.status, "VERIFIED", "Verification checks completed");
      await addLeadActivity(tx, {
        leadId,
        userId: session.userId,
        activityType: "verification",
        description: input.verificationNotes?.trim() || "Customer, requested items, quantity, and requirement confirmed.",
      });
      const updated = await tx.lead.findUnique({
        where: { id: leadId },
        select: { id: true, plantId: true, leadNumber: true, customerName: true, email: true },
      });
      return { id: leadId, status: "VERIFIED" as const, emailLead: updated };
    },
  }).then(async (result) => {
    if (result.emailLead?.email) {
      await notifyLeadStatusEmail(result.emailLead, result.status);
    }
    return { id: result.id, status: result.status };
  });
}

export async function convertLeadToSalesOrder(
  session: SessionUser,
  leadId: string,
  input: {
    lines: {
      leadItemId: string;
      productId?: string;
      unitPrice?: string;
    }[];
  },
  key: string | null,
) {
  allow(session, "lead.convert");
  return runCommand({
    userId: session.userId,
    route: "lead.convert",
    key,
    run: async (tx) => {
      const plantIds = await plantIdsForSession(session);
      const lead = await tx.lead.findFirst({
        where: { id: leadId, plantId: { in: plantIds }, deletedAt: null },
        include: { items: { include: { product: true } }, customer: true, salesOrder: true },
      });
      if (!lead) throw new AppError(404, "NOT_FOUND", "Lead not found.");
      const plantId = lead.plantId;
      if (lead.salesOrderId && lead.salesOrder) {
        return {
          leadId,
          salesOrderId: lead.salesOrder.id,
          number: lead.salesOrder.number,
          plantId,
          leadNumber: lead.leadNumber,
          customerName: lead.customerName,
          email: null,
        };
      }
      if (!leadCanConvert(lead.status)) {
        throw new AppError(409, "INVALID_STATE", "Lead must be verified before conversion.");
      }
      if (!lead.items.length) throw new AppError(400, "VALIDATION", "This lead has no requested items to convert.");
      if (input.lines.length !== lead.items.length || new Set(input.lines.map((line) => line.leadItemId)).size !== lead.items.length) {
        throw new AppError(400, "VALIDATION", "Review every requested lead item before creating the sales order.");
      }

      const orderLines = await Promise.all(lead.items.map(async (item) => {
        const selection = input.lines.find((line) => line.leadItemId === item.id);
        const productId = selection?.productId ?? item.productId;
        if (!productId) throw new AppError(400, "VALIDATION", `Select a sales product for ${item.itemDescription || "each requested item"}.`);
        const product = await tx.materialMaster.findFirst({ where: { id: productId, plantId, active: true, salesAllowed: true } });
        if (!product) throw new AppError(400, "VALIDATION", "Select an active sales product for every requested item.");
        const specifications = item.specifications && typeof item.specifications === "object" && !Array.isArray(item.specifications)
          ? item.specifications as Record<string, unknown>
          : {};
        return {
          productId: product.id,
          qtyOrdered: item.quantity.toString(),
          unitPrice: selection?.unitPrice?.trim() || item.targetPrice?.toString() || product.sellingPrice?.toString() || "0",
          taxPct: product.taxRate?.toString() || "0",
          uom: item.uom || product.salesUom || product.uom,
          specs: {
            ...specifications,
            ...(item.itemDescription ? { leadItemDescription: item.itemDescription } : {}),
            ...(item.estimatedWeight ? { estimatedWeight: item.estimatedWeight.toString() } : {}),
            ...(item.notes ? { leadItemNotes: item.notes } : {}),
            leadItemId: item.id,
            leadId: lead.id,
            leadNumber: lead.leadNumber,
            parentProductId: item.parentProductId,
            productVariantId: item.productVariantId,
          },
        };
      }));

      const orderId = uuidv7();
      const claimed = await tx.lead.updateMany({
        where: { id: leadId, plantId, status: lead.status, salesOrderId: null, deletedAt: null },
        data: { convertedAt: new Date(), convertedById: session.userId, status: "CONVERTED" },
      });
      if (claimed.count !== 1) {
        const existing = await tx.lead.findUnique({ where: { id: leadId }, include: { salesOrder: true } });
        if (existing?.salesOrder) {
          return {
            leadId,
            salesOrderId: existing.salesOrder.id,
            number: existing.salesOrder.number,
            plantId,
            leadNumber: lead.leadNumber,
            customerName: lead.customerName,
            email: null,
          };
        }
        throw new AppError(409, "INVALID_STATE", "The lead changed while the order was being created. Refresh and try again.");
      }

      let customerId = lead.customerId;
      if (!customerId) {
        const customer = await tx.customer.findFirst({
          where: { plantId, OR: [
            { phone: { equals: lead.phone, mode: "insensitive" } },
            { name: { equals: lead.companyName || lead.customerName, mode: "insensitive" } },
          ] },
        });
        const resolved = customer ?? await createCustomerInTx(tx, plantId, { name: lead.companyName || lead.customerName, phone: lead.phone }, session.userId);
        customerId = resolved.id;
        await tx.lead.update({ where: { id: leadId }, data: { customerId } });
      }

      const number = await nextNumber(tx, plantId, "SO");
      await tx.salesOrder.create({
        data: {
          id: orderId,
          plantId,
          customerId,
          number,
          status: "draft",
          priority: lead.priority,
          promisedDate: lead.requiredDeliveryDate,
          notes: [lead.notes, lead.officeRemarks].filter(Boolean).join("\n\n") || null,
          items: {
            create: orderLines.map((line) => ({
              id: uuidv7(),
              productId: line.productId,
              qtyOrdered: line.qtyOrdered,
              unitPrice: line.unitPrice,
              taxPct: line.taxPct,
              discountPct: "0",
              uom: line.uom,
              specs: line.specs as object,
            })),
          },
        },
      });
      await tx.lead.update({ where: { id: leadId }, data: { salesOrderId: orderId, customerId } });
      await tx.salesOrderStatusEvent.create({
        data: {
          id: uuidv7(),
          orderId,
          fromStatus: null,
          toStatus: "draft",
          remarks: `Created from lead ${lead.leadNumber}`,
          userId: session.userId,
        },
      });

      await recordLeadStatus(tx, leadId, session.userId, lead.status, "CONVERTED", `Sales order ${number}`);
      await addLeadActivity(tx, {
        leadId,
        userId: session.userId,
        activityType: "conversion",
        description: `Converted to sales order ${number}.`,
      });

      await audit(tx, {
        userId: session.userId,
        action: "lead.convert",
        resource: "lead",
        resourceId: leadId,
        payload: { salesOrderId: orderId, number },
      });
      return {
        leadId,
        salesOrderId: orderId,
        number,
        plantId,
        leadNumber: lead.leadNumber,
        customerName: lead.customerName,
        email: lead.email,
      };
    },
  }).then(async (result) => {
    const toEmail = result.email?.trim();
    if (toEmail) {
      await notifyLeadByEmail({
        plantId: result.plantId,
        leadId: result.leadId,
        toEmail,
        subject: leadEmailSubject(result.leadNumber, "converted to order"),
        message: `Dear ${result.customerName},\n\nThank you — your enquiry ${result.leadNumber} is now sales order ${result.number}. We will confirm shortly.\n\nRegards,\nSS Metals`,
      });
    }
    return { leadId: result.leadId, salesOrderId: result.salesOrderId, number: result.number };
  });
}

export async function addLeadActivityManual(
  session: SessionUser,
  leadId: string,
  input: { activityType: string; description: string; nextFollowUpAt?: string },
  key: string | null,
) {
  allow(session, "lead.manage");
  return runCommand({
    userId: session.userId,
    route: "lead.activity",
    key,
    run: async (tx) => {
      await leadForSession(tx, leadId, session);
      await addLeadActivity(tx, {
        leadId,
        userId: session.userId,
        activityType: input.activityType,
        description: input.description.trim(),
        nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null,
      });
      return { id: leadId };
    },
  });
}
