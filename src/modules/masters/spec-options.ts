import { prisma } from "@/db";
import type { SessionUser } from "@/lib/auth/session";
import { plantIdsForSession, primaryPlant } from "@/lib/access";
import { AppError } from "@/lib/errors";
import { uuidv7 } from "@/lib/ids";
import { audit } from "@/lib/inventory/post";
import { allow } from "@/modules/shared/allow";
import { PVD_COLOUR_OPTIONS } from "@/lib/domain/material-specifications";

export const NUMERIC_SPEC_FIELDS = new Set([
  "thickness",
  "width",
  "length",
  "diameter",
  "size",
  "height",
  "capacityLitres",
  "innerDiameter",
  "outerDiameter",
  "wireGauge",
  "wireDiameterMm",
  "cutLengthMm",
  "innerDiameterMm",
  "outerDiameterMm",
  "weightPerPiece",
  "netWeightKg",
  "breadth",
]);

export function isNumericSpecField(fieldName: string): boolean {
  return NUMERIC_SPEC_FIELDS.has(fieldName);
}

export function normalizeSpecValue(value: string, fieldName?: string): string {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (fieldName && isNumericSpecField(fieldName)) {
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num)) {
      return String(num);
    }
  }
  return trimmed;
}

export type SpecOptionItem = {
  id: string;
  plantId: string;
  fieldName: string;
  value: string;
  normalizedValue: string;
  unit: string | null;
  description: string | null;
  categoryId: string | null;
  productId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

// Fallback seed options when table is empty or bootstrapping
const DEFAULT_SPEC_OPTIONS: Record<string, string[]> = {
  pvdColour: [...PVD_COLOUR_OPTIONS],
  thickness: ["0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "1.0", "1.2", "1.5", "2.0", "2.5", "3.0", "4.0", "5.0", "6.0"],
  diameter: ["50", "80", "100", "125", "150", "175", "200", "225", "250", "300", "350", "400", "450", "500", "600"],
  width: ["1000", "1219", "1250", "1500"],
  length: ["2000", "2438", "2500", "3000", "6000"],
};

function getDelegate() {
  return (prisma as unknown as { specOptionMaster?: {
    findMany: (args: unknown) => Promise<SpecOptionItem[]>;
    findFirst: (args: unknown) => Promise<SpecOptionItem | null>;
    create: (args: unknown) => Promise<SpecOptionItem>;
    update: (args: unknown) => Promise<SpecOptionItem>;
  } }).specOptionMaster;
}

/**
 * List active spec options matching field, plant, and optional category/product scope.
 * Always includes global options (categoryId = null, productId = null) plus scoped ones.
 */
export async function listSpecOptions(options: {
  plantIds?: string[];
  fieldName: string;
  categoryId?: string;
  productId?: string;
  activeOnly?: boolean;
  q?: string;
}): Promise<SpecOptionItem[]> {
  const { plantIds, fieldName, categoryId, productId, activeOnly = true, q } = options;
  const query = q?.trim().toLowerCase();
  const delegate = getDelegate();

  let dbItems: SpecOptionItem[] = [];
  if (delegate) {
    try {
      dbItems = await delegate.findMany({
        where: {
          fieldName,
          ...(plantIds?.length ? { plantId: { in: plantIds } } : {}),
          ...(activeOnly ? { isActive: true } : {}),
          OR: [
            { categoryId: null, productId: null },
            ...(categoryId ? [{ categoryId }] : []),
            ...(productId ? [{ productId }] : []),
          ],
          ...(query
            ? {
                OR: [
                  { value: { contains: query, mode: "insensitive" } },
                  { normalizedValue: { contains: query, mode: "insensitive" } },
                  { description: { contains: query, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ value: "asc" }, { createdAt: "desc" }],
      });
    } catch {
      // Table may not yet be migrated
      dbItems = [];
    }
  }

  // Deduplicate by normalized value
  const seenNorm = new Set<string>();
  const results: SpecOptionItem[] = [];

  for (const item of dbItems) {
    if (!seenNorm.has(item.normalizedValue)) {
      seenNorm.add(item.normalizedValue);
      results.push(item);
    }
  }

  // Include default fallback constants if nothing in DB yet for this field
  const defaults = DEFAULT_SPEC_OPTIONS[fieldName] ?? [];
  for (const defVal of defaults) {
    const norm = normalizeSpecValue(defVal, fieldName);
    if (!seenNorm.has(norm)) {
      if (!query || norm.includes(query) || defVal.toLowerCase().includes(query)) {
        seenNorm.add(norm);
        results.push({
          id: `default-${fieldName}-${norm}`,
          plantId: plantIds?.[0] ?? "00000000-0000-0000-0000-000000000000",
          fieldName,
          value: defVal,
          normalizedValue: norm,
          unit: isNumericSpecField(fieldName) ? "mm" : null,
          description: null,
          categoryId: null,
          productId: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  return results;
}

/**
 * List all spec options for management table (supports filtering by fieldName).
 */
export async function listAllSpecOptions(options?: {
  plantIds?: string[];
  fieldName?: string;
  activeOnly?: boolean;
  q?: string;
}): Promise<SpecOptionItem[]> {
  const { plantIds, fieldName, activeOnly = false, q } = options ?? {};
  const query = q?.trim().toLowerCase();
  const delegate = getDelegate();

  if (!delegate) return [];

  try {
    const items = await delegate.findMany({
      where: {
        ...(fieldName ? { fieldName } : {}),
        ...(plantIds?.length ? { plantId: { in: plantIds } } : {}),
        ...(activeOnly ? { isActive: true } : {}),
        ...(query
          ? {
              OR: [
                { value: { contains: query, mode: "insensitive" } },
                { fieldName: { contains: query, mode: "insensitive" } },
                { normalizedValue: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ fieldName: "asc" }, { value: "asc" }, { createdAt: "desc" }],
    });
    return items;
  } catch {
    return [];
  }
}

/**
 * Create or reuse a SpecOptionMaster record with duplicate checking and validation.
 */
export async function createOrReuseSpecOption(
  session: SessionUser,
  input: {
    plantId?: string;
    fieldName: string;
    value: string;
    unit?: string;
    description?: string;
    categoryId?: string;
    productId?: string;
  },
) {
  allow(session, "plant.manage");

  const rawValue = input.value?.trim();
  const rawField = input.fieldName?.trim();

  if (!rawField || rawField.length < 1 || rawField.length > 60) {
    throw new AppError(400, "VALIDATION", "Field name is required (1-60 characters).");
  }

  if (!rawValue || rawValue.length < 1 || rawValue.length > 80) {
    throw new AppError(400, "VALIDATION", "Value is required (1-80 characters).");
  }

  // Numeric validation
  if (isNumericSpecField(rawField)) {
    const num = Number(rawValue);
    if (isNaN(num) || num <= 0 || !/^\d+(\.\d{1,3})?$/.test(rawValue)) {
      throw new AppError(400, "VALIDATION", `${rawField} must be a positive number with up to three decimal places.`);
    }
  }

  const plantId = input.plantId || primaryPlant(session);
  const normalized = normalizeSpecValue(rawValue, rawField);
  const delegate = getDelegate();

  if (!delegate) {
    // Return mock if table not yet available
    return {
      option: {
        id: uuidv7(),
        plantId,
        fieldName: rawField,
        value: rawValue,
        normalizedValue: normalized,
        unit: input.unit?.trim() || null,
        description: input.description?.trim() || null,
        categoryId: input.categoryId || null,
        productId: input.productId || null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      reused: false,
    };
  }

  // 1. Check for duplicate option in same plant, field, and scope (or global)
  const existing = await delegate.findFirst({
    where: {
      plantId,
      fieldName: rawField,
      normalizedValue: normalized,
      OR: [
        { categoryId: null, productId: null },
        ...(input.categoryId ? [{ categoryId: input.categoryId }] : []),
        ...(input.productId ? [{ productId: input.productId }] : []),
      ],
    },
  });

  if (existing) {
    if (!existing.isActive) {
      // Re-activate if currently inactive
      const reactivated = await delegate.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      return { option: reactivated, reused: true };
    }
    return { option: existing, reused: true };
  }

  // 2. Create new spec option
  const created = await delegate.create({
    data: {
      id: uuidv7(),
      plantId,
      fieldName: rawField,
      value: rawValue,
      normalizedValue: normalized,
      unit: input.unit?.trim() || (isNumericSpecField(rawField) ? "mm" : null),
      description: input.description?.trim() || null,
      categoryId: input.categoryId || null,
      productId: input.productId || null,
      isActive: true,
      createdById: session.userId,
    },
  });

  try {
    await audit(prisma, {
      userId: session.userId,
      action: "spec_option.create",
      resource: "spec_option_master",
      resourceId: created.id,
      payload: { fieldName: rawField, value: rawValue, normalizedValue: normalized },
    });
  } catch {
    // Audit table logging optional
  }

  return { option: created, reused: false };
}

/**
 * Update a SpecOptionMaster record (e.g. toggle active/inactive).
 */
export async function updateSpecOption(
  session: SessionUser,
  id: string,
  input: {
    value?: string;
    unit?: string | null;
    description?: string | null;
    isActive?: boolean;
  },
) {
  allow(session, "plant.manage");
  const plantIds = await plantIdsForSession(session);
  const delegate = getDelegate();

  if (!delegate) {
    throw new AppError(404, "NOT_FOUND", "Spec options table not available.");
  }

  const existing = await delegate.findFirst({
    where: { id, plantId: { in: plantIds } },
  });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Spec option record not found.");

  const data: Record<string, unknown> = {};

  if (input.value !== undefined) {
    const rawVal = input.value.trim();
    if (!rawVal || rawVal.length > 80) throw new AppError(400, "VALIDATION", "Valid value is required.");
    data.value = rawVal;
    data.normalizedValue = normalizeSpecValue(rawVal, existing.fieldName);
  }

  if (input.unit !== undefined) {
    data.unit = input.unit?.trim() || null;
  }

  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  const updated = await delegate.update({
    where: { id },
    data,
  });

  return updated;
}
