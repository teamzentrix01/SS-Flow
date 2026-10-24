import { prisma } from "@/db";
import { AppError } from "@/lib/errors";
import {
  MANUFACTURED_SPEC_FIELDS,
  MATERIAL_SPEC_FIELDS,
  TRADING_SPEC_FIELDS,
} from "@/lib/domain/material-specifications";
import { resolvePublicLeadPlant } from "@/modules/leads/public-enquiry";

const PUBLIC_CATEGORY_TYPES = new Set(["raw_material", "wip", "finished_goods"]);
const SPEC_LABELS = new Map<string, { label: string; unit: string }>(
  MATERIAL_SPEC_FIELDS.map(({ key, label, unit }) => [key, { label, unit }]),
);
export const PUBLIC_PRODUCT_SPEC_KEYS = new Set([
  "materialFamily", "finish", "quantityPackDetails", "coilReference", "netWeightKg", "innerDiameter",
  "outerDiameter", "pvdColour", "wireGauge", "bundleReference", "shapeDesign", "height", "capacityLitres",
]);
const ALL_PRODUCT_SPEC_FIELDS = [...Object.values(TRADING_SPEC_FIELDS), ...Object.values(MANUFACTURED_SPEC_FIELDS)].flat();
const EXTRA_SPEC_LABELS = new Map(ALL_PRODUCT_SPEC_FIELDS.map(({ key, label, unit }) => [key, { label, unit: unit ?? "" }]));
const NUMERIC_SPEC_KEYS = new Set([
  "thickness", "width", "length", "diameter", "weightPerPiece", "netWeightKg", "innerDiameter", "outerDiameter", "wireGauge", "height", "capacityLitres",
]);

export function eligiblePublicCategoryIds(
  rows: { id: string; code: string; parentId: string | null; status: string; categoryType: string }[],
) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const eligible = new Set<string>();
  for (const row of rows) {
    if (row.status.toLowerCase() !== "active" || !PUBLIC_CATEGORY_TYPES.has(row.categoryType)) continue;
    let current: typeof row | undefined = row;
    let rootKind: "TRADING" | "MFG" | null = null;
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.status.toLowerCase() !== "active") break;
      const code = current.code.trim().toUpperCase();
      if (code === "TRADING" || code === "MFG") {
        rootKind = code;
        break;
      }
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    if (rootKind && row.code.trim().toUpperCase() !== rootKind) eligible.add(row.id);
  }
  return eligible;
}

async function publicPlant() {
  const plant = await resolvePublicLeadPlant();
  const categories = await prisma.productCategory.findMany({
    where: { plantId: plant.id },
    select: { id: true, code: true, name: true, parentId: true, categoryType: true, productForm: true, requiredSpecs: true, status: true },
    orderBy: [{ name: "asc" }, { code: "asc" }],
  });
  const eligibleIds = eligiblePublicCategoryIds(categories);
  return { plant, categories, eligibleIds };
}

export async function publicCategoryIsEligible(db: typeof prisma | import("@prisma/client").Prisma.TransactionClient, plantId: string, categoryId: string) {
  const rows = await db.productCategory.findMany({
    where: { plantId },
    select: { id: true, code: true, parentId: true, status: true, categoryType: true },
  });
  return eligiblePublicCategoryIds(rows).has(categoryId);
}

export async function getPublicEnquiryCategories() {
  const { plant, categories, eligibleIds } = await publicPlant();
  if (!eligibleIds.size) return [];
  const grouped = await prisma.materialMaster.groupBy({
    by: ["categoryId"],
    where: { plantId: plant.id, categoryId: { in: [...eligibleIds] }, active: true, salesAllowed: true, isDemo: false },
    _count: { _all: true },
  });
  const productCounts = new Map(grouped.map((row) => [row.categoryId, row._count._all]));
  return categories
    .filter((category) => eligibleIds.has(category.id) && (productCounts.get(category.id) ?? 0) > 0)
    .map((category) => ({
      id: category.id,
      name: category.name,
      code: category.code,
      productForm: category.productForm,
      requiredSpecs: category.requiredSpecs.filter((key) => SPEC_LABELS.has(key)),
    }));
}

