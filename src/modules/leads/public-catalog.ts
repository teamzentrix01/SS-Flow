import { prisma } from "@/db";
import { AppError } from "@/lib/errors";
import { MATERIAL_SPEC_FIELDS } from "@/lib/domain/material-specifications";
import { resolvePublicLeadPlant } from "@/modules/leads/public-enquiry";

const PUBLIC_CATEGORY_TYPES = new Set(["raw_material", "wip", "finished_goods"]);
const SPEC_LABELS = new Map<string, { label: string; unit: string }>(
  MATERIAL_SPEC_FIELDS.map(({ key, label, unit }) => [key, { label, unit }]),
);

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

export function publicCategoryIdIsValid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
