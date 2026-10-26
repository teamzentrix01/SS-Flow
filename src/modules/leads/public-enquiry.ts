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

type Db = Prisma.TransactionClient;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function resolvePublicLeadPlant() {
  const code = process.env.PUBLIC_LEAD_PLANT_CODE?.trim() || "PLANT-01";
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
  customerName: string;
  phone: string;
  email?: string;
  companyName?: string;
  address?: string;
  requiredDeliveryDate?: string;
  commercialRemarks?: string;
  honeypot?: string;
  items: LeadItemInput[];
  idempotencyKey?: string;
  clientIp?: string;
}) {
  if (input.honeypot?.trim()) {
    return { ok: true as const, reference: "received" };
  }

  const plant = await resolvePublicLeadPlant();
  const ipHash = hash(input.clientIp ?? "unknown");
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000);
  const recentIp = await prisma.leadPublicSubmission.count({
    where: { plantId: plant.id, ipHash, createdAt: { gte: sinceHour } },
  });
  if (recentIp >= MAX_PER_HOUR) {
    throw new AppError(429, "RATE_LIMIT", "Too many enquiries. Please try again later.");
  }

  const fingerprint = input.idempotencyKey?.trim() || uuidv7();
  const existing = await prisma.leadPublicSubmission.findUnique({ where: { fingerprint } });
  if (existing) {
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
        address: input.address?.trim().slice(0, 500) || null,
        requiredDeliveryDate: input.requiredDeliveryDate ? new Date(`${input.requiredDeliveryDate}T12:00:00.000Z`) : null,
        notes: input.commercialRemarks?.trim().slice(0, 1000) || null,
        source: "WEBSITE",
        status: "NEW",
        priority: "normal",
      },
    });
    for (const line of input.items.length ? input.items : [{ quantity: "1", itemDescription: "General enquiry" }]) {
      if (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0) {
        throw new AppError(400, "VALIDATION", "Each item quantity must be greater than zero.");
      }
      const { publicCategoryIsEligible, PUBLIC_PRODUCT_SPEC_KEYS } = await import("@/modules/leads/public-catalog");
      const plantCategories = await tx.productCategory.findMany({
        where: { plantId: plant.id },
        select: { id: true, parentId: true, code: true },
      });
      const categoryMatches = (selectedCatId?: string | null, targetCatId?: string | null) => {
        if (!selectedCatId || !targetCatId) return true;
        if (selectedCatId === targetCatId) return true;
        let current = plantCategories.find((c) => c.id === targetCatId);
        const seen = new Set<string>();
        while (current && !seen.has(current.id)) {
          seen.add(current.id);
          if (current.id === selectedCatId) return true;
          current = current.parentId ? plantCategories.find((c) => c.id === current?.parentId) : undefined;
        }
        return false;
      };
      if (line.productId) {
        const catalogProduct = await tx.product.findFirst({
          where: { id: line.productId, plantId: plant.id, isActive: true },
          select: {
            id: true, name: true, sku: true, categoryId: true, productType: true, baseUnit: { select: { id: true, symbol: true, isActive: true } },
            category: { select: { id: true, name: true, requiredSpecs: true, categoryType: true, productForm: true, status: true } },
            variants: {
              where: { isActive: true },
              select: {
                id: true, sku: true, displayName: true, isActive: true, grade: true, thicknessMm: true, widthMm: true, lengthMm: true, diameterMm: true, finish: true, attributes: true,
                unit: { select: { id: true, symbol: true, isActive: true } },
                materialMasterId: true,
              },
            },
          },
        });
        const legacyMaterial = catalogProduct ? null : await tx.materialMaster.findFirst({
          where: { id: line.productId, plantId: plant.id, active: true, salesAllowed: true },
          select: {
            id: true, code: true, name: true, categoryId: true, productType: true, grade: true, thickness: true, width: true, length: true, diameter: true, weightPerPiece: true,
            specs: true, uom: true, salesUom: true,
            productCategory: { select: { id: true, name: true, requiredSpecs: true, categoryType: true, productForm: true, status: true } },
            productVariant: { select: { id: true, sku: true, displayName: true, materialMasterId: true, isActive: true, grade: true, thicknessMm: true, widthMm: true, lengthMm: true, diameterMm: true, finish: true, attributes: true, unit: { select: { id: true, symbol: true, isActive: true } } } },
          },
        });
        const selectedVariant = catalogProduct
          ? catalogProduct.variants.find((variant) => variant.id === line.productVariantId) ?? null
          : legacyMaterial?.productVariant?.isActive ? legacyMaterial.productVariant : null;
        if (catalogProduct && !line.productVariantId) {
          throw new AppError(400, "VALIDATION", "Choose a saved product specification before submitting the enquiry.");
        }
        if (catalogProduct && ((line.parentProductId && line.parentProductId !== catalogProduct.id) || (line.categoryId && !categoryMatches(line.categoryId, catalogProduct.categoryId)))) {
          throw new AppError(400, "VALIDATION", "The selected specification does not belong to this business category and product.");
        }
        const catalogMaterial = catalogProduct && selectedVariant?.materialMasterId
          ? await tx.materialMaster.findFirst({
              where: { id: selectedVariant.materialMasterId, plantId: plant.id, active: true, salesAllowed: true },
              select: { id: true, grade: true, thickness: true, width: true, length: true, diameter: true, weightPerPiece: true, specs: true, uom: true, salesUom: true },
            })
          : null;
        if (catalogProduct && selectedVariant?.materialMasterId && !catalogMaterial) {
          throw new AppError(400, "VALIDATION", "The selected product specification is no longer active.");
        }
        const selectedMaterial = catalogProduct
          ? catalogMaterial
          : legacyMaterial;
        const material = catalogProduct
          ? {
              id: selectedMaterial?.id ?? null,
              categoryId: catalogProduct.categoryId,
              productType: catalogProduct.productType,
              grade: selectedMaterial?.grade ?? selectedVariant?.grade ?? null,
              thickness: selectedMaterial?.thickness ?? selectedVariant?.thicknessMm ?? null,
              width: selectedMaterial?.width ?? selectedVariant?.widthMm ?? null,
              length: selectedMaterial?.length ?? selectedVariant?.lengthMm ?? null,
              diameter: selectedMaterial?.diameter ?? selectedVariant?.diameterMm ?? null,
              weightPerPiece: selectedMaterial?.weightPerPiece ?? null,
              specs: selectedMaterial?.specs ?? selectedVariant?.attributes,
              uom: selectedMaterial?.uom ?? catalogProduct.baseUnit?.symbol ?? "",
              salesUom: selectedMaterial?.salesUom ?? null,
              productCategory: catalogProduct.category,
              productVariant: selectedVariant,
            }
          : legacyMaterial;
        if (!material || !material.categoryId || !material.productCategory || material.productCategory.status.toLowerCase() !== "active" || !await publicCategoryIsEligible(tx, plant.id, material.categoryId)) {
          throw new AppError(400, "VALIDATION", "A selected product is no longer available. Please choose another product.");
        }
        if (line.categoryId && !categoryMatches(line.categoryId, material.categoryId)) {
          throw new AppError(400, "VALIDATION", "The selected product does not belong to that category.");
        }
        const variant = material.productVariant?.isActive ? material.productVariant : null;
        if (line.productVariantId && (!variant || variant.id !== line.productVariantId || !variant.isActive)) {
          throw new AppError(400, "VALIDATION", "The selected product option is no longer available.");
        }
        const supportedUom = material.salesUom?.trim() || (variant?.unit?.isActive ? variant.unit.symbol : "") || material.uom;
        if (line.uom && line.uom.trim().toLowerCase() !== supportedUom.trim().toLowerCase()) {
          throw new AppError(400, "VALIDATION", "The selected unit is not supported for this product.");
        }
        const configuredUnit = await tx.unitOfMeasure.findFirst({
          where: { plantId: plant.id, symbol: supportedUom, isActive: true },
          select: { id: true },
        });
        const rawSpecs = material.specs && typeof material.specs === "object" && !Array.isArray(material.specs) ? material.specs as Record<string, unknown> : {};
        const configured: Record<string, string> = {
          grade: material.grade ?? variant?.grade ?? "",
          thickness: material.thickness?.toString() ?? variant?.thicknessMm?.toString() ?? "",
          width: material.width?.toString() ?? variant?.widthMm?.toString() ?? "",
          length: material.length?.toString() ?? variant?.lengthMm?.toString() ?? "",
          diameter: material.diameter?.toString() ?? variant?.diameterMm?.toString() ?? "",
          weightPerPiece: material.weightPerPiece?.toString() ?? "",
          finish: variant?.finish ?? "",
        };
        for (const key of ["grade", "thickness", "width", "length", "diameter", "weightPerPiece", "finish"]) {
          const value = rawSpecs[key];
          if (typeof value === "string" || typeof value === "number") configured[key] ||= String(value);
        }
        for (const key of PUBLIC_PRODUCT_SPEC_KEYS) {
          const value = rawSpecs[key];
          if (typeof value === "string" || typeof value === "number") configured[key] ||= String(value);
        }
        const configuredKeys = Object.entries(configured).filter(([, value]) => Boolean(value)).map(([key]) => key);
        const allowedSpecs = new Set([...material.productCategory.requiredSpecs, ...configuredKeys]);
        for (const key of Object.keys(line.specifications ?? {})) {
          if (!allowedSpecs.has(key)) throw new AppError(400, "VALIDATION", `Specification '${key}' is not available for this product.`);
        }
        const productName = catalogProduct ? catalogProduct.name : (legacyMaterial?.name ?? "");
        const productSku = selectedVariant?.sku ?? catalogProduct?.sku ?? legacyMaterial?.code ?? "";
        const safeSpecifications: Record<string, string> = {
          categoryId: material.categoryId,
          categoryName: material.productCategory.name,
          productId: line.productId,
          productName,
          productSku,
          ...(selectedVariant?.displayName ? { variantDisplayName: selectedVariant.displayName } : {}),
        };
        if (line.productVariantId || selectedVariant?.id) {
          safeSpecifications.productVariantId = line.productVariantId ?? selectedVariant?.id ?? "";
        }
        for (const key of configuredKeys) {
          const submittedValue = line.specifications?.[key];
          if (typeof submittedValue === "string" && submittedValue.trim() && submittedValue.trim().toLowerCase() !== configured[key].toLowerCase()) {
            throw new AppError(400, "VALIDATION", `The selected ${key} does not match this product.`);
          }
          safeSpecifications[key] = configured[key];
        }
        for (const key of material.productCategory.requiredSpecs) {
          const submittedValue = line.specifications?.[key];
          const value = configured[key] || (typeof submittedValue === "string" ? submittedValue.trim() : "");
          if (!value) throw new AppError(400, "VALIDATION", `Please enter the required ${key} for each selected item.`);
          if (configured[key] && typeof submittedValue === "string" && submittedValue.trim() && configured[key].toLowerCase() !== submittedValue.trim().toLowerCase()) {
            throw new AppError(400, "VALIDATION", `The selected ${key} does not match this product.`);
          }
          if (key !== "grade" && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
            throw new AppError(400, "VALIDATION", `${key} must be a positive number.`);
          }
          safeSpecifications[key] = value;
        }
        if (typeof line.specifications?.finish === "string" && configured.finish && line.specifications.finish.toLowerCase() !== configured.finish.toLowerCase()) {
          throw new AppError(400, "VALIDATION", "The selected finish does not match this product.");
        }
        if (configured.finish) safeSpecifications.finish = configured.finish;
        const userDesc = line.itemDescription?.trim() || "";
        const itemDescription = userDesc
          ? `${productName} — ${userDesc}`.slice(0, 500)
          : (productName || null);
        await tx.leadItem.create({
          data: {
            id: uuidv7(),
            leadId: id,
            productId: material.id,
            parentProductId: catalogProduct?.id ?? null,
            productVariantId: line.productVariantId ?? variant?.id ?? null,
            itemDescription,
            quantity: line.quantity,
            unitId: configuredUnit?.id ?? null,
            uom: supportedUom,
            specifications: safeSpecifications,
            notes: line.notes?.trim().slice(0, 500) || null,
          },
        });
        continue;
      }
      if (line.productVariantId) throw new AppError(400, "VALIDATION", "Choose a product before selecting its option.");
      if (line.categoryId && !await publicCategoryIsEligible(tx, plant.id, line.categoryId)) {
        throw new AppError(400, "VALIDATION", "The selected category is no longer available.");
      }
      const legacySpecs = Object.fromEntries(Object.entries(line.specifications ?? {}).slice(0, 20).flatMap(([key, value]) => {
        if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || !(typeof value === "string" || typeof value === "number" || typeof value === "boolean")) return [];
        return [[key, String(value).slice(0, 120)]];
      }));
      if (!line.itemDescription?.trim() && !Object.keys(legacySpecs).length) {
        throw new AppError(400, "VALIDATION", "Add a product or describe the material you need.");
      }
      const manualUnit = line.uom?.trim()
        ? await tx.unitOfMeasure.findFirst({ where: { plantId: plant.id, symbol: line.uom.trim(), isActive: true }, select: { id: true, symbol: true } })
        : null;
      if (line.uom?.trim() && !manualUnit) throw new AppError(400, "VALIDATION", "The selected unit is not available for enquiries.");
      await tx.leadItem.create({
        data: {
          id: uuidv7(),
          leadId: id,
          itemDescription: line.itemDescription?.slice(0, 500) ?? null,
          quantity: line.quantity,
          unitId: manualUnit?.id ?? null,
          uom: manualUnit?.symbol ?? line.uom ?? "PCS",
          specifications: { ...legacySpecs, ...(line.categoryId ? { categoryId: line.categoryId } : {}) } as object,
          notes: line.notes?.trim().slice(0, 500) || null,
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