export async function getPublicEnquiryProducts(categoryId: string, query: string, page: number) {
  const { plant, categories, eligibleIds } = await publicPlant();
  if (!eligibleIds.has(categoryId)) throw new AppError(404, "NOT_FOUND", "Product category is not available.");
  const category = categories.find((row) => row.id === categoryId)!;
  const where = {
    plantId: plant.id,
    categoryId,
    active: true,
    salesAllowed: true,
    isDemo: false,
    ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { code: { contains: query, mode: "insensitive" as const } }, { grade: { contains: query, mode: "insensitive" as const } }] } : {}),
  };
  const rows = await prisma.materialMaster.findMany({
    where,
    select: {
      id: true, code: true, name: true, grade: true, thickness: true, width: true, length: true, diameter: true, weightPerPiece: true,
      specs: true, uom: true, salesUom: true,
      productVariant: { select: { id: true, isActive: true, grade: true, thicknessMm: true, widthMm: true, lengthMm: true, diameterMm: true, finish: true, unit: { select: { symbol: true, isActive: true } } } },
    },
    orderBy: [{ name: "asc" }, { code: "asc" }],
    skip: (page - 1) * 50,
    take: 51,
  });
  const products = rows.slice(0, 50).map((row) => {
    const variant = row.productVariant?.isActive ? row.productVariant : null;
    const rawSpecs = row.specs && typeof row.specs === "object" && !Array.isArray(row.specs) ? row.specs as Record<string, unknown> : {};
    const source: Record<string, unknown> = {
      ...rawSpecs,
      grade: row.grade ?? variant?.grade ?? rawSpecs.grade,
      thickness: row.thickness?.toString() ?? variant?.thicknessMm?.toString() ?? rawSpecs.thickness,
      width: row.width?.toString() ?? variant?.widthMm?.toString() ?? rawSpecs.width,
      length: row.length?.toString() ?? variant?.lengthMm?.toString() ?? rawSpecs.length,
      diameter: row.diameter?.toString() ?? variant?.diameterMm?.toString() ?? rawSpecs.diameter,
      weightPerPiece: row.weightPerPiece?.toString() ?? rawSpecs.weightPerPiece,
      finish: variant?.finish ?? rawSpecs.finish,
    };
    const keys = new Set([
      ...category.requiredSpecs,
      ...Object.entries(source).filter(([key, value]) => (SPEC_LABELS.has(key) || key === "finish") && value !== null && value !== undefined && value !== "").map(([key]) => key),
    ]);
    const specifications = [...keys].filter((key) => SPEC_LABELS.has(key) || key === "finish").map((key) => {
      const value = source[key];
      const configured = value === null || value === undefined || value === "" || (typeof value !== "string" && typeof value !== "number") ? "" : String(value);
      const meta = SPEC_LABELS.get(key);
      return { key, label: meta?.label ?? "Finish", unit: meta?.unit ?? "", required: category.requiredSpecs.includes(key), value: configured };
    });
    const uom = variant?.unit?.isActive ? variant.unit.symbol : row.salesUom || row.uom;
    const labelSpecs = specifications.filter((field) => field.value).map((field) => `${field.label} ${field.value}${field.unit ? ` ${field.unit}` : ""}`);
    return { id: row.id, name: row.name, code: row.code, categoryId, productVariantId: variant?.id ?? null, uom, label: [row.name, row.code, ...labelSpecs].filter(Boolean).join(" · "), specifications };
  });
  return { category: { id: category.id, name: category.name }, products, page, pageSize: 50, hasMore: rows.length > 50 };
}

function productSpecTemplate(productForm: string | null, categoryType: string, productType: string) {
  if (productForm && TRADING_SPEC_FIELDS[productForm]) return TRADING_SPEC_FIELDS[productForm];
  if (productForm && MANUFACTURED_SPEC_FIELDS[productForm]) return MANUFACTURED_SPEC_FIELDS[productForm];
  if (productForm === "utensil") {
    const key = productType === "semi_finished" ? "semi_finished_utensils" : "finished_utensils";
    return MANUFACTURED_SPEC_FIELDS[key];
  }
  if (categoryType === "raw_material") return TRADING_SPEC_FIELDS.other;
  return [];
}

export function productSpecifications(input: {
  productForm: string | null;
  categoryType: string;
  productType: string;
  requiredSpecs: string[];
  grade: string | null;
  thickness: { toString(): string } | null;
  width: { toString(): string } | null;
  length: { toString(): string } | null;
  diameter: { toString(): string } | null;
  weightPerPiece: { toString(): string } | null;
  variant: { grade: string | null; thicknessMm: { toString(): string } | null; widthMm: { toString(): string } | null; lengthMm: { toString(): string } | null; diameterMm: { toString(): string } | null; finish: string | null } | null;
  specs: unknown;
}) {
  const stored = input.specs && typeof input.specs === "object" && !Array.isArray(input.specs) ? input.specs as Record<string, unknown> : {};
  const values: Record<string, string> = {};
  const put = (key: string, value: unknown) => {
    if (typeof value === "string" || typeof value === "number") {
      const normalized = String(value).trim();
      if (normalized) values[key] = normalized;
    }
  };
  for (const [key, value] of Object.entries(stored)) {
    if (SPEC_LABELS.has(key) || PUBLIC_PRODUCT_SPEC_KEYS.has(key)) put(key, value);
  }
  put("grade", input.grade ?? input.variant?.grade ?? values.grade);
  put("thickness", input.thickness?.toString() ?? input.variant?.thicknessMm?.toString() ?? values.thickness);
  put("width", input.width?.toString() ?? input.variant?.widthMm?.toString() ?? values.width);
  put("length", input.length?.toString() ?? input.variant?.lengthMm?.toString() ?? values.length);
  put("diameter", input.diameter?.toString() ?? input.variant?.diameterMm?.toString() ?? values.diameter);
  put("weightPerPiece", input.weightPerPiece?.toString() ?? values.weightPerPiece);
  put("finish", input.variant?.finish ?? values.finish);

  const template = productSpecTemplate(input.productForm, input.categoryType, input.productType);
  const labels = new Map<string, { label: string; unit: string }>(template.map(({ key, label, unit }) => [key, { label, unit: unit ?? "" }]));
  for (const field of MATERIAL_SPEC_FIELDS) if (!labels.has(field.key)) labels.set(field.key, { label: field.label, unit: field.unit });
  for (const [key, meta] of EXTRA_SPEC_LABELS) if (PUBLIC_PRODUCT_SPEC_KEYS.has(key) && !labels.has(key)) labels.set(key, meta);
  const keys = new Set([
    ...input.requiredSpecs.filter((key) => SPEC_LABELS.has(key)),
    ...template.filter((field) => values[field.key]).map((field) => field.key),
    ...Object.keys(values).filter((key) => SPEC_LABELS.has(key) || (PUBLIC_PRODUCT_SPEC_KEYS.has(key) && labels.has(key))),
  ]);
  return [...keys].flatMap((key) => {
    const meta = labels.get(key);
    if (!meta) return [];
    const value = values[key] ?? "";
    const isSelect = ["grade", "finish", "pvdColour"].includes(key) && Boolean(value);
    return [{
      key,
      label: meta.label,
      type: isSelect ? "select" as const : NUMERIC_SPEC_KEYS.has(key) ? "number" as const : "text" as const,
      required: input.requiredSpecs.includes(key),
      unit: meta.unit || undefined,
      value,
      ...(isSelect ? { options: [value] } : {}),
    }];
  });
}

/** Category-free public catalog used by the website. Category is always resolved from each material. */
export async function getPublicEnquiryProductList(query: string, page: number) {
  const { plant, categories, eligibleIds } = await publicPlant();
  if (!eligibleIds.size) return { products: [], page, pageSize: 50, hasMore: false };
  const categoryById = new Map(categories.filter((category) => eligibleIds.has(category.id)).map((category) => [category.id, category]));
  const where = {
    plantId: plant.id,
    categoryId: { in: [...eligibleIds] },
    active: true,
    salesAllowed: true,
    isDemo: false,
    ...(query ? { OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { code: { contains: query, mode: "insensitive" as const } },
      { grade: { contains: query, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [rows, uncategorizedCount] = await Promise.all([
    prisma.materialMaster.findMany({
      where,
      select: {
        id: true, code: true, name: true, categoryId: true, productType: true,
        grade: true, thickness: true, width: true, length: true, diameter: true, weightPerPiece: true,
        specs: true, uom: true, salesUom: true,
        productCategory: { select: { id: true, name: true, code: true, categoryType: true, productForm: true, requiredSpecs: true, status: true } },
        productVariant: { select: { id: true, isActive: true, grade: true, thicknessMm: true, widthMm: true, lengthMm: true, diameterMm: true, finish: true, unit: { select: { symbol: true, isActive: true } } } },
      },
      orderBy: [{ name: "asc" }, { code: "asc" }],
      skip: (page - 1) * 50,
      take: 51,
    }),
    prisma.materialMaster.count({ where: { plantId: plant.id, active: true, salesAllowed: true, isDemo: false, categoryId: null } }),
  ]);
  if (uncategorizedCount) console.warn(`[lead.website.catalog] ${uncategorizedCount} active saleable material(s) have no category and are omitted from the public catalog.`);

  const visibleRows = rows.filter((row) => {
    const category = row.categoryId ? categoryById.get(row.categoryId) : null;
    return Boolean(category && row.productCategory?.status.toLowerCase() === "active");
  });
  const symbols = [...new Set(visibleRows.flatMap((row) => {
    const variant = row.productVariant?.isActive ? row.productVariant : null;
    return [row.salesUom?.trim(), variant?.unit?.isActive ? variant.unit.symbol : "", row.uom.trim()].filter(Boolean) as string[];
  }))];
  const units = symbols.length ? await prisma.unitOfMeasure.findMany({
    where: { plantId: plant.id, isActive: true, symbol: { in: symbols } },
    select: { id: true, symbol: true, name: true },
  }) : [];
  const unitBySymbol = new Map(units.map((unit) => [unit.symbol.toLowerCase(), unit]));
  const products = visibleRows.slice(0, 50).flatMap((row) => {
    const category = row.categoryId ? categoryById.get(row.categoryId) : null;
    if (!category || !row.productCategory || row.productCategory.status.toLowerCase() !== "active") return [];
    const variant = row.productVariant?.isActive ? row.productVariant : null;
    const uomCode = row.salesUom?.trim() || (variant?.unit?.isActive ? variant.unit.symbol : "") || row.uom.trim();
    if (!uomCode) return [];
    const unit = unitBySymbol.get(uomCode.toLowerCase());
    const specifications = productSpecifications({
      productForm: category.productForm,
      categoryType: category.categoryType,
      productType: row.productType,
      requiredSpecs: category.requiredSpecs,
      grade: row.grade,
      thickness: row.thickness,
      width: row.width,
      length: row.length,
      diameter: row.diameter,
      weightPerPiece: row.weightPerPiece,
      variant,
      specs: row.specs,
    });
    return [{
      id: row.id,
      name: row.name,
      code: row.code,
      category: { id: category.id, name: category.name },
      productVariantId: variant?.id ?? null,
      uom: { id: unit?.id ?? null, code: uomCode, name: unit?.name ?? uomCode },
      uomOptions: [{ id: unit?.id ?? null, code: uomCode, name: unit?.name ?? uomCode, isDefault: true }],
      specifications,
    }];
  });
  return { products, page, pageSize: 50, hasMore: rows.length > 50 };
}

export function publicCategoryIdIsValid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
